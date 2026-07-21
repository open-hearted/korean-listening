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

-- ai_questions テーブルの作成とRLS設定
create table ai_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  study_item_id uuid not null references study_items (id),
  question text not null,
  answer text not null,
  created_at timestamptz default now()
);
alter table ai_questions enable row level security;
create policy "own rows only" on ai_questions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- play_logs テーブルの作成とRLS設定
create table play_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  study_item_id uuid not null references study_items (id),
  play_type text not null,
  created_at timestamptz default now()
);
alter table play_logs enable row level security;
create policy "own rows only" on play_logs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
