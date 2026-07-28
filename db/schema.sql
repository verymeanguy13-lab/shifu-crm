-- Session 3: Database Schema + Row-Level Security
-- 師傅CRM (Shifu CRM)

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  assigned_to BIGINT  -- references team_members(id), added as FK after that table exists
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
-- app.current_business_id for the current session.
-- FORCE ROW LEVEL SECURITY is required because Neon's default
-- role owns these tables, and Postgres exempts table owners
-- from RLS unless FORCE is applied.
-- IMPORTANT: this only works once lib/db.ts (Session 5) sets
-- app.current_business_id in the same round-trip as each query.

-- customers (business_id direct)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE POLICY customers_business_isolation ON customers
  USING (business_id = current_setting('app.current_business_id')::bigint);

-- properties (via customers)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE ROW LEVEL SECURITY;
CREATE POLICY properties_business_isolation ON properties
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

-- quotes (business_id direct)
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY quotes_business_isolation ON quotes
  USING (business_id = current_setting('app.current_business_id')::bigint);

-- quote_line_items (via quotes)
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items FORCE ROW LEVEL SECURITY;
CREATE POLICY quote_line_items_business_isolation ON quote_line_items
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

-- jobs (business_id direct)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY jobs_business_isolation ON jobs
  USING (business_id = current_setting('app.current_business_id')::bigint);

-- job_photos (via jobs)
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY job_photos_business_isolation ON job_photos
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

-- job_notes (via jobs)
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY job_notes_business_isolation ON job_notes
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

-- payments (via jobs)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payments_business_isolation ON payments
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

-- messages (via customers)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY messages_business_isolation ON messages
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

-- reviews (via jobs)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY reviews_business_isolation ON reviews
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE business_id = current_setting('app.current_business_id')::bigint
    )
  );

-- team_members (business_id direct)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;
CREATE POLICY team_members_business_isolation ON team_members
  USING (business_id = current_setting('app.current_business_id')::bigint);

-- parts (business_id direct)
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts FORCE ROW LEVEL SECURITY;
CREATE POLICY parts_business_isolation ON parts
  USING (business_id = current_setting('app.current_business_id')::bigint);
