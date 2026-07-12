-- ============================================================================
-- RigFile — Single-driver DOT compliance calendar & audit-ready DQF generator
-- ============================================================================
-- Shared ZeroOrigine Postgres database: EVERY object is prefixed `rigfile_`.
--
-- KERNEL: rigfile_dqf_items — the per-driver tracking row for each of the 18
-- federally-defined Driver Qualification File items. Everything else supports
-- this table: drivers own items, item_types define the 18 items, audit_files
-- record generated audit-ready PDFs.
--
-- Core tables (4): rigfile_drivers, rigfile_dqf_items, rigfile_audit_files,
--                  rigfile_dqf_item_types (reference).
-- Infra tables (4): rigfile_profiles, rigfile_subscriptions, rigfile_payments,
--                   rigfile_stripe_events (webhook idempotency).
--
-- Plans (enforced in app layer): free = 1 driver, calendar only;
-- solo = 1 driver + unlimited audit PDFs; fleet = up to 10 drivers.
-- ============================================================================


-- ============================================================================
-- 1. ENUMS (all prefixed to avoid shared-DB collisions)
-- ============================================================================

CREATE TYPE rigfile_user_role AS ENUM ('user', 'admin');

CREATE TYPE rigfile_driver_status AS ENUM ('active', 'inactive');

CREATE TYPE rigfile_dqf_item_status AS ENUM (
  'valid',           -- document on file, not near expiration
  'expiring_soon',   -- inside the user's reminder window (default 30 days)
  'expired',         -- past expiration date = audit fine exposure
  'missing',         -- no document on file yet
  'not_applicable'   -- conditional item that does not apply to this driver
);

CREATE TYPE rigfile_plan AS ENUM ('free', 'solo', 'fleet');

CREATE TYPE rigfile_subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

CREATE TYPE rigfile_payment_status AS ENUM (
  'pending', 'succeeded', 'failed', 'refunded'
);


-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 Profiles — extends auth.users (keyed by id = auth.uid())
-- ---------------------------------------------------------------------------
CREATE TABLE rigfile_profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id          text NOT NULL DEFAULT 'rigfile' CHECK (product_id = 'rigfile'),
  email               text,
  full_name           text NOT NULL DEFAULT '',
  company_name        text,
  dot_number          text,   -- USDOT number (text: leading zeros are meaningful)
  mc_number           text,
  phone               text,
  timezone            text NOT NULL DEFAULT 'America/Chicago',
  reminder_lead_days  integer NOT NULL DEFAULT 30
                        CHECK (reminder_lead_days BETWEEN 1 AND 365),
  role                rigfile_user_role NOT NULL DEFAULT 'user',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE rigfile_profiles IS
  'Operator profile extending auth.users. reminder_lead_days drives the expiring_soon window.';

-- ---------------------------------------------------------------------------
-- 2.2 DQF item types — reference table: the 18 federal DQF items (seeded below)
-- ---------------------------------------------------------------------------
CREATE TABLE rigfile_dqf_item_types (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL UNIQUE,
  name                     text NOT NULL,
  description              text NOT NULL,
  cfr_reference            text NOT NULL,   -- e.g. '49 CFR 391.21'
  default_validity_months  integer CHECK (default_validity_months IS NULL
                                           OR default_validity_months > 0),
  can_expire               boolean NOT NULL DEFAULT false,
  is_conditional           boolean NOT NULL DEFAULT false, -- applies only to some drivers
  sort_order               integer NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE rigfile_dqf_item_types IS
  'The 18 Driver Qualification File items per 49 CFR Part 391 and related parts. Read-only reference data.';

-- ---------------------------------------------------------------------------
-- 2.3 Drivers — 1 row per driver (owner-operator = usually exactly 1)
-- ---------------------------------------------------------------------------
CREATE TABLE rigfile_drivers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  product_id         text NOT NULL DEFAULT 'rigfile' CHECK (product_id = 'rigfile'),
  first_name         text NOT NULL,
  last_name          text NOT NULL,
  is_owner_operator  boolean NOT NULL DEFAULT false, -- "this driver is me"
  date_of_birth      date,
  hire_date          date,
  cdl_number         text,
  cdl_state          text CHECK (cdl_state IS NULL OR char_length(cdl_state) = 2),
  cdl_class          text CHECK (cdl_class IS NULL OR cdl_class IN ('A', 'B', 'C')),
  status             rigfile_driver_status NOT NULL DEFAULT 'active',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- Composite key so child tables can enforce same-tenant driver linkage:
  CONSTRAINT rigfile_drivers_id_user_unique UNIQUE (id, user_id)
);

