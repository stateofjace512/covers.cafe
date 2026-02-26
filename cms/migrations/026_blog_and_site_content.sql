-- Migration 026: Blog posts + editable site content

-- ── Blog posts ─────────────────────────────────────────────────────────────

create table covers_cafe_blog_posts (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  title       text        not null,
  body        text        not null default '',
  author_user_id uuid     not null references auth.users(id) on delete set null,
  author_username text,
  published   boolean     not null default false,
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Only operators can write; anyone can read published posts
alter table covers_cafe_blog_posts enable row level security;

create policy "blog_public_read"
  on covers_cafe_blog_posts for select
  using (published = true);

create policy "blog_operators_all"
  on covers_cafe_blog_posts for all
  using (covers_cafe_is_operator());

-- Auto-update updated_at
create or replace function covers_cafe_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger blog_posts_updated_at
  before update on covers_cafe_blog_posts
  for each row execute function covers_cafe_set_updated_at();

-- ── Site content (editable page copy) ─────────────────────────────────────

create table covers_cafe_site_content (
  key         text        primary key,
  value       text        not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users(id) on delete set null
);

alter table covers_cafe_site_content enable row level security;

-- Anyone can read site content
create policy "site_content_public_read"
  on covers_cafe_site_content for select
  using (true);

-- Only operators can write
create policy "site_content_operators_write"
  on covers_cafe_site_content for all
  using (covers_cafe_is_operator());

-- Seed the About page text so it's immediately editable
insert into covers_cafe_site_content (key, value) values (
  'about_body',
  'We know this space is watched.
By labels. By copyright offices. By the fans.

We know album art matters; it matters to artists, to labels, and to the fans who live with it. It''s not just a symbolic image. It''s something people sit with. Something that becomes heritage. Lineage. Something they pass down like heirlooms. Something they obsess over, reinterpret, rearrange, and carry across devices and years.

Album art holds deep connections to the hands of the artists  -  yes  -  but also the fans, who cherry pick and idealize and scrape at metaphoric varnish on digital art until they see it in a clear light.

We''re not here to replace the official channels. We''re here because fans deserve a clean, dedicated place built specifically for album cover culture, and not one buried inside platforms that were never designed for it.

Other systems weren''t built for this use case. They struggle with spam, fragmentation, tracking-heavy environments, or chaos. We built something focused, moderated, and intentional.

We love our users. We built this for people who care about their libraries, who care about presentation, who care about the art as much as the audio.

There will always be other places to run to.
We built this one out in the wild.

So drop your bags at the front door, and get comfortable.'
) on conflict (key) do nothing;
