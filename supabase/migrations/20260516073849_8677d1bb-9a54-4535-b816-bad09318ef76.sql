
-- ROLES
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users can view own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);

create policy "users can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

create policy "users can insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RSS SOURCES (shared)
create table public.rss_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  url text not null unique,
  category text not null default 'NAT',
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.rss_sources enable row level security;

create policy "rss sources readable by authenticated" on public.rss_sources
  for select to authenticated using (true);

create policy "authenticated can insert rss sources" on public.rss_sources
  for insert to authenticated with check (auth.uid() = created_by);

create policy "users can delete own custom sources, admin can delete any" on public.rss_sources
  for delete to authenticated using (
    (created_by = auth.uid() and is_default = false)
    or public.has_role(auth.uid(), 'admin')
  );

-- Seed defaults
insert into public.rss_sources (slug, name, url, category, is_default) values
  ('antara', 'ANTARA EN', 'https://en.antaranews.com/rss/news.xml', 'INTL', true),
  ('sindo', 'SINDONEWS', 'https://www.sindonews.com/feed', 'NAT', true),
  ('viva', 'VIVA', 'https://www.viva.co.id/get/all', 'NAT', true),
  ('jpnn', 'JPNN', 'https://www.jpnn.com/index.php?mib=rss', 'NAT', true),
  ('media', 'MEDIA INDONESIA', 'https://mediaindonesia.com/feed', 'NAT', true),
  ('tribun', 'TRIBUNNEWS', 'https://www.tribunnews.com/rss', 'NAT', true),
  ('fajar', 'FAJAR', 'https://fajar.co.id/feed', 'REG', true)
on conflict (slug) do nothing;
