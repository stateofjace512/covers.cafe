-- 023: allow public reads of accepted friendships
-- Without this, anon-key clients can't see accepted friends on other users'
-- profiles (RLS only allowed reads where auth.uid() is a party).
-- Postgres ORs multiple permissive SELECT policies together, so this adds
-- to the existing friends_read_own policy rather than replacing it.

create policy "friends_read_accepted_public"
  on public.covers_cafe_friends
  for select
  using (status = 'accepted');
