-- study_items テーブルの作成とRLS設定
create table study_items (
  id uuid primary key default gen_random_uuid(),
  ja_text text not null,
  ko_text text not null,
  ipa text not null,
  ja_ipa text,
  ja_audio_url text not null,
  ko_audio_url text not null,
  en_text text,
  en_ipa text,
  en_audio_url text,
  en_syllables text,
  created_at timestamptz default now()
);
alter table study_items enable row level security;
create policy "authenticated read" on study_items
  for select to authenticated using (true);
