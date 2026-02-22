-- Dedicated CMS backend additions for covers.cafe

create table if not exists covers_cafe_operator_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('operator')),
  created_at timestamptz not null default now()
);

create or replace function covers_cafe_is_operator()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from covers_cafe_operator_roles r
    where r.user_id = auth.uid() and r.role = 'operator'
  );
$$;

create table if not exists covers_cafe_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists covers_cafe_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references covers_cafe_collections(id) on delete cascade,
  cover_id uuid not null references covers_cafe_covers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists covers_cafe_collection_items_unique
  on covers_cafe_collection_items(collection_id, cover_id);

alter table covers_cafe_collections enable row level security;
alter table covers_cafe_collection_items enable row level security;

create policy "collection_owner_can_write"
  on covers_cafe_collections for all
  using (owner_id = auth.uid() or covers_cafe_is_operator())
  with check (owner_id = auth.uid() or covers_cafe_is_operator());

create policy "collection_public_or_owner_can_read"
  on covers_cafe_collections for select
  using (is_public or owner_id = auth.uid() or covers_cafe_is_operator());

create policy "collection_items_owner_or_operator"
  on covers_cafe_collection_items for all
  using (
    exists (
      select 1 from covers_cafe_collections c
      where c.id = collection_id and (c.owner_id = auth.uid() or covers_cafe_is_operator())
    )
  )
  with check (
    exists (
      select 1 from covers_cafe_collections c
      where c.id = collection_id and (c.owner_id = auth.uid() or covers_cafe_is_operator())
    )
  );

-- Operator can delete any user's media metadata.
create policy "operators_can_delete_any_cover"
  on covers_cafe_covers for delete
  using (covers_cafe_is_operator());

-- Add a profile table avatar field if missing.
alter table if exists covers_cafe_profiles
  add column if not exists avatar_url text;

-- Grant full operator role to existing account.
insert into covers_cafe_operator_roles (user_id, role)
select id, 'operator' from auth.users where email = 'jakeryanrobison@icloud.com'
on conflict (user_id) do update set role = excluded.role;

-- Allow collections to have a cover/thumbnail image.
alter table covers_cafe_collections
  add column if not exists cover_image_id uuid references covers_cafe_covers(id) on delete set null;

-- Allow anyone to read items from public collections (the original ALL policy only covers owners).
create policy if not exists "collection_items_public_or_owner_can_read"
  on covers_cafe_collection_items for select
  using (
    exists (
      select 1 from covers_cafe_collections c
      where c.id = collection_id
        and (c.is_public or c.owner_id = auth.uid() or covers_cafe_is_operator())
    )
  );
