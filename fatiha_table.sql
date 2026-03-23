-- Run in Supabase SQL Editor
create table if not exists fatiha_requests (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid references memorials(id),
  participant_name text not null,
  created_at timestamptz default now()
);

alter table fatiha_requests enable row level security;

create policy "public read fatiha" on fatiha_requests for select using (true);
create policy "public insert fatiha" on fatiha_requests for insert with check (true);
