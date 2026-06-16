-- ============================================================
-- Restaurant Verifications Table & RLS Policies
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create the table
CREATE TABLE restaurant_verifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name text        NOT NULL,
  date            date        NOT NULL,
  party_size      int         NOT NULL,
  status          text        DEFAULT 'pending',
  manual_approval text,
  notes           text,
  verification_data jsonb,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE restaurant_verifications ENABLE ROW LEVEL SECURITY;

-- 3. Allow any authenticated user to SELECT rows
CREATE POLICY "Authenticated users can select"
  ON restaurant_verifications
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Allow any authenticated user to INSERT rows
CREATE POLICY "Authenticated users can insert"
  ON restaurant_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Allow any authenticated user to UPDATE rows
CREATE POLICY "Authenticated users can update"
  ON restaurant_verifications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Auto-update the updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON restaurant_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
