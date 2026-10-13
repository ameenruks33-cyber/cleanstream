-- CleanStream user library (optional). Enable if you use Supabase auth.
-- The service-role key must never be shipped to the browser.

create table if not exists public.user_libraries (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_libraries enable row level security;

create policy "Users read own library"
  on public.user_libraries
  for select
  using (auth.uid() = user_id);

create policy "Users insert own library"
  on public.user_libraries
  for insert
  with check (auth.uid() = user_id);

create policy "Users update own library"
  on public.user_libraries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own library"
  on public.user_libraries
  for delete
  using (auth.uid() = user_id);
