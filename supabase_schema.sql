-- =========================================================
-- MYA E-Commerce Partner — Supabase Schema + RLS
-- Run this once in Supabase Dashboard → SQL Editor → New query
-- =========================================================

-- 1) PROFILES (extends auth.users, one row per team member)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  department text,                 -- e.g. "Product Listing", "Order Checking"
  role text not null default 'worker' check (role in ('owner','manager','worker')),
  status text not null default 'pending' check (status in ('pending','active','inactive')),
  joining_date date default current_date,
  created_at timestamptz default now()
);

-- 2) TASKS
create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  worker_id uuid references public.profiles(id) on delete set null,
  deadline date,
  priority text default 'Medium' check (priority in ('Low','Medium','High')),
  progress int default 0 check (progress between 0 and 100),
  status text default 'Pending' check (status in ('Pending','In Progress','Completed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 3) ATTENDANCE
create table if not exists public.attendance (
  id bigint generated always as identity primary key,
  worker_id uuid references public.profiles(id) on delete cascade,
  date date not null default current_date,
  status text check (status in ('Present','Absent','Late','Leave')),
  time text,
  marked_by uuid references public.profiles(id),
  unique (worker_id, date)
);

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGN UP
-- First person to ever sign up becomes Owner (active).
-- Everyone after that signs up as Worker (pending) awaiting approval.
-- =========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    case when (select count(*) from public.profiles) = 0 then 'owner' else 'worker' end,
    case when (select count(*) from public.profiles) = 0 then 'active' else 'pending' end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Prevent a non-owner/manager from self-promoting via a profile update
create or replace function public.protect_role_change()
returns trigger as $$
begin
  if (new.role <> old.role or new.status <> old.status) then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner','manager')
    ) then
      new.role := old.role;
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists before_profile_update on public.profiles;
create trigger before_profile_update
  before update on public.profiles
  for each row execute procedure public.protect_role_change();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.attendance enable row level security;

-- ---- profiles ----
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_update_owner_manager" on public.profiles;
create policy "profiles_update_owner_manager" on public.profiles
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
  );

drop policy if exists "profiles_delete_owner" on public.profiles;
create policy "profiles_delete_owner" on public.profiles
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
  );

-- ---- tasks ----
drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks
  for select using (
    worker_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
  );

drop policy if exists "tasks_insert_owner_manager" on public.tasks;
create policy "tasks_insert_owner_manager" on public.tasks
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
  );

drop policy if exists "tasks_update_owner_manager" on public.tasks;
create policy "tasks_update_owner_manager" on public.tasks
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
  );

drop policy if exists "tasks_update_own_worker" on public.tasks;
create policy "tasks_update_own_worker" on public.tasks
  for update using (worker_id = auth.uid()) with check (worker_id = auth.uid());

drop policy if exists "tasks_delete_owner_manager" on public.tasks;
create policy "tasks_delete_owner_manager" on public.tasks
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
  );

-- ---- attendance ----
drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance
  for select using (
    worker_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
  );

drop policy if exists "attendance_insert_owner_manager" on public.attendance;
create policy "attendance_insert_owner_manager" on public.attendance
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
  );

drop policy if exists "attendance_update_owner_manager" on public.attendance;
create policy "attendance_update_owner_manager" on public.attendance
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
  );

-- =========================================================
-- DONE. Next steps:
-- 1. Project Settings → API → copy the Project URL and anon public key
--    into app.js (SUPABASE_URL / SUPABASE_ANON_KEY).
-- 2. Authentication → Providers → Email: enable "Email" provider.
--    (You can turn OFF "Confirm email" while testing, so signup logs
--    the user in immediately.)
-- 3. Authentication → URL Configuration → add your site URL / localhost
--    to Redirect URLs (needed for the password-reset email link).
-- =========================================================
