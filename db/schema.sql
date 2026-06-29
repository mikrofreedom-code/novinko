-- NOVINKO REDAKCIA — SOURCES (profily zdrojov; queue naň ukazuje FK, preto PRVÉ)
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  layer text check (layer in ('A','B','C')),          -- A=dáta, B=primárne oznámenia, C=rozšírené primárne
  source_type text not null default 'primary'
    check (source_type in ('primary','secondary')),
  trust_score numeric(3,2) not null default 0.50,     -- 0..1, dôvera v zdroj
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_sources_active on public.sources (is_active);

-- NOVINKO REDAKCIA — QUEUE (Event Bus = status machine)
create table if not exists public.queue (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'raw' check (status in (
    'raw','filtered','collected','facts_ready','clustered',
    'written','proofed','legal_ok','seo_done','imaged','published',
    'merged','rejected','error'
  )),
  source_id uuid references public.sources(id),
  raw_data jsonb,
  cluster_id uuid,
  facts jsonb,
  article jsonb,
  image_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_queue_status on public.queue (status);
create index if not exists idx_queue_cluster on public.queue (cluster_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_queue_touch on public.queue;
create trigger trg_queue_touch before update on public.queue
  for each row execute function public.touch_updated_at();

create table if not exists public.ai_cost_log (
  id uuid primary key default gen_random_uuid(),
  agent text, model text, input_tokens int, output_tokens int,
  cost_usd numeric(10,6), queue_id uuid references public.queue(id),
  created_at timestamptz not null default now()
);
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  agent text, action text, queue_id uuid references public.queue(id),
  detail jsonb, created_at timestamptz not null default now()
);
alter table public.sources enable row level security;
alter table public.queue enable row level security;
alter table public.ai_cost_log enable row level security;
alter table public.audit_log enable row level security;
