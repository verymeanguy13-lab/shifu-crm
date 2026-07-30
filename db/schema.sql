-- schema.sql — kept in sync with the ACTUAL production database.
-- Session 3 created the original 14 tables + RLS. Everything marked
-- "Added Session N" below was run directly in Neon's SQL Editor during
-- later sessions and is folded in here so this file always reflects
-- reality. If you add a column/table by hand again, add it here too
-- in the same session.

-- =========================================================
-- TABLES
-- =========================================================

CREATE TABLE businesses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  statement_number TEXT,           -- 統編
  line_channel_token TEXT,
  line_channel_secret TEXT,
  trade_types TEXT[] DEFAULT '{}',
  service_area TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Added Session 6 (auth) — businesses doubles as the login/user table:
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  -- Added Session 8 (LINE webhook routing) — the bot's own LINE user ID,
  -- used to identify which business a shared webhook URL's event belongs to:
  line_bot_user_id TEXT,
  -- Added Session 9 (business settings):
  logo_url TEXT,
  default_warranty_months JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Added Session 8 — links a LINE contact to a customer record, scoped
  -- per-business (the same LINE account could message different businesses):
  line_user_id TEXT
);

CREATE TABLE properties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  access_notes TEXT,
  billing_contact_id BIGINT REFERENCES customers(id)
);

CREATE TABLE service_templates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  trade_type TEXT NOT NULL,
  name TEXT NOT NULL,
  default_price NUMERIC(10, 2) NOT NULL,
  unit TEXT,
  category TEXT,
  default_duration_minutes INTEGER,
  default_warranty_months INTEGER
);

CREATE TABLE quotes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES properties(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'expired', 'declined')),
  lead_source TEXT,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  accept_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE quote_line_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quote_id BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT CHECK (category IN ('labor', 'materials')),
  qty NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE jobs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quote_id BIGINT REFERENCES quotes(id),
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES properties(id),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  warranty_until DATE,
  recurrence_rule TEXT,
  assigned_to BIGINT
);

CREATE TABLE job_photos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('before', 'after')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,
  transfer_reference TEXT
);

CREATE TABLE messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT,
  line_message_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  review_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'helper' CHECK (role IN ('owner', 'helper')),
  line_user_id TEXT
);

ALTER TABLE jobs
  ADD CONSTRAINT jobs_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES team_members(id);

CREATE TABLE parts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_jobs_business_id_scheduled_at ON jobs(business_id, scheduled_at);
CREATE INDEX idx_payments_job_id ON payments(job_id);
CREATE INDEX idx_quotes_business_id_status ON quotes(business_id, status);

-- =========================================================
-- ROW-LEVEL SECURITY
-- =========================================================
-- Every policy restricts rows to the business_id stored in
-- app.current_business_id for the current session (set atomically by
-- lib/db.ts's queryUnsafe() via set_config() in the same transaction()
-- round-trip as the query itself — see lib/db.ts for why).
--
-- businesses itself has NO RLS — it IS the tenant root / login table.
--
-- CRITICAL NEON-SPECIFIC GOTCHA: the default `neondb_owner` role has
-- BYPASSRLS baked in permanently. FORCE ROW LEVEL SECURITY only closes
-- the table-OWNER bypass loophole — it does nothing against a role with
-- the separate BYPASSRLS attribute. The app's DATABASE_URL must use a
-- SEPARATE role with no BYPASSRLS (app_user, created below), or every
-- policy here is silently inert. neondb_owner is reserved for running
-- migrations only, never for the running app.

-- (app_user was already created by hand — this is here for reference /
-- disaster recovery, not meant to be re-run since the role now exists.)
-- CREATE ROLE app_user LOGIN PASSWORD '<set via Neon dashboard>';
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE POLICY customers_business_isolation ON customers
  USING (business_id = current_setting('app.current_business_id')::bigint);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE ROW LEVEL SECURITY;
CREATE POLICY properties_business_isolation ON properties
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY quotes_business_isolation ON quotes
  USING (business_id = current_setting('app.current_business_id')::bigint);

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items FORCE ROW LEVEL SECURITY;
CREATE POLICY quote_line_items_business_isolation ON quote_line_items
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY jobs_business_isolation ON jobs
  USING (business_id = current_setting('app.current_business_id')::bigint);

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY job_photos_business_isolation ON job_photos
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY job_notes_business_isolation ON job_notes
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payments_business_isolation ON payments
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY messages_business_isolation ON messages
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY reviews_business_isolation ON reviews
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;
CREATE POLICY team_members_business_isolation ON team_members
  USING (business_id = current_setting('app.current_business_id')::bigint);

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts FORCE ROW LEVEL SECURITY;
CREATE POLICY parts_business_isolation ON parts
  USING (business_id = current_setting('app.current_business_id')::bigint);