COMMENT ON TABLE rigfile_drivers IS
  'Drivers tracked by an operator. Creating a driver auto-seeds all 18 DQF item rows via trigger.';

-- ---------------------------------------------------------------------------
-- 2.4 DQF items — THE KERNEL: one tracking row per (driver, item type)
-- ---------------------------------------------------------------------------
CREATE TABLE rigfile_dqf_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  product_id            text NOT NULL DEFAULT 'rigfile' CHECK (product_id = 'rigfile'),
  driver_id             uuid NOT NULL,
  item_type_id          uuid NOT NULL REFERENCES rigfile_dqf_item_types(id),
  status                rigfile_dqf_item_status NOT NULL DEFAULT 'missing',
  issued_on             date,
  expires_on            date,                 -- NULL = non-expiring item
  document_path         text,                 -- Supabase Storage path (bucket: rigfile-documents)
  document_name         text,
  document_uploaded_at  timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- Cross-tenant integrity: the driver row must belong to the same user.
  CONSTRAINT rigfile_dqf_items_driver_fk
    FOREIGN KEY (driver_id, user_id)
    REFERENCES rigfile_drivers(id, user_id) ON DELETE CASCADE,
  CONSTRAINT rigfile_dqf_items_unique_per_driver UNIQUE (driver_id, item_type_id),
  CONSTRAINT rigfile_dqf_items_date_order
    CHECK (issued_on IS NULL OR expires_on IS NULL OR expires_on >= issued_on)
);

COMMENT ON TABLE rigfile_dqf_items IS
  'Kernel table: current status of each of the 18 DQF items per driver. Status is auto-computed by trigger from expires_on and document presence.';

