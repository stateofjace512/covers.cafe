-- 031: Cover moderation / review queue
--
-- Instead of hard-blocking duplicate or official-matched uploads, we now accept
-- them and place them in a "under_review" queue for operator approval.
--
-- Changes:
--   1. Add moderation columns to covers_cafe_covers
--   2. Extend notification type constraint to include moderation events

-- 1. Moderation columns on covers_cafe_covers

alter table public.covers_cafe_covers
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'under_review', 'denied')),
  add column if not exists moderation_reason text,
  add column if not exists moderation_decided_at timestamptz,
  add column if not exists moderation_decided_by uuid references auth.users(id),
  add column if not exists matched_cover_id uuid,
  add column if not exists matched_official_id uuid;

-- Index to make the review queue query fast
create index if not exists covers_cafe_covers_moderation_status_idx
  on public.covers_cafe_covers (moderation_status, created_at desc)
  where moderation_status = 'under_review';

-- 2. Extend notification type constraint

alter table public.covers_cafe_notifications
  drop constraint if exists covers_cafe_notifications_type_check;

alter table public.covers_cafe_notifications
  add constraint covers_cafe_notifications_type_check
  check (type in (
    'favorite',
    'comment',
    'comment_like',
    'comment_reply',
    'cover_removed',
    'friend_posted',
    'new_follower',
    'friend_request',
    'achievement',
    'cover_under_review',
    'cover_approved',
    'cover_denied'
  ));
