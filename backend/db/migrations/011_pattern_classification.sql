-- Migration 011: bias classification for the existing 33 patterns, plus 12
-- new reversal/continuation chart patterns (Head & Shoulders, Double/Triple
-- Top/Bottom, Saucer/Spike, Triangle, Flag/Pennant, Wedge, Rectangle).
-- Run in Supabase Dashboard → SQL Editor

alter table public.learn_patterns
  add column if not exists bias_category text
    check (bias_category in ('bullish', 'bearish', 'indecision', 'context_dependent')),
  add column if not exists structure_type text
    check (structure_type in ('reversal', 'continuation'));

-- ── Bias classification for the existing 33 patterns ──

update public.learn_patterns set bias_category = 'bullish' where slug in (
  'hammer', 'dragonfly_doji', 'bullish_engulfing', 'morning_star', 'inverted_hammer',
  'bullish_harami', 'piercing_line', 'three_white_soldiers', 'marubozu_bullish',
  'tweezer_bottom', 'rising_three', 'support_level', 'trendline_support', 'higher_high_low'
);

update public.learn_patterns set bias_category = 'bearish' where slug in (
  'hanging_man', 'gravestone_doji', 'bearish_engulfing', 'evening_star', 'shooting_star',
  'bearish_harami', 'dark_cloud_cover', 'three_black_crows', 'marubozu_bearish',
  'tweezer_top', 'falling_three', 'resistance_level'
);

update public.learn_patterns set bias_category = 'indecision' where slug in (
  'doji', 'spinning_top', 'inside_bar', 'outside_bar', 'volume_dry_up'
);

update public.learn_patterns set bias_category = 'context_dependent' where slug = 'volume_climax';

-- Abandoned Baby had two directional variants baked into a single slug —
-- split it (backend/lib/learn/generators.js now draws from the two split
-- slugs below instead). The original row is left in place, untouched, so
-- any historical learn_charts rows referencing it don't break their FK.
insert into public.learn_patterns (slug, display_name, category, bias_category) values
  ('abandoned_baby_bullish', 'Abandoned Baby (Bullish)', 'candlestick', 'bullish'),
  ('abandoned_baby_bearish', 'Abandoned Baby (Bearish)', 'candlestick', 'bearish')
on conflict (slug) do nothing;

-- ── New reversal / continuation chart patterns ──

insert into public.learn_patterns (slug, display_name, category, bias_category, structure_type) values
  ('head_shoulders',          'Head and Shoulders',         'chart_pattern', 'bearish',    'reversal'),
  ('inverse_head_shoulders',  'Inverse Head and Shoulders', 'chart_pattern', 'bullish',    'reversal'),
  ('double_top',              'Double Top',                 'chart_pattern', 'bearish',    'reversal'),
  ('double_bottom',           'Double Bottom',               'chart_pattern', 'bullish',    'reversal'),
  ('triple_top',              'Triple Top',                  'chart_pattern', 'bearish',    'reversal'),
  ('triple_bottom',           'Triple Bottom',               'chart_pattern', 'bullish',    'reversal'),
  ('saucer_bottom',           'Saucer Bottom',                'chart_pattern', 'bullish',    'reversal'),
  ('spike_top',               'Spike Top',                    'chart_pattern', 'bearish',    'reversal'),
  ('triangle',                'Triangle',                     'chart_pattern', 'indecision', 'continuation'),
  ('flag_pennant',            'Flag / Pennant',               'chart_pattern', 'indecision', 'continuation'),
  ('wedge',                   'Wedge',                        'chart_pattern', 'indecision', 'continuation'),
  ('rectangle',               'Rectangle',                    'chart_pattern', 'indecision', 'continuation')
on conflict (slug) do nothing;
