-- Migration 010: Learn module — perceptual training engine
-- Run in Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────
-- 1. PATTERN REFERENCE TABLE
-- ─────────────────────────────────────────
create table if not exists public.learn_patterns (
  id uuid not null default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  category text not null,
  description text null,
  created_at timestamp with time zone default now(),
  constraint learn_patterns_pkey primary key (id)
);

insert into public.learn_patterns (slug, display_name, category) values
  ('hammer', 'Hammer', 'candlestick'),
  ('hanging_man', 'Hanging Man', 'candlestick'),
  ('doji', 'Doji', 'candlestick'),
  ('dragonfly_doji', 'Dragonfly Doji', 'candlestick'),
  ('gravestone_doji', 'Gravestone Doji', 'candlestick'),
  ('spinning_top', 'Spinning Top', 'candlestick'),
  ('bullish_engulfing', 'Bullish Engulfing', 'candlestick'),
  ('bearish_engulfing', 'Bearish Engulfing', 'candlestick'),
  ('morning_star', 'Morning Star', 'candlestick'),
  ('evening_star', 'Evening Star', 'candlestick'),
  ('shooting_star', 'Shooting Star', 'candlestick'),
  ('inverted_hammer', 'Inverted Hammer', 'candlestick'),
  ('bullish_harami', 'Bullish Harami', 'candlestick'),
  ('bearish_harami', 'Bearish Harami', 'candlestick'),
  ('piercing_line', 'Piercing Line', 'candlestick'),
  ('dark_cloud_cover', 'Dark Cloud Cover', 'candlestick'),
  ('three_white_soldiers', 'Three White Soldiers', 'candlestick'),
  ('three_black_crows', 'Three Black Crows', 'candlestick'),
  ('marubozu_bullish', 'Bullish Marubozu', 'candlestick'),
  ('marubozu_bearish', 'Bearish Marubozu', 'candlestick'),
  ('tweezer_top', 'Tweezer Top', 'candlestick'),
  ('tweezer_bottom', 'Tweezer Bottom', 'candlestick'),
  ('inside_bar', 'Inside Bar', 'candlestick'),
  ('outside_bar', 'Outside Bar', 'candlestick'),
  ('abandoned_baby', 'Abandoned Baby', 'candlestick'),
  ('rising_three', 'Rising Three Methods', 'candlestick'),
  ('falling_three', 'Falling Three Methods', 'candlestick'),
  ('volume_climax', 'Volume Climax', 'volume'),
  ('volume_dry_up', 'Volume Dry Up', 'volume'),
  ('support_level', 'Support Level', 'sr'),
  ('resistance_level', 'Resistance Level', 'sr'),
  ('trendline_support', 'Trendline Support', 'trend'),
  ('higher_high_low', 'Higher Highs and Lows', 'trend')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────
-- 2. CONCEPT INTAKE
-- ─────────────────────────────────────────
create table if not exists public.learn_intake (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  pattern_slug text not null,
  source_note text null,
  created_at timestamp with time zone default now(),
  first_drilled_at timestamp with time zone null,
  migrated_to_track1_at timestamp with time zone null,
  drill_count integer not null default 0,
  constraint learn_intake_pkey primary key (id),
  constraint learn_intake_user_id_fkey foreign key (user_id)
    references users (id) on delete cascade,
  constraint learn_intake_pattern_slug_fkey foreign key (pattern_slug)
    references learn_patterns (slug)
);

-- ─────────────────────────────────────────
-- 3. LEARN SESSIONS
-- ─────────────────────────────────────────
create table if not exists public.learn_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone null,
  session_type text not null default 'adaptive',
  focus_patterns text[] null,
  chart_count integer not null default 10,
  triggered_by text null default 'manual',
  nudge_id uuid null,
  detection_score numeric null,
  classification_score numeric null,
  calibration_score numeric null,
  false_positive_count integer null default 0,
  high_confidence_wrong_count integer null default 0,
  ai_evaluation text null,
  ai_evaluation_at timestamp with time zone null,
  constraint learn_sessions_pkey primary key (id),
  constraint learn_sessions_user_id_fkey foreign key (user_id)
    references users (id) on delete cascade
);

-- ─────────────────────────────────────────
-- 4. LEARN CHARTS
-- ─────────────────────────────────────────
create table if not exists public.learn_charts (
  id uuid not null default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now(),
  chart_index integer not null,
  chart_type text not null,
  pattern_slug text null,
  pattern_present boolean not null default false,
  clarity_level text not null,
  trend_context text not null,
  volume_character text not null,
  sr_proximity text not null,
  outcome_direction text not null,
  ohlc_data jsonb not null default '[]'::jsonb,
  sr_levels jsonb null default '[]'::jsonb,
  volume_data jsonb not null default '[]'::jsonb,
  user_detection text null,
  user_pattern_slug text null,
  user_confidence text null,
  user_notes text null,
  user_concepts_noted text[] null,
  answered_at timestamp with time zone null,
  detection_correct boolean null,
  classification_correct boolean null,
  confidence_appropriate boolean null,
  constraint learn_charts_pkey primary key (id),
  constraint learn_charts_session_id_fkey foreign key (session_id)
    references learn_sessions (id) on delete cascade,
  constraint learn_charts_user_id_fkey foreign key (user_id)
    references users (id) on delete cascade,
  constraint learn_charts_pattern_slug_fkey foreign key (pattern_slug)
    references learn_patterns (slug),
  constraint learn_charts_chart_index_unique
    unique (session_id, chart_index)
);

