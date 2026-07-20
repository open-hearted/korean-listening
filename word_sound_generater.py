from __future__ import annotations

import os
import re
import threading
from contextlib import closing
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext
import tkinter as tk
from tkinter import ttk

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError
except ImportError:
    boto3 = None
    BotoCoreError = ClientError = NoCredentialsError = Exception


APP_DIR = Path(__file__).resolve().parent
ENV_FILE = APP_DIR / ".env"
DEFAULT_REGION = "ap-northeast-1"
DEFAULT_VOICE_ID = "Seoyeon"
DEFAULT_ENGINE = "standard"
DEFAULT_OUTPUT_DIR = APP_DIR / "audio"


def load_env_file(path: Path = ENV_FILE, override: bool = False) -> bool:
    """Load simple KEY=VALUE pairs without requiring python-dotenv."""
    if not path.exists():
        return False

    loaded_any = False
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if not key or not value:
            continue

        if override or key not in os.environ:
            os.environ[key] = value
            loaded_any = True

    return loaded_any


def env_value(*names: str, default: str = "") -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default


def read_words_file(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp932"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text()


WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def safe_filename(text: str, fallback: str = "word") -> str:
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", text)
    name = re.sub(r"\s+", "_", name).strip(" ._")
    name = name[:80].strip(" ._") or fallback
    if name.upper() in WINDOWS_RESERVED_NAMES:
        name = f"{name}_word"
    return name


class PollyWordSoundGeneratorApp:
    def __init__(self, root: tk.Tk) -> None:
        load_env_file()

        self.root = root
        self.root.title("Korean Word Audio Generator")
        self.root.geometry("780x720")
        self.root.minsize(680, 620)

        self.region_var = tk.StringVar(
            value=env_value("AWS_REGION_NAME", "AWS_DEFAULT_REGION", default=DEFAULT_REGION)
        )
        self.voice_var = tk.StringVar(
            value=env_value("POLLY_VOICE_ID", "AWS_POLLY_VOICE_ID", default=DEFAULT_VOICE_ID)
        )
        self.engine_var = tk.StringVar(
            value=env_value("POLLY_ENGINE", "AWS_POLLY_ENGINE", default=DEFAULT_ENGINE)
        )
        self.output_dir_var = tk.StringVar(
            value=env_value("POLLY_OUTPUT_DIR", default=str(DEFAULT_OUTPUT_DIR))
        )
        self.skip_existing_var = tk.BooleanVar(value=False)
        self.status_var = tk.StringVar(value=self._env_status_text())
        self.stop_event = threading.Event()
        self.worker_thread: threading.Thread | None = None

        self._build_ui()

    def _build_ui(self) -> None:
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        main = ttk.Frame(self.root, padding=12)
        main.grid(row=0, column=0, sticky="nsew")
        main.columnconfigure(0, weight=1)
        main.rowconfigure(2, weight=1)
        main.rowconfigure(5, weight=1)

        settings = ttk.LabelFrame(main, text="AWS Polly")
        settings.grid(row=0, column=0, sticky="ew")
        settings.columnconfigure(1, weight=1)
        settings.columnconfigure(3, weight=1)

        ttk.Label(settings, text="Region").grid(row=0, column=0, padx=8, pady=8, sticky="w")
        ttk.Entry(settings, textvariable=self.region_var, width=18).grid(
            row=0, column=1, padx=8, pady=8, sticky="ew"
        )

        ttk.Label(settings, text="Voice").grid(row=0, column=2, padx=8, pady=8, sticky="w")
        ttk.Combobox(
            settings,
            textvariable=self.voice_var,
            values=("Seoyeon",),
            width=18,
        ).grid(row=0, column=3, padx=8, pady=8, sticky="ew")

        ttk.Label(settings, text="Engine").grid(row=1, column=0, padx=8, pady=8, sticky="w")
        ttk.Combobox(
            settings,
            textvariable=self.engine_var,
            values=("standard", "neural"),
            state="readonly",
            width=18,
        ).grid(row=1, column=1, padx=8, pady=8, sticky="ew")

        ttk.Checkbutton(
            settings,
            text="Skip existing MP3 files without asking",
            variable=self.skip_existing_var,
        ).grid(row=1, column=2, columnspan=2, padx=8, pady=8, sticky="w")

        env_frame = ttk.Frame(main)
        env_frame.grid(row=1, column=0, pady=(8, 6), sticky="ew")
        env_frame.columnconfigure(0, weight=1)
        ttk.Label(env_frame, textvariable=self.status_var).grid(row=0, column=0, sticky="w")
        ttk.Button(env_frame, text="Reload .env", command=self.reload_env).grid(
            row=0, column=1, padx=(8, 0)
        )

        words_frame = ttk.LabelFrame(main, text="Korean words")
        words_frame.grid(row=2, column=0, sticky="nsew")
        words_frame.columnconfigure(0, weight=1)
        words_frame.rowconfigure(0, weight=1)

        self.words_text = scrolledtext.ScrolledText(words_frame, wrap=tk.WORD, height=12)
        self.words_text.grid(row=0, column=0, padx=8, pady=8, sticky="nsew")

        word_buttons = ttk.Frame(words_frame)
        word_buttons.grid(row=1, column=0, padx=8, pady=(0, 8), sticky="ew")
        ttk.Button(word_buttons, text="Load .txt", command=self.load_words).pack(side=tk.LEFT)
        ttk.Button(word_buttons, text="Clear", command=self.clear_words).pack(
            side=tk.LEFT, padx=(8, 0)
        )

        output_frame = ttk.LabelFrame(main, text="Output")
        output_frame.grid(row=3, column=0, pady=(8, 0), sticky="ew")
        output_frame.columnconfigure(0, weight=1)
        ttk.Entry(output_frame, textvariable=self.output_dir_var).grid(
            row=0, column=0, padx=8, pady=8, sticky="ew"
        )
        ttk.Button(output_frame, text="Browse", command=self.browse_output_dir).grid(
            row=0, column=1, padx=(0, 8), pady=8
        )

        action_frame = ttk.Frame(main)
        action_frame.grid(row=4, column=0, pady=10, sticky="ew")
        self.generate_button = ttk.Button(
            action_frame, text="Generate MP3", command=self.start_generation
        )
        self.generate_button.pack(side=tk.LEFT)
        self.cancel_button = ttk.Button(
            action_frame, text="Cancel", command=self.cancel_generation, state=tk.DISABLED
        )
        self.cancel_button.pack(side=tk.LEFT, padx=(8, 0))

        self.progress = ttk.Progressbar(main, mode="determinate")
        self.progress.grid(row=4, column=0, padx=(210, 0), pady=10, sticky="ew")

        log_frame = ttk.LabelFrame(main, text="Log")
        log_frame.grid(row=5, column=0, sticky="nsew")
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        self.log_text = scrolledtext.ScrolledText(log_frame, height=8, state=tk.DISABLED)
        self.log_text.grid(row=0, column=0, padx=8, pady=8, sticky="nsew")

    def _env_status_text(self) -> str:
        if ENV_FILE.exists():
            return f"Using {ENV_FILE}"
        return f"Create {ENV_FILE} for AWS credentials"

    def reload_env(self) -> None:
        loaded = load_env_file(override=True)
        self.region_var.set(env_value("AWS_REGION_NAME", "AWS_DEFAULT_REGION", default=DEFAULT_REGION))
        self.voice_var.set(env_value("POLLY_VOICE_ID", "AWS_POLLY_VOICE_ID", default=DEFAULT_VOICE_ID))
        self.engine_var.set(env_value("POLLY_ENGINE", "AWS_POLLY_ENGINE", default=DEFAULT_ENGINE))
        self.status_var.set("Reloaded .env" if loaded else self._env_status_text())

    def load_words(self) -> None:
        filename = filedialog.askopenfilename(
            title="Open word list",
            filetypes=(("Text files", "*.txt"), ("All files", "*.*")),
        )
        if not filename:
            return
        try:
            content = read_words_file(Path(filename))
        except OSError as exc:
            messagebox.showerror("Read error", str(exc))
            return
        self.words_text.delete("1.0", tk.END)
        self.words_text.insert("1.0", content)

    def clear_words(self) -> None:
        self.words_text.delete("1.0", tk.END)

    def browse_output_dir(self) -> None:
        directory = filedialog.askdirectory(initialdir=self.output_dir_var.get() or str(APP_DIR))
        if directory:
            self.output_dir_var.set(directory)

    def start_generation(self) -> None:
        words = self.get_words()
        if not words:
            messagebox.showerror("Input needed", "Enter at least one Korean word.")
            return

        output_dir = Path(self.output_dir_var.get()).expanduser()
        region = self.region_var.get().strip()
        voice_id = self.voice_var.get().strip()
        engine = self.engine_var.get().strip()

        if not region or not voice_id or not engine:
            messagebox.showerror("Settings needed", "Region, voice, and engine are required.")
            return

        if boto3 is None:
            messagebox.showerror(
                "Missing package",
                "boto3 is not installed. Run: pip install boto3",
            )
            return

        skip_existing = self.skip_existing_var.get()
        if not skip_existing:
            existing_paths = self.find_existing_outputs(words, output_dir)
            if existing_paths:
                overwrite_existing = self.confirm_existing_files(existing_paths)
                if overwrite_existing is None:
                    self.status_var.set("Canceled before generation.")
                    return
                skip_existing = not overwrite_existing

        self.stop_event.clear()
        self.set_running(True)
        self.progress.configure(maximum=len(words), value=0)
        self.clear_log()
        self.log(f"Starting {len(words)} word(s).")
        if skip_existing:
            self.log("Existing MP3 files will be skipped.")

        args = (
            words,
            output_dir,
            region,
            voice_id,
            engine,
            skip_existing,
        )
        self.worker_thread = threading.Thread(target=self.generate_worker, args=args, daemon=True)
        self.worker_thread.start()

    def find_existing_outputs(self, words: list[str], output_dir: Path) -> list[Path]:
        existing_paths: list[Path] = []
        seen_paths: set[Path] = set()

        for word in words:
            output_path = output_dir / f"{safe_filename(word)}.mp3"
            if output_path in seen_paths:
                continue
            seen_paths.add(output_path)

            if output_path.exists():
                existing_paths.append(output_path)

        return existing_paths

    def confirm_existing_files(self, existing_paths: list[Path]) -> bool | None:
        preview_count = 8
        preview = "\n".join(f"- {path.name}" for path in existing_paths[:preview_count])
        remaining = len(existing_paths) - preview_count
        if remaining > 0:
            preview += f"\n... and {remaining} more"

        return messagebox.askyesnocancel(
            "Existing MP3 files",
            (
                f"{len(existing_paths)} MP3 file(s) already exist.\n\n"
                f"{preview}\n\n"
                "Overwrite them?\n"
                "Yes: overwrite existing files\n"
                "No: skip existing files this time\n"
                "Cancel: stop"
            ),
        )

    def cancel_generation(self) -> None:
        self.stop_event.set()
        self.status_var.set("Cancel requested. Waiting for the current request to finish...")

    def get_words(self) -> list[str]:
        text = self.words_text.get("1.0", tk.END)
        return [line.strip() for line in text.splitlines() if line.strip()]

    def make_polly_client(self, region: str):
        kwargs = {"region_name": region}
        access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        session_token = os.environ.get("AWS_SESSION_TOKEN")

        if access_key and secret_key:
            kwargs["aws_access_key_id"] = access_key
            kwargs["aws_secret_access_key"] = secret_key
        if session_token:
            kwargs["aws_session_token"] = session_token

        return boto3.client("polly", **kwargs)

    def generate_worker(
        self,
        words: list[str],
        output_dir: Path,
        region: str,
        voice_id: str,
        engine: str,
        skip_existing: bool,
    ) -> None:
        created = 0
        skipped = 0
        failed = 0

        try:
            output_dir.mkdir(parents=True, exist_ok=True)
            client = self.make_polly_client(region)

            for index, word in enumerate(words, start=1):
                if self.stop_event.is_set():
                    self.ui_log("Canceled.")
                    break

                output_path = output_dir / f"{safe_filename(word)}.mp3"
                self.ui_status(f"Generating ({index}/{len(words)}): {word}")

                if skip_existing and output_path.exists():
                    skipped += 1
                    self.ui_log(f"Skipped existing: {output_path.name}")
                    self.ui_progress(index)
                    continue

                try:
                    self.write_word_audio(client, word, output_path, voice_id, engine)
                except (BotoCoreError, ClientError, NoCredentialsError, OSError, RuntimeError) as exc:
                    failed += 1
                    self.ui_log(f"Failed: {word} - {exc}")
                else:
                    created += 1
                    self.ui_log(f"Created: {output_path.name}")

                self.ui_progress(index)

        except Exception as exc:
            failed += 1
            self.ui_log(f"Stopped by error: {exc}")

        summary = {
            "created": created,
            "skipped": skipped,
            "failed": failed,
            "canceled": self.stop_event.is_set(),
        }
        self.root.after(0, lambda: self.finish_generation(summary))

    @staticmethod
    def write_word_audio(client, word: str, output_path: Path, voice_id: str, engine: str) -> None:
        response = client.synthesize_speech(
            Text=word,
            TextType="text",
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine=engine,
            LanguageCode="ko-KR",
        )

        audio_stream = response.get("AudioStream")
        if audio_stream is None:
            raise RuntimeError("Polly did not return an audio stream.")

        with closing(audio_stream) as stream:
            output_path.write_bytes(stream.read())

    def finish_generation(self, summary: dict[str, int | bool]) -> None:
        self.set_running(False)
        if summary["canceled"]:
            text = "Canceled"
        elif summary["failed"]:
            text = "Completed with errors"
        else:
            text = "Completed"

        self.status_var.set(
            f"{text}: created {summary['created']}, skipped {summary['skipped']}, "
            f"failed {summary['failed']}"
        )
        messagebox.showinfo("Done", self.status_var.get())

    def set_running(self, running: bool) -> None:
        self.generate_button.configure(state=tk.DISABLED if running else tk.NORMAL)
        self.cancel_button.configure(state=tk.NORMAL if running else tk.DISABLED)

    def clear_log(self) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def log(self, message: str) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def ui_log(self, message: str) -> None:
        self.root.after(0, lambda: self.log(message))

    def ui_status(self, message: str) -> None:
        self.root.after(0, lambda: self.status_var.set(message))

    def ui_progress(self, value: int) -> None:
        self.root.after(0, lambda: self.progress.configure(value=value))


def main() -> None:
    root = tk.Tk()
    PollyWordSoundGeneratorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
