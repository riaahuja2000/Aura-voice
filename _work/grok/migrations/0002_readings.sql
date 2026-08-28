-- VELORA reading sessions. Per-user rows; owner dashboard reads all via a
-- dedicated owner-gated server function (email checked server-side).
create table if not exists readings (
  id          serial primary key,
  user_id     text not null,
  question    text not null,
  answer      text not null,
  topics      text not null default '[]',
  lang        text not null default 'en',
  created_at  timestamptz not null default now()
);

create index if not exists readings_user_id_idx on readings (user_id);
create index if not exists readings_created_at_idx on readings (created_at desc);
