/*
-- Run this in Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  role text default 'user' check (role in ('user', 'superuser')),
  created_at timestamptz default now()
);

create table if not exists journal_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz,
  module text default 'unified',
  ticker text,
  timeframe text,
  chart_source text,
  date date,
  lookback_window int default 3,
  image_path text,
  prompt_version text,
  form_data jsonb,
  user_input jsonb,
  ai_what_i_see jsonb,
  ai_narrative jsonb,
  ai_decision jsonb,
  ai_corrections jsonb default '[]',
  ai_annotation jsonb,
  ai_analysis jsonb,
  decision text,
  confidence text,
  planned_entry numeric,
  planned_sl numeric,
  planned_target numeric,
  planned_rrr numeric,
  actual_entry numeric,
  actual_exit numeric,
  holding_period text,
  exit_price numeric,
  pnl numeric,
  outcome text,
  notes text default '',
  learning_tags jsonb default '[]',
  ai_verdict text,
  chat_history jsonb default '[]'
);

-- Make yourself superuser (run after first login with your username)
-- UPDATE users SET role = 'superuser' WHERE username = 'your_username';
*/

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
module.exports = supabase;
