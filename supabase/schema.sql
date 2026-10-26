-- Ejecutar UNA VEZ en un proyecto nuevo de Supabase.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_owner (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on private.app_owner from public, anon, authenticated;

create function public.is_app_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.app_owner where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_app_owner() from public, anon;
grant execute on function public.is_app_owner() to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index categories_name_unique on public.categories(lower(btrim(name)));

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  content text not null check (char_length(btrim(content)) > 0 and char_length(content) <= 50000),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_category_idx on public.notes(category_id);

create function public.touch_note()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger notes_updated before update on public.notes
  for each row execute function public.touch_note();

alter table public.categories enable row level security;
alter table public.notes enable row level security;
revoke all on public.categories, public.notes from anon, authenticated;
grant select, insert, update, delete on public.categories, public.notes to authenticated;

create policy categories_owner on public.categories for all to authenticated
  using ((select public.is_app_owner()))
  with check ((select public.is_app_owner()));
create policy notes_owner on public.notes for all to authenticated
  using ((select public.is_app_owner()))
  with check ((select public.is_app_owner()));

create function public.initialize_board()
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_app_owner() then raise exception 'Acceso no autorizado'; end if;
  perform pg_advisory_xact_lock(725431);
  if not exists(select 1 from public.categories) then
    insert into public.categories(name,position) values
      ('Docker',0),('Linux',1),('OCI',2),
      ('Desarrollo',3),('Operaciones',4),('Generales',5);
  end if;
end;
$$;

create function public.remove_category(source_id uuid, target_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_app_owner() then raise exception 'Acceso no autorizado'; end if;
  perform pg_advisory_xact_lock(725431);
  perform 1 from public.categories
    where id in (source_id,target_id) order by id for update;
  if source_id is null or target_id is null or source_id = target_id
    or not exists(select 1 from public.categories where id = source_id)
    or not exists(select 1 from public.categories where id = target_id)
  then raise exception 'Selecciona un tema de destino válido'; end if;
  update public.notes set category_id = target_id where category_id = source_id;
  delete from public.categories where id = source_id;
end;
$$;

create function public.export_board()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select case when public.is_app_owner() then jsonb_build_object(
    'version',1,
    'categories',coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.position,c.id)
      from public.categories c
    ),'[]'::jsonb),
    'notes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',n.id,'categoryId',n.category_id,'content',n.content,
        'color',n.color,'createdAt',n.created_at,'updatedAt',n.updated_at
      ) order by n.created_at desc,n.id) from public.notes n
    ),'[]'::jsonb)
  ) else null end;
$$;

create function public.import_board(payload jsonb)
returns void language plpgsql security invoker set search_path = ''
as $$
declare item jsonb;
begin
  if not public.is_app_owner() then raise exception 'Acceso no autorizado'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object'
    or jsonb_typeof(payload->'categories') is distinct from 'array'
    or jsonb_typeof(payload->'notes') is distinct from 'array'
  then raise exception 'Formato de respaldo inválido'; end if;
  if jsonb_array_length(payload->'categories') not between 1 and 100
    or jsonb_array_length(payload->'notes') > 10000
  then raise exception 'Tamaño de respaldo inválido'; end if;

  perform pg_advisory_xact_lock(725431);
  lock table public.categories, public.notes in share row exclusive mode;
  delete from public.notes;
  delete from public.categories;

  for item in select value from jsonb_array_elements(payload->'categories') loop
    insert into public.categories(id,name,position)
    values((item->>'id')::uuid,item->>'name',(item->>'position')::integer);
  end loop;
  for item in select value from jsonb_array_elements(payload->'notes') loop
    insert into public.notes(id,category_id,content,color,created_at,updated_at)
    values(
      (item->>'id')::uuid,(item->>'category_id')::uuid,
      item->>'content',item->>'color',
      (item->>'created_at')::timestamptz,(item->>'updated_at')::timestamptz
    );
  end loop;
end;
$$;

revoke all on function public.initialize_board() from public, anon;
revoke all on function public.remove_category(uuid,uuid) from public, anon;
revoke all on function public.export_board() from public, anon;
revoke all on function public.import_board(jsonb) from public, anon;
revoke all on function public.touch_note() from public, anon, authenticated;
grant execute on function public.initialize_board() to authenticated;
grant execute on function public.remove_category(uuid,uuid) to authenticated;
grant execute on function public.export_board() to authenticated;
grant execute on function public.import_board(jsonb) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='categories') then
    alter publication supabase_realtime add table public.categories;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notes') then
    alter publication supabase_realtime add table public.notes;
  end if;
end;
$$;

commit;
