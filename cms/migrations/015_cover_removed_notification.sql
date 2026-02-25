-- 015: Add cover_removed notification type
-- Allows operators to send removal notifications to cover owners via perma-unpublish

alter table public.covers_cafe_notifications
  drop constraint covers_cafe_notifications_type_check;

alter table public.covers_cafe_notifications
  add constraint covers_cafe_notifications_type_check
  check (type in ('favorite', 'comment', 'comment_like', 'comment_reply', 'cover_removed'));
