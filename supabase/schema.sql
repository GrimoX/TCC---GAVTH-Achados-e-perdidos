create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('lost', 'found')),
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 1000),
  photo_path text,
  status text not null default 'active' check (status in ('active', 'found', 'returned', 'removed')),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.items
  add column if not exists status text not null default 'active';

alter table public.items
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id) on delete set null;

alter table public.items drop constraint if exists items_status_check;
alter table public.items
  add constraint items_status_check check (status in ('active', 'found', 'returned', 'removed'));

create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists items_type_idx on public.items (type);

alter table public.items enable row level security;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'secretary'),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

create table if not exists public.item_interests (
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Aluno' check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists item_interests_item_id_idx on public.item_interests (item_id);

alter table public.item_interests enable row level security;

create or replace function public.is_secretary()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'secretary'
  );
$$;

revoke all on function public.is_secretary() from public;
grant execute on function public.is_secretary() to authenticated;

create or replace function public.remove_item(target_item uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_rows integer;
begin
  if auth.uid() is null or not public.is_secretary() then
    raise exception 'Somente a Secretaria pode remover itens.'
      using errcode = '42501';
  end if;

  update public.items
  set status = 'removed',
      removed_at = now(),
      removed_by = auth.uid()
  where id = target_item
    and status <> 'removed';

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Item não encontrado ou já removido.'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.remove_item(uuid) from public;
grant execute on function public.remove_item(uuid) to authenticated;

create or replace function public.set_item_status(target_item uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_item public.items%rowtype;
begin
  if auth.uid() is null or not public.is_secretary() then
    raise exception 'Somente a Secretaria pode alterar o estado dos itens.'
      using errcode = '42501';
  end if;

  if next_status not in ('found', 'returned') then
    raise exception 'Estado do item inválido.' using errcode = '22023';
  end if;

  select * into current_item
  from public.items
  where id = target_item
  for update;

  if not found then
    raise exception 'Item não encontrado.' using errcode = 'P0002';
  end if;

  if current_item.type = 'lost'
      and current_item.status = 'active'
      and next_status = 'found' then
    update public.items set status = 'found' where id = target_item;
  elsif current_item.status = 'found' and next_status = 'returned' then
    update public.items set status = 'returned' where id = target_item;
  elsif current_item.type = 'found'
      and current_item.status = 'active'
      and next_status = 'returned' then
    update public.items set status = 'returned' where id = target_item;
  else
    raise exception 'Essa transição de estado não é permitida.'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.set_item_status(uuid, text) from public;
grant execute on function public.set_item_status(uuid, text) to authenticated;

grant select on public.items to anon, authenticated;
grant insert on public.items to authenticated;
revoke update, delete on public.items from anon, authenticated;

drop policy if exists "Anyone can view item listings" on public.items;
drop policy if exists "Public can view unremoved item listings" on public.items;
create policy "Public can view unremoved item listings"
  on public.items for select to anon using (status <> 'removed');

drop policy if exists "Authenticated users can view item listings" on public.items;
create policy "Authenticated users can view item listings"
  on public.items for select to authenticated
  using (status <> 'removed' or public.is_secretary());

drop policy if exists "Users can create their own listings" on public.items;
create policy "Users can create their own listings"
  on public.items for insert to authenticated
  with check (auth.uid() = user_id and status = 'active');

drop policy if exists "Users can update their own listings" on public.items;

drop policy if exists "Users can delete their own listings" on public.items;
drop policy if exists "Secretariat can delete any listing" on public.items;

drop policy if exists "Users can view their own role" on public.user_roles;
create policy "Users can view their own role"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

grant select on public.user_roles to authenticated;
revoke insert, update, delete on public.user_roles from anon, authenticated;

drop policy if exists "Students and secretariat can view interests" on public.item_interests;
create policy "Students and secretariat can view interests"
  on public.item_interests for select to authenticated
  using (auth.uid() = user_id or public.is_secretary());

drop policy if exists "Students can register their own interest" on public.item_interests;
create policy "Students can register their own interest"
  on public.item_interests for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_secretary()
    and display_name = coalesce(
      nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
      nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
      nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
      nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), ''),
      'Aluno'
    )
    and exists (
      select 1 from public.items
      where id = item_id and status in ('active', 'found')
    )
  );

drop policy if exists "Students can remove their own interest" on public.item_interests;
create policy "Students can remove their own interest"
  on public.item_interests for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.item_interests to authenticated;
revoke update on public.item_interests from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lost-found-images', 'lost-found-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Users upload their own item photos" on storage.objects;
create policy "Users upload their own item photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lost-found-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users view their own item photos" on storage.objects;

notify pgrst, 'reload schema';
