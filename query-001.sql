-- ==========================================
-- 1. BASE TABLES & SECURITY (From schema.sql)
-- ==========================================

-- Enable Row Level Security (if not already enabled)
-- alter table auth.users enable row level security;

-- PROFILES TABLE
-- We use 'if not exists' to prevent errors if you run it multiple times
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text check (role in ('admin', 'client')) default 'client',
  full_name text,
  company_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles enable row level security;

-- Policies (We drop them first to allow re-running the script without "policy already exists" error)
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone." on profiles for select using ( true );

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." on profiles for insert with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." on profiles for update using ( auth.uid() = id );

-- PROJECTS TABLE
create table if not exists projects (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references profiles(id) not null,
  title text not null,
  description text,
  status text check (status in ('active', 'completed', 'pending')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table projects enable row level security;

drop policy if exists "Admin can do everything on projects" on projects;
create policy "Admin can do everything on projects" on projects for all using ( exists ( select 1 from profiles where id = auth.uid() and role = 'admin' ) );

drop policy if exists "Clients can view their own projects" on projects;
create policy "Clients can view their own projects" on projects for select using ( client_id = auth.uid() );

-- INVOICES TABLE
create table if not exists invoices (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  amount numeric not null,
  status text check (status in ('paid', 'unpaid', 'overdue')) default 'unpaid',
  pdf_url text,
  due_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table invoices enable row level security;

drop policy if exists "Admin can do everything on invoices" on invoices;
create policy "Admin can do everything on invoices" on invoices for all using ( exists ( select 1 from profiles where id = auth.uid() and role = 'admin' ) );

drop policy if exists "Clients can view invoices for their projects" on invoices;
create policy "Clients can view invoices for their projects" on invoices for select using ( exists ( select 1 from projects where projects.id = invoices.project_id and projects.client_id = auth.uid() ) );

-- ==========================================
-- 2. ADVANCED LOGIC (From schema_update.sql)
-- ==========================================

-- Function to calculate total outstanding balance per client
create or replace function get_client_balances()
returns table (
  client_id uuid,
  email text,
  full_name text,
  total_outstanding numeric
) language sql security definer as $$
  select 
    p.id as client_id,
    p.email,
    p.full_name,
    coalesce(sum(i.amount), 0) as total_outstanding
  from profiles p
  left join projects proj on proj.client_id = p.id
  left join invoices i on i.project_id = proj.id and i.status = 'unpaid'
  where p.role = 'client'
  group by p.id, p.email, p.full_name
  order by total_outstanding desc;
$$;

-- Trigger to automatically assign 'client' role and create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'client');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