-- ─────────────────────────────────────────
-- 5. NUDGE QUEUE
-- ─────────────────────────────────────────
create table if not exists public.learn_nudges (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamp with time zone default now(),
  trigger_type text not null,
  pattern_slug text null,
  metric_name text null,
  metric_value numeric null,
  threshold_value numeric null,
  message text not null,
  recommended_focus text[] null,
  status text not null default 'pending',
  dismissed_at timestamp with time zone null,
  acted_on_at timestamp with time zone null,
  resulting_session_id uuid null,
  constraint learn_nudges_pkey primary key (id),
  constraint learn_nudges_user_id_fkey foreign key (user_id)
    references users (id) on delete cascade,
  constraint learn_nudges_pattern_slug_fkey foreign key (pattern_slug)
    references learn_patterns (slug),
  constraint learn_nudges_resulting_session_fkey foreign key (resulting_session_id)
    references learn_sessions (id)
);

-- ─────────────────────────────────────────
-- 6. PATTERN PERFORMANCE VIEW
-- ─────────────────────────────────────────
create or replace view public.learn_pattern_performance as
select
  lc.user_id,
  lc.pattern_slug,
  lp.display_name,
  lp.category,
  count(*) as total_exposures,
  count(*) filter (where lc.pattern_present = true) as total_present,
  count(*) filter (where lc.detection_correct = true) as detection_correct_count,
  count(*) filter (where lc.classification_correct = true) as classification_correct_count,
  count(*) filter (where lc.pattern_present = false and lc.user_detection = 'yes')
    as false_positive_count,
  count(*) filter (where lc.user_confidence = 'HIGH' and lc.detection_correct = false)
    as high_confidence_wrong_count,
  round(
    count(*) filter (where lc.pattern_present = true and lc.detection_correct = true)::numeric /
    nullif(count(*) filter (where lc.pattern_present = true), 0) * 100, 1
  ) as detection_rate_pct,
  round(
    count(*) filter (where lc.pattern_present = false and lc.user_detection = 'yes')::numeric /
    nullif(count(*) filter (where lc.pattern_present = false), 0) * 100, 1
  ) as false_positive_rate_pct,
  max(lc.created_at) as last_drilled_at
from public.learn_charts lc
left join public.learn_patterns lp on lp.slug = lc.pattern_slug
group by lc.user_id, lc.pattern_slug, lp.display_name, lp.category;

-- ─────────────────────────────────────────
-- 7. CALIBRATION VIEW
-- ─────────────────────────────────────────
create or replace view public.learn_calibration as
select
  user_id,
  user_confidence,
  count(*) as total_calls,
  count(*) filter (where detection_correct = true) as correct_calls,
  round(
    count(*) filter (where detection_correct = true)::numeric /
    nullif(count(*), 0) * 100, 1
  ) as accuracy_pct
from public.learn_charts
where user_confidence is not null
  and answered_at is not null
group by user_id, user_confidence;

-- ─────────────────────────────────────────
-- 8. JOURNAL-LEARN BRIDGE VIEW
-- ─────────────────────────────────────────
create or replace view public.learn_journal_bridge as
with journal_patterns as (
  select
    js.user_id,
    js.ai_what_i_see->'candlePattern'->>'name' as pattern_name,
    count(*) as journal_encounters,
    count(*) filter (where js.decision = 'Take') as journal_takes,
    round(
      count(*) filter (where js.decision = 'Take')::numeric /
      nullif(count(*), 0) * 100, 1
    ) as journal_action_rate_pct
  from public.journal_sessions js
  where js.ai_what_i_see is not null
    and js.ai_what_i_see->'candlePattern'->>'name' is not null
  group by js.user_id, js.ai_what_i_see->'candlePattern'->>'name'
),
learn_performance as (
  select
    user_id,
    pattern_slug,
    detection_rate_pct,
    false_positive_rate_pct
  from public.learn_pattern_performance
)
select
  jp.user_id,
  jp.pattern_name,
  jp.journal_encounters,
  jp.journal_action_rate_pct,
  lp.detection_rate_pct as learn_detection_rate_pct,
  case
    when lp.detection_rate_pct >= 70 and jp.journal_action_rate_pct < 40
      then 'conviction_gap'
    when lp.detection_rate_pct < 60 and jp.journal_encounters > 3
      then 'recognition_gap'
    when lp.detection_rate_pct >= 70 and jp.journal_action_rate_pct >= 40
      then 'performing'
    else 'insufficient_data'
  end as diagnostic
from journal_patterns jp
left join learn_performance lp
  on lp.user_id = jp.user_id
  and lp.pattern_slug = replace(lower(jp.pattern_name), ' ', '_');

-- ─────────────────────────────────────────
-- 9. INDEXES
-- ─────────────────────────────────────────
create index if not exists learn_sessions_user_id_idx
  on public.learn_sessions (user_id, created_at desc);

create index if not exists learn_charts_session_id_idx
  on public.learn_charts (session_id);

create index if not exists learn_charts_user_pattern_idx
  on public.learn_charts (user_id, pattern_slug);

create index if not exists learn_nudges_user_status_idx
  on public.learn_nudges (user_id, status)
  where status = 'pending';

create index if not exists learn_intake_user_undrilled_idx
  on public.learn_intake (user_id, first_drilled_at)
  where first_drilled_at is null;
