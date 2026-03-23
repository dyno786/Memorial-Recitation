-- Run this in Supabase SQL Editor

-- User profiles table (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  city text,
  mosque_attended text,
  account_type text not null default 'public', -- 'public' or 'mosque'
  marketing_opt_in boolean default false,
  created_at timestamptz default now()
);

-- Mosque applications table
create table if not exists mosque_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  mosque_name text not null,
  mosque_address text,
  mosque_postcode text,
  mosque_city text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  status text not null default 'pending', -- 'pending', 'approved', 'rejected'
  admin_notes text,
  applied_at timestamptz default now(),
  reviewed_at timestamptz
);

-- Enable RLS
alter table profiles enable row level security;
alter table mosque_applications enable row level security;

-- Profiles: users can read/write their own profile
create policy "users read own profile" on profiles for select using (auth.uid() = id);
create policy "users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- Mosque applications: users can read/insert their own
create policy "users read own application" on mosque_applications for select using (auth.uid() = user_id);
create policy "users insert own application" on mosque_applications for insert with check (auth.uid() = user_id);

-- Authenticated admins can read and update all profiles and applications
create policy "admin read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "admin read applications" on mosque_applications for select using (auth.role() = 'authenticated');
create policy "admin update applications" on mosque_applications for update using (auth.role() = 'authenticated');
