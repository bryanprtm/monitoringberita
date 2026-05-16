create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.youtube_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  category text not null default 'LIVE',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.youtube_sources enable row level security;

create policy "youtube sources readable by authenticated"
  on public.youtube_sources for select
  to authenticated using (true);

create policy "authenticated can insert youtube sources"
  on public.youtube_sources for insert
  to authenticated with check (auth.uid() = created_by);

create policy "owner or admin can update youtube sources"
  on public.youtube_sources for update
  to authenticated
  using (created_by = auth.uid() or has_role(auth.uid(), 'admin'))
  with check (created_by = auth.uid() or has_role(auth.uid(), 'admin'));

create policy "owner or admin can delete youtube sources"
  on public.youtube_sources for delete
  to authenticated
  using (created_by = auth.uid() or has_role(auth.uid(), 'admin'));

create trigger update_youtube_sources_updated_at
  before update on public.youtube_sources
  for each row execute function public.update_updated_at_column();
