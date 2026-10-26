-- Esquema Multi-Usuario para Orbit Notes
begin;

-- Eliminar políticas y esquema privado antiguo si existen
drop policy if exists categories_owner on public.categories;
drop policy if exists notes_owner on public.notes;
drop policy if exists categories_policy on public.categories;
drop policy if exists notes_policy on public.notes;

drop function if exists public.is_app_owner();
drop table if exists private.app_owner cascade;
drop schema if exists private cascade;

-- Crear tabla categories con user_id
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Asegurar columna user_id si la tabla ya existía
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='categories' and column_name='user_id') then
    alter table public.categories add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
  end if;
end $$;

-- Actualizar registros huérfanos previos asignándolos al usuario actual
update public.categories set user_id = auth.uid() where user_id is null;

-- Índice único por usuario y nombre de tema
alter table public.categories drop constraint if exists categories_name_unique;
drop index if exists public.categories_name_unique;
drop index if exists public.categories_user_name_unique;
create unique index categories_user_name_unique on public.categories(user_id, lower(btrim(name)));

-- Crear tabla notes con user_id
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  content text not null check (char_length(btrim(content)) > 0 and char_length(content) <= 50000),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Asegurar columna user_id si la tabla ya existía
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notes' and column_name='user_id') then
    alter table public.notes add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
  end if;
end $$;

-- Actualizar notas huérfanas previas
update public.notes set user_id = auth.uid() where user_id is null;

-- Índices de búsqueda para notas
drop index if exists public.notes_category_idx;
drop index if exists public.notes_user_category_idx;
create index notes_user_category_idx on public.notes(user_id, category_id);

-- Función para actualizar updated_at automáticamente
create or replace function public.touch_note()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists notes_updated on public.notes;
create trigger notes_updated before update on public.notes
  for each row execute function public.touch_note();

-- Activar Row Level Security (RLS)
alter table public.categories enable row level security;
alter table public.notes enable row level security;
revoke all on public.categories, public.notes from anon, authenticated;
grant select, insert, update, delete on public.categories, public.notes to authenticated;

-- Políticas de seguridad: Cada usuario solo accede a sus propios datos
create policy categories_policy on public.categories for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notes_policy on public.notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Inicialización del tablero individual por usuario
create or replace function public.initialize_board()
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if not exists(select 1 from public.categories where user_id = uid) then
    insert into public.categories(user_id, name, position) values
      (uid, 'Docker', 0),
      (uid, 'Linux', 1),
      (uid, 'OCI', 2),
      (uid, 'Desarrollo', 3),
      (uid, 'Operaciones', 4),
      (uid, 'Generales', 5);
  end if;
end;
$$;

-- Eliminar tema y mover notas dentro de la cuenta del usuario
create or replace function public.remove_category(source_id uuid, target_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if source_id is null or target_id is null or source_id = target_id
    or not exists(select 1 from public.categories where id = source_id and user_id = uid)
    or not exists(select 1 from public.categories where id = target_id and user_id = uid)
  then raise exception 'Selecciona un tema de destino válido'; end if;
  update public.notes set category_id = target_id where category_id = source_id and user_id = uid;
  delete from public.categories where id = source_id and user_id = uid;
end;
$$;

-- Exportar notas del usuario actual
create or replace function public.export_board()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'version', 1,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.position, c.id)
      from public.categories c where c.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'categoryId', n.category_id, 'content', n.content,
        'color', n.color, 'createdAt', n.created_at, 'updatedAt', n.updated_at
      ) order by n.created_at desc, n.id) from public.notes n where n.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

-- Importar notas para el usuario actual
create or replace function public.import_board(payload jsonb)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  item jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object'
    or jsonb_typeof(payload->'categories') is distinct from 'array'
    or jsonb_typeof(payload->'notes') is distinct from 'array'
  then raise exception 'Formato de respaldo inválido'; end if;
  if jsonb_array_length(payload->'categories') not between 1 and 100
    or jsonb_array_length(payload->'notes') > 10000
  then raise exception 'Tamaño de respaldo inválido'; end if;

  delete from public.notes where user_id = uid;
  delete from public.categories where user_id = uid;

  for item in select value from jsonb_array_elements(payload->'categories') loop
    insert into public.categories(id, user_id, name, position)
    values((item->>'id')::uuid, uid, item->>'name', (item->>'position')::integer);
  end loop;
  for item in select value from jsonb_array_elements(payload->'notes') loop
    insert into public.notes(id, user_id, category_id, content, color, created_at, updated_at)
    values(
      (item->>'id')::uuid, uid, (item->>'category_id')::uuid,
      item->>'content', item->>'color',
      (item->>'created_at')::timestamptz, (item->>'updated_at')::timestamptz
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

-- Habilitar replicación en tiempo real para categorías y notas
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