-- MYA E-Commerce Partner — Supabase database + Row Level Security
-- Run this whole file in Supabase SQL Editor.
-- IMPORTANT: create your first user in Supabase Dashboard > Authentication > Users,
-- then set that user's profile role to owner using the final SQL statement below.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  employee_id text unique,
  phone text,
  joining_date date,
  department text,
  role text not null default 'worker' check (role in ('owner','manager','worker')),
  status text not null default 'Active' check (status in ('Active','Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('Present','Absent','Late','Leave')),
  time time,
  notes text,
  marked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(worker_id, attendance_date)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  due_date date not null,
  priority text not null default 'Normal' check (priority in ('Low','Normal','High','Urgent')),
  status text not null default 'Pending' check (status in ('Pending','In Progress','Completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the tasks table already existed before this update, run this line once
-- so the existing table also gets the new column (safe to re-run, does nothing if it already exists):
alter table public.tasks add column if not exists completion_note text;

create or replace function public.is_manager_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner','manager') and status='Active'
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role='owner' and status='Active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)),
    new.email
  )
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (id=auth.uid() or public.is_manager_or_owner());

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert with check (public.is_owner() or public.is_manager_or_owner());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update using (id=auth.uid() or public.is_manager_or_owner())
with check (
  id=auth.uid()
  or public.is_owner()
  or (public.is_manager_or_owner() and role <> 'owner')
);

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete using (public.is_owner());

drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance for select using (worker_id=auth.uid() or public.is_manager_or_owner());

drop policy if exists "attendance_insert" on public.attendance;
create policy "attendance_insert" on public.attendance for insert with check (public.is_manager_or_owner());

drop policy if exists "attendance_update" on public.attendance;
create policy "attendance_update" on public.attendance for update using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

drop policy if exists "attendance_delete" on public.attendance;
create policy "attendance_delete" on public.attendance for delete using (public.is_owner());

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select using (assigned_to=auth.uid() or public.is_manager_or_owner());

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert with check (public.is_manager_or_owner());

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update using (public.is_manager_or_owner() or assigned_to=auth.uid())
with check (public.is_manager_or_owner() or assigned_to=auth.uid());

drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks for delete using (public.is_manager_or_owner());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant execute on function public.is_manager_or_owner() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- AFTER creating your first auth user, replace the email below and run:
-- update public.profiles set role='owner', status='Active' where email='owner@example.com';
