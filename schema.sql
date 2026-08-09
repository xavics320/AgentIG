-- Esegui questo nell'SQL editor di Supabase

create table content_calendar (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  post_date date not null,
  content_type text not null,        -- es. "behind-the-scenes", "tip tecnico", "showcase progetto"
  topic_summary text not null,       -- breve descrizione generata dall'AI
  status text not null default 'proposed',
  -- stati: proposed -> calendar_approved -> content_generated -> content_approved -> published -> rejected
  created_at timestamptz default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references content_calendar(id),
  caption text,
  image_prompt text,
  image_url text,                    -- URL pubblico dell'immagine (serve a Instagram)
  status text not null default 'pending',
  -- stati: pending -> approved -> published -> rejected
  ig_media_id text,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table telegram_sessions (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  pending_action text,               -- cosa stiamo aspettando: 'approve_calendar', 'approve_content'
  reference_id uuid,                 -- id della riga calendar o post a cui si riferisce
  created_at timestamptz default now()
);
