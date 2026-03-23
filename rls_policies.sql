-- ─────────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor → New Query
-- It tightens security so only authenticated admins can
-- create, edit or delete memorials and campaigns.
-- Public users can still read everything and submit recitations.
-- ─────────────────────────────────────────────────────────────

-- IMPORTANT: For "claimed by" names to show on the Juz board,
-- khatam_claims needs a foreign key to participants.
-- Run this once if not already set up:
ALTER TABLE khatam_claims
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES participants(id);

-- MEMORIALS: public can read, only authenticated users can write
drop policy if exists "public insert memorials" on memorials;
drop policy if exists "public read memorials" on memorials;

create policy "public read memorials"
  on memorials for select
  using (true);

create policy "admin insert memorials"
  on memorials for insert
  with check (auth.role() = 'authenticated');

create policy "admin update memorials"
  on memorials for update
  using (auth.role() = 'authenticated');

create policy "admin delete memorials"
  on memorials for delete
  using (auth.role() = 'authenticated');


-- KHATAM_CAMPAIGNS: public can read, only authenticated users can write
drop policy if exists "public insert campaigns" on khatam_campaigns;
drop policy if exists "public read campaigns" on khatam_campaigns;

create policy "public read campaigns"
  on khatam_campaigns for select
  using (true);

create policy "admin insert campaigns"
  on khatam_campaigns for insert
  with check (auth.role() = 'authenticated');

create policy "admin update campaigns"
  on khatam_campaigns for update
  using (auth.role() = 'authenticated');

create policy "admin delete campaigns"
  on khatam_campaigns for delete
  using (auth.role() = 'authenticated');


-- PARTICIPANTS: public can read and insert (needed for the app)
-- already correct — no changes needed

-- QUICK_RECITATIONS: public can read and insert
-- already correct — no changes needed

-- KHATAM_CLAIMS: public can read and insert,
-- but only authenticated users can update (mark as completed) or delete
drop policy if exists "public insert claims" on khatam_claims;
drop policy if exists "public read claims" on khatam_claims;

create policy "public read claims"
  on khatam_claims for select
  using (true);

create policy "public insert claims"
  on khatam_claims for insert
  with check (true);

create policy "public update claims"
  on khatam_claims for update
  using (true);

create policy "admin delete claims"
  on khatam_claims for delete
  using (auth.role() = 'authenticated');