-- ---------------------------------------------------------------------------
-- 2.5 Audit files — record of every generated audit-ready PDF (the core action)
-- ---------------------------------------------------------------------------
CREATE TABLE rigfile_audit_files (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  product_id           text NOT NULL DEFAULT 'rigfile' CHECK (product_id = 'rigfile'),
  driver_id            uuid NOT NULL,
  driver_name          text NOT NULL,        -- denormalized: audit record survives renames
  file_name            text NOT NULL,
  storage_path         text,                 -- Supabase Storage path of the generated PDF
  items_total          integer NOT NULL DEFAULT 0,
  items_valid          integer NOT NULL DEFAULT 0,
  items_expiring_soon  integer NOT NULL DEFAULT 0,
  items_expired        integer NOT NULL DEFAULT 0,
  items_missing        integer NOT NULL DEFAULT 0,
  items_snapshot       jsonb NOT NULL DEFAULT '[]'::jsonb, -- full item state at generation time
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rigfile_audit_files_driver_fk
    FOREIGN KEY (driver_id, user_id)
    REFERENCES rigfile_drivers(id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE rigfile_audit_files IS
  'Immutable-in-spirit log of generated audit-ready DQF PDFs, with a point-in-time snapshot of all item statuses.';

-- ---------------------------------------------------------------------------
-- 2.6 Subscriptions — Stripe billing state (1 row per user, auto-created free)
-- ---------------------------------------------------------------------------
CREATE TABLE rigfile_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id              text NOT NULL DEFAULT 'rigfile' CHECK (product_id = 'rigfile'),
  stripe_customer_id      text UNIQUE,
  stripe_subscription_id  text UNIQUE,
  stripe_price_id         text,
  plan                    rigfile_plan NOT NULL DEFAULT 'free',
  status                  rigfile_subscription_status NOT NULL DEFAULT 'active',
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rigfile_subscriptions_user_unique UNIQUE (user_id)
);

COMMENT ON TABLE rigfile_subscriptions IS
  'One row per user. handle_new_user auto-creates a free/active row; Stripe webhook (service role) upgrades it. Stripe is source of truth for entitlements.';

-- ---------------------------------------------------------------------------
-- 2.7 Payments — one-time charges (e.g. single audit-file purchase)
-- ---------------------------------------------------------------------------
CREATE TABLE rigfile_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id                  text NOT NULL DEFAULT 'rigfile' CHECK (product_id = 'rigfile'),
  stripe_payment_intent_id    text UNIQUE,
  stripe_checkout_session_id  text,
  amount_cents                integer NOT NULL CHECK (amount_cents >= 0),
  currency                    text NOT NULL DEFAULT 'usd',
  status                      rigfile_payment_status NOT NULL DEFAULT 'pending',
  description                 text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2.8 Stripe events — webhook idempotency ledger (service-role only)
-- ---------------------------------------------------------------------------
CREATE TABLE rigfile_stripe_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          text NOT NULL UNIQUE,   -- Stripe evt_... id: dedupes webhook retries
  event_type        text NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at      timestamptz,
  processing_error  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE rigfile_stripe_events IS
  'Webhook idempotency: INSERT ... ON CONFLICT (event_id) DO NOTHING before processing. RLS on, no policies = service role only.';


-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Profiles
CREATE INDEX idx_rigfile_profiles_email ON rigfile_profiles (email);

-- Drivers (FK: user_id)
CREATE INDEX idx_rigfile_drivers_user_id ON rigfile_drivers (user_id);
CREATE INDEX idx_rigfile_drivers_user_active ON rigfile_drivers (user_id)
  WHERE status = 'active';

-- DQF items (FKs: user_id, driver_id via unique(driver_id,item_type_id), item_type_id)
CREATE INDEX idx_rigfile_dqf_items_user_id ON rigfile_dqf_items (user_id);
CREATE INDEX idx_rigfile_dqf_items_item_type_id ON rigfile_dqf_items (item_type_id);
CREATE INDEX idx_rigfile_dqf_items_user_status ON rigfile_dqf_items (user_id, status);
-- The compliance calendar query: "everything with a date, soonest first"
CREATE INDEX idx_rigfile_dqf_items_user_expires ON rigfile_dqf_items (user_id, expires_on)
  WHERE expires_on IS NOT NULL;
-- Daily reminder cron: items needing attention across all users
CREATE INDEX idx_rigfile_dqf_items_attention ON rigfile_dqf_items (expires_on)
  WHERE status IN ('expiring_soon', 'expired');
-- NOTE: driver_id lookups are served by the UNIQUE (driver_id, item_type_id) index.

-- Audit files (FKs: user_id, driver_id)
CREATE INDEX idx_rigfile_audit_files_user_created ON rigfile_audit_files (user_id, created_at DESC);
CREATE INDEX idx_rigfile_audit_files_driver_id ON rigfile_audit_files (driver_id);

-- Subscriptions (user_id / stripe ids covered by UNIQUE constraints)
CREATE INDEX idx_rigfile_subscriptions_billable ON rigfile_subscriptions (user_id)
  WHERE status IN ('active', 'trialing', 'past_due');

-- Payments (FK: user_id)
CREATE INDEX idx_rigfile_payments_user_id ON rigfile_payments (user_id);
CREATE INDEX idx_rigfile_payments_status ON rigfile_payments (status);
CREATE INDEX idx_rigfile_payments_checkout_session ON rigfile_payments (stripe_checkout_session_id);

-- Stripe events (event_id covered by UNIQUE constraint)
CREATE INDEX idx_rigfile_stripe_events_type ON rigfile_stripe_events (event_type);
CREATE INDEX idx_rigfile_stripe_events_unprocessed ON rigfile_stripe_events (created_at)
  WHERE processed_at IS NULL;


-- ============================================================================
-- 4. FUNCTIONS
-- ============================================================================

-- 4.1 Generic updated_at maintainer (prefixed: shared DB, no collisions)
CREATE OR REPLACE FUNCTION rigfile_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 4.2 Admin check for policies (SECURITY DEFINER: table owner bypasses RLS,
--     so no policy recursion on rigfile_profiles)
CREATE OR REPLACE FUNCTION rigfile_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM rigfile_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 4.3 Auto-provision profile + free subscription on signup
CREATE OR REPLACE FUNCTION rigfile_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rigfile_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Every user starts on the free plan: billing queries are always uniform.
  INSERT INTO public.rigfile_subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4.4 Pure status computation: the compliance rules in one place
CREATE OR REPLACE FUNCTION rigfile_compute_dqf_status(
  p_expires_on   date,
  p_has_document boolean,
  p_warn_days    integer DEFAULT 30
)
RETURNS rigfile_dqf_item_status
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_expires_on IS NULL AND NOT p_has_document
      THEN 'missing'::rigfile_dqf_item_status
    WHEN p_expires_on IS NULL
      THEN 'valid'::rigfile_dqf_item_status
    WHEN p_expires_on < CURRENT_DATE
      THEN 'expired'::rigfile_dqf_item_status
    WHEN p_expires_on <= CURRENT_DATE + p_warn_days
      THEN 'expiring_soon'::rigfile_dqf_item_status
    ELSE 'valid'::rigfile_dqf_item_status
  END;
$$;

-- 4.5 Trigger: keep dqf_items.status in sync with dates + user's warn window
CREATE OR REPLACE FUNCTION rigfile_set_dqf_item_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_warn_days integer;
BEGIN
  -- User explicitly marked a conditional item as not applicable: respect it.
  IF NEW.status = 'not_applicable' THEN
    RETURN NEW;
  END IF;

  SELECT reminder_lead_days INTO v_warn_days
  FROM rigfile_profiles
  WHERE id = NEW.user_id;

  NEW.status := rigfile_compute_dqf_status(
    NEW.expires_on,
    (NEW.document_path IS NOT NULL OR NEW.issued_on IS NOT NULL),
    COALESCE(v_warn_days, 30)
  );
  RETURN NEW;
END;
$$;

-- 4.6 Trigger: creating a driver instantly seeds all 18 DQF item rows.
--     The dashboard is NEVER empty — the full checklist appears immediately.
CREATE OR REPLACE FUNCTION rigfile_seed_driver_dqf_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rigfile_dqf_items (user_id, product_id, driver_id, item_type_id, status)
  SELECT NEW.user_id, NEW.product_id, NEW.id, t.id, 'missing'::rigfile_dqf_item_status
  FROM public.rigfile_dqf_item_types t
  ON CONFLICT (driver_id, item_type_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4.7 Daily refresh (cron / service role): roll statuses forward as dates pass.
--     Returns number of rows whose status changed.
CREATE OR REPLACE FUNCTION rigfile_refresh_dqf_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE rigfile_dqf_items i
  SET status = rigfile_compute_dqf_status(
        i.expires_on,
        (i.document_path IS NOT NULL OR i.issued_on IS NOT NULL),
        COALESCE(p.reminder_lead_days, 30)
      )
  FROM rigfile_profiles p
  WHERE p.id = i.user_id
    AND i.status <> 'not_applicable'
    AND i.status IS DISTINCT FROM rigfile_compute_dqf_status(
        i.expires_on,
        (i.document_path IS NOT NULL OR i.issued_on IS NOT NULL),
        COALESCE(p.reminder_lead_days, 30)
      );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- updated_at on every table
CREATE TRIGGER trg_rigfile_profiles_updated_at
  BEFORE UPDATE ON rigfile_profiles
  FOR EACH ROW EXECUTE FUNCTION rigfile_update_updated_at();

CREATE TRIGGER trg_rigfile_dqf_item_types_updated_at
  BEFORE UPDATE ON rigfile_dqf_item_types
  FOR EACH ROW EXECUTE FUNCTION rigfile_update_updated_at();

CREATE TRIGGER trg_rigfile_drivers_updated_at
  BEFORE UPDATE ON rigfile_drivers
  FOR EACH ROW EXECUTE FUNCTION rigfile_update_updated_at();

CREATE TRIGGER trg_rigfile_dqf_items_updated_at
  BEFORE UPDATE ON rigfile_dqf_items
  FOR EACH ROW EXECUTE FUNCTION rigfile_update_updated_at();

CREATE TRIGGER trg_rigfile_audit_files_updated_at
  BEFORE UPDATE ON rigfile_audit_files
  FOR EACH ROW EXECUTE FUNCTION rigfile_update_updated_at();

CREATE TRIGGER trg_rigfile_subscriptions_updated_at
  BEFORE UPDATE ON rigfile_subscriptions
  FOR EACH ROW EXECUTE FUNCTION rigfile_update_updated_at();

CREATE TRIGGER trg_rigfile_payments_updated_at
  BEFORE UPDATE ON rigfile_payments
  FOR EACH ROW EXECUTE FUNCTION rigfile_update_updated_at();

CREATE TRIGGER trg_rigfile_stripe_events_updated_at
  BEFORE UPDATE ON rigfile_stripe_events
  FOR EACH ROW EXECUTE FUNCTION rigfile_update_updated_at();

-- Domain triggers
CREATE TRIGGER trg_rigfile_dqf_items_status
  BEFORE INSERT OR UPDATE ON rigfile_dqf_items
  FOR EACH ROW EXECUTE FUNCTION rigfile_set_dqf_item_status();

CREATE TRIGGER trg_rigfile_drivers_seed_dqf
  AFTER INSERT ON rigfile_drivers
  FOR EACH ROW EXECUTE FUNCTION rigfile_seed_driver_dqf_items();

-- Signup trigger on auth.users (product-suffixed name: shared DB, no collision)
DROP TRIGGER IF EXISTS on_auth_user_created_rigfile ON auth.users;
CREATE TRIGGER on_auth_user_created_rigfile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION rigfile_handle_new_user();


-- ============================================================================
-- 6. ROW-LEVEL SECURITY (canonical patterns — no variants)
-- ============================================================================

ALTER TABLE rigfile_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigfile_dqf_item_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigfile_drivers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigfile_dqf_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigfile_audit_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigfile_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigfile_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigfile_stripe_events  ENABLE ROW LEVEL SECURITY;
-- rigfile_stripe_events: RLS on, NO policies => service role only.

-- Profiles: keyed by id = auth.uid()
CREATE POLICY "rigfile_profiles_owner" ON rigfile_profiles FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "rigfile_profiles_admin_read" ON rigfile_profiles FOR SELECT TO authenticated
  USING (rigfile_is_admin());

-- Reference data: readable by all signed-in users; writes = service role only
CREATE POLICY "rigfile_dqf_item_types_read" ON rigfile_dqf_item_types FOR SELECT TO authenticated
  USING (true);

-- User-owned tables: canonical tenant-isolation policy
CREATE POLICY "rigfile_drivers_owner" ON rigfile_drivers FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile')
  WITH CHECK (user_id = auth.uid() AND product_id = 'rigfile');

CREATE POLICY "rigfile_dqf_items_owner" ON rigfile_dqf_items FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile')
  WITH CHECK (user_id = auth.uid() AND product_id = 'rigfile');

CREATE POLICY "rigfile_audit_files_owner" ON rigfile_audit_files FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile')
  WITH CHECK (user_id = auth.uid() AND product_id = 'rigfile');

CREATE POLICY "rigfile_subscriptions_owner" ON rigfile_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile')
  WITH CHECK (user_id = auth.uid() AND product_id = 'rigfile');

CREATE POLICY "rigfile_subscriptions_admin_read" ON rigfile_subscriptions FOR SELECT TO authenticated
  USING (rigfile_is_admin());

CREATE POLICY "rigfile_payments_owner" ON rigfile_payments FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile')
  WITH CHECK (user_id = auth.uid() AND product_id = 'rigfile');

CREATE POLICY "rigfile_payments_admin_read" ON rigfile_payments FOR SELECT TO authenticated
  USING (rigfile_is_admin());


-- ============================================================================
-- 7. FUNCTION PRIVILEGES (lock down service-only + definer functions)
-- ============================================================================

REVOKE ALL ON FUNCTION rigfile_refresh_dqf_statuses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rigfile_refresh_dqf_statuses() TO service_role;

REVOKE ALL ON FUNCTION rigfile_handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rigfile_seed_driver_dqf_items() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 8. SEED DATA — the 18 federal DQF items
--    (No plans table by design: plan lives as an enum on subscriptions, and
--     handle_new_user gives every user a default free/active subscription.)
-- ============================================================================

INSERT INTO rigfile_dqf_item_types
  (code, name, description, cfr_reference, default_validity_months, can_expire, is_conditional, sort_order)
VALUES
  ('employment_application',       'Driver Employment Application',
   'Completed and signed application for employment. Required in the file even when you are hiring yourself as an owner-operator.',
   '49 CFR 391.21', NULL, false, false, 1),

  ('initial_mvr',                  'Initial Motor Vehicle Record (MVR)',
   'Driving record from every state where a license was held in the past 3 years, obtained within 30 days of hire.',
   '49 CFR 391.23(a)(1)', NULL, false, false, 2),

  ('safety_performance_history',   'Safety Performance History Investigation',
   'Records of safety history inquiries sent to all DOT-regulated employers from the past 3 years, completed within 30 days of hire.',
   '49 CFR 391.23(d)-(e)', NULL, false, false, 3),

  ('annual_mvr',                   'Annual Motor Vehicle Record (MVR)',
   'Fresh driving record pulled at least once every 12 months.',
   '49 CFR 391.25(a)', 12, true, false, 4),

  ('annual_review',                'Annual Review of Driving Record',
   'Signed note documenting review of the annual MVR and confirming the driver still meets qualification standards.',
   '49 CFR 391.25(b)', 12, true, false, 5),

  ('certificate_of_violations',    'Certificate of Violations',
   'Driver-signed annual list of traffic violations, or a signed statement that there were none.',
   '49 CFR 391.27', 12, true, false, 6),

  ('road_test_certificate',        'Road Test Certificate or Equivalent',
   'Road test certificate, or the CDL copy that legally substitutes for it.',
   '49 CFR 391.31 / 391.33', NULL, false, false, 7),

  ('medical_certificate',          'Medical Examiner Certificate (Med Card)',
   'Current DOT physical card. Valid for a maximum of 24 months and the single most commonly fined expired document in audits.',
   '49 CFR 391.43 / 391.45', 24, true, false, 8),

  ('medical_examiner_verification','National Registry Examiner Verification',
   'Proof that the medical examiner was verified as listed on the FMCSA National Registry on the exam date.',
   '49 CFR 391.23(m)', 24, true, false, 9),

  ('cdl_copy',                     'Copy of CDL',
   'Legible copy of the current commercial driver license. Track the license expiration date on this item.',
   '49 CFR 383.23', NULL, true, false, 10),

  ('pre_employment_drug_test',     'Pre-Employment Drug Test Result',
   'Negative DOT pre-employment drug test result received before the first dispatch.',
   '49 CFR 382.301', NULL, false, false, 11),

  ('clearinghouse_pre_employment', 'Clearinghouse Pre-Employment Query',
   'Full Drug and Alcohol Clearinghouse query completed before performing safety-sensitive functions.',
   '49 CFR 382.701(a)', NULL, false, false, 12),

  ('clearinghouse_annual',         'Clearinghouse Annual Query',
   'Limited Drug and Alcohol Clearinghouse query run at least once every 12 months.',
   '49 CFR 382.701(b)', 12, true, false, 13),

  ('prev_employer_drug_alcohol',   'Previous Employer Drug & Alcohol History',
   'Drug and alcohol testing history requested from all DOT-regulated employers of the past 3 years.',
   '49 CFR 40.25 / 391.23(e)', NULL, false, false, 14),

  ('eldt_certificate',             'Entry-Level Driver Training Certificate',
   'ELDT completion record. Required if the CDL or endorsement upgrade was obtained on or after February 7, 2022.',
   '49 CFR 380.609', NULL, false, true, 15),

  ('spe_certificate',              'Skill Performance Evaluation Certificate',
   'SPE certificate for drivers with a limb impairment. Must be renewed every 2 years.',
   '49 CFR 391.49', 24, true, true, 16),

  ('hazmat_training',              'HazMat Training Certificate',
   'Hazardous materials training record. Required when hauling placarded loads and renewed every 3 years.',
   '49 CFR 177.816', 36, true, true, 17),

  ('medical_variance',             'Medical Variance / Exemption',
   'Vision, hearing, diabetes, or seizure exemption documents, when applicable. Renewal period varies by exemption type.',
   '49 CFR 391.41', 12, true, true, 18)
ON CONFLICT (code) DO NOTHING;

-- Self-validation patches
-- ============================================================================
-- SELF-VALIDATION SECURITY PATCH — append after the base migration.
-- Fixes: role escalation, entitlement escalation, audit-log mutability,
-- and DQF checklist row deletion. All statements are idempotent-safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENTITLEMENT ESCALATION FIX — rigfile_subscriptions
--    The old FOR ALL owner policy let a user UPDATE their own plan to 'fleet'
--    via PostgREST. Users may only READ their subscription; the central
--    payments webhook (service role, bypasses RLS) is the only writer.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rigfile_subscriptions_owner" ON rigfile_subscriptions;

CREATE POLICY "rigfile_subscriptions_owner_read" ON rigfile_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile');

-- ----------------------------------------------------------------------------
-- 2. PAYMENT LEDGER FIX — rigfile_payments
--    Same class of bug: users could insert or rewrite payment rows.
--    Read-only for users; service role writes.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rigfile_payments_owner" ON rigfile_payments;

CREATE POLICY "rigfile_payments_owner_read" ON rigfile_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile');

-- ----------------------------------------------------------------------------
-- 3. AUDIT LOG IMMUTABILITY — rigfile_audit_files
--    'Immutable-in-spirit' is now enforced: users can list and create audit
--    records (the generate route inserts with the user's RLS client) but can
--    never UPDATE or DELETE them. Driver deletion still cascades: FK cascade
--    actions run at the referential-integrity level, not under caller RLS.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rigfile_audit_files_owner" ON rigfile_audit_files;

CREATE POLICY "rigfile_audit_files_owner_read" ON rigfile_audit_files
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile');

CREATE POLICY "rigfile_audit_files_owner_insert" ON rigfile_audit_files
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND product_id = 'rigfile');

-- ----------------------------------------------------------------------------
-- 4. CHECKLIST INTEGRITY — rigfile_dqf_items
--    The 18 rows per driver are an invariant. Clients may read and update
--    items, never delete them (and never insert — the SECURITY DEFINER seed
--    trigger owns creation and bypasses RLS as table owner).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rigfile_dqf_items_owner" ON rigfile_dqf_items;

CREATE POLICY "rigfile_dqf_items_owner_read" ON rigfile_dqf_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile');

CREATE POLICY "rigfile_dqf_items_owner_update" ON rigfile_dqf_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND product_id = 'rigfile')
  WITH CHECK (user_id = auth.uid() AND product_id = 'rigfile');

-- ----------------------------------------------------------------------------
-- 5. ROLE ESCALATION FIX — rigfile_profiles
--    RLS WITH CHECK cannot compare OLD vs NEW, so a FOR ALL owner policy let
--    users set role='admin' on their own row. This trigger blocks any role
--    change made by a request that carries an end-user JWT (auth.uid() is
--    NULL for the service role and for direct SQL, so platform operations
--    still work).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rigfile_protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Profile role is managed by the platform and cannot be changed here.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rigfile_profiles_protect_role ON rigfile_profiles;
CREATE TRIGGER trg_rigfile_profiles_protect_role
  BEFORE UPDATE ON rigfile_profiles
  FOR EACH ROW EXECUTE FUNCTION rigfile_protect_profile_role();


-- fix QA-005


-- ============================================================================
-- STORAGE HARDENING (QA-005): enforce upload size limit on rigfile-documents
-- ============================================================================
-- The document-upload API (app/api/dqf-items/[id]/document/route.ts) issues a
-- signed upload URL and the client PUTs the file straight to Supabase Storage,
-- so application code never sees the bytes. Any API-layer size validation is
-- therefore advisory only; the authoritative cap must live on the bucket
-- itself. Supabase Storage enforces storage.buckets.file_size_limit on EVERY
-- upload path — signed upload URLs, resumable/TUS, and standard uploads —
-- rejecting oversized objects (413) before they are persisted.
--
-- Cap: 15 MB per object (15 * 1024 * 1024 = 15728640 bytes). Generous for
-- scanned DQF documents (PDF/JPEG/PNG of CDLs, medical certs, MVRs, clearing-
-- house queries) while closing the multi-GB abuse vector. The API layer's
-- requestUploadSchema `file_size` check should mirror this same byte value for
-- fast client feedback; this bucket cap is the enforcement backstop that holds
-- even if the route is bypassed.
--
-- Idempotent: creates the bucket (private — DQF documents contain licenses,
-- SSNs, and medical data) when this schema is applied to a fresh project; if
-- the bucket already exists it ONLY tightens file_size_limit and leaves the
-- bucket's existing visibility and MIME settings untouched.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'rigfile-documents',   -- bucket targeted by the signed-upload route
  'rigfile-documents',
  false,                 -- sensitive DQF documents: private, signed-URL access only
  15728640               -- 15 MB hard cap per object, enforced by Storage itself
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit;