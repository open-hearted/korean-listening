// play_logs への記録成功を学習画面内の複数コンポーネントへ通知するための軽量イベントバス
const target = new EventTarget();
const EVENT_NAME = "play-log-recorded";

export function notifyPlayLogRecorded(): void {
  target.dispatchEvent(new Event(EVENT_NAME));
}

export function subscribePlayLogRecorded(listener: () => void): () => void {
  target.addEventListener(EVENT_NAME, listener);
  return () => target.removeEventListener(EVENT_NAME, listener);
}
