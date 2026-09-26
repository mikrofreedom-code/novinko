-- Evidencia tém rubriky Záhady a fenomény. Aplikovať pred nasadením kódu.
-- Publikovaný text zostáva v Google Sheete; article_id odkazuje na jeho stĺpec A.
create table if not exists public.mystery_topics (
  topic_id uuid primary key default gen_random_uuid(),
  canonical_topic text not null,
  canonical_key text not null unique,
  aliases text[] not null default '{}',
  category text not null default 'zahady' check (category = 'zahady'),
  subcategory text not null,
  country text,
  location text,
  historical_period text,
  persons text[] not null default '{}',
  main_entities text[] not null default '{}',
  keywords text[] not null default '{}',
  topic_type text not null check (topic_type in ('F','M','H','L','E','N')),
  series text,
  published boolean not null default false,
  published_at timestamptz,
  article_id text unique,
  last_updated timestamptz not null default now(),
  source_quality integer check (source_quality between 0 and 100),
  evergreen_score integer check (evergreen_score between 0 and 100),
  interest_score integer check (interest_score between 0 and 100),
  duplication_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mystery_topics_subcategory on public.mystery_topics (subcategory);
create index if not exists idx_mystery_topics_published on public.mystery_topics (published, published_at desc);
create index if not exists idx_mystery_topics_aliases on public.mystery_topics using gin (aliases);

-- Jedna téma môže mať viac článkov iba pri doloženom novom vývoji alebo
-- výrazne inom redakčnom uhle. Primárny article_id hore ostáva prvý článok.
create table if not exists public.mystery_topic_articles (
  article_id text primary key,
  topic_id uuid not null references public.mystery_topics(topic_id) on delete restrict,
  editorial_angle text,
  published_at timestamptz not null,
  last_updated timestamptz not null default now()
);
create index if not exists idx_mystery_topic_articles_topic on public.mystery_topic_articles (topic_id);

alter table public.mystery_topics enable row level security;
alter table public.mystery_topic_articles enable row level security;
revoke all on public.mystery_topics from anon, authenticated;
revoke all on public.mystery_topic_articles from anon, authenticated;
grant all privileges on public.mystery_topics to service_role;
grant all privileges on public.mystery_topic_articles to service_role;
-- Žiadna verejná RLS politika: zápis a čítanie evidencie má iba serverový service_role.
