-- Migration: add username and display name change tracking columns
-- Run this in your Supabase SQL editor (or via the Supabase CLI).
--
-- These JSONB columns store ISO-8601 timestamp arrays that the
-- update-username and update-profile API endpoints read/write to
-- enforce per-user rate limits:
--
--   username_change_log      → max 2 changes per 14-day rolling window
--   display_name_change_log  → max 5 changes per 30-day rolling window
--
-- The columns default to an empty array so existing rows work immediately.

ALTER TABLE covers_cafe_profiles
  ADD COLUMN IF NOT EXISTS username_change_log    JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS display_name_change_log JSONB NOT NULL DEFAULT '[]'::jsonb;
