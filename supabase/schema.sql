-- ============================================================================
-- MELPUD OPERATIONAL & CONSIGNMENT MANAGEMENT SYSTEM (PRD v2.0)
-- Supabase PostgreSQL Schema, Security (RLS + Grants), & Master Seed
-- ============================================================================
-- Cara pakai:
-- 1. Buka Supabase Dashboard -> SQL Editor -> New Query
-- 2. Paste seluruh isi file ini dan klik "Run"
-- 3. Salin Project URL & Publishable Key (anon key) ke file supabase-config.js
-- ============================================================================

-- 1. Tabel Outlets (PRD Bagian 2.1 & 7)
CREATE TABLE IF NOT EXISTS public.outlets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '-',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabel Products (PRD Bagian 2.1 & 7)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabel Consignment Batches (PRD Bagian 2.2 & 7)
-- Kolom komputasi otomatis qty_sold & total_bill dihitung di level PostgreSQL.
CREATE TABLE IF NOT EXISTS public.consignment_batches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  outlet_id TEXT NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  qty_drop INTEGER NOT NULL CHECK (qty_drop > 0),
  qty_returned INTEGER NULL CHECK (qty_returned IS NULL OR (qty_returned >= 0 AND qty_returned <= qty_drop)),
  price_unit INTEGER NOT NULL CHECK (price_unit >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RECONCILED')),
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PAID')),
  paid_at DATE NULL,
  qty_sold INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN status = 'RECONCILED' THEN GREATEST(0, qty_drop - COALESCE(qty_returned, 0))
      ELSE 0
    END
  ) STORED,
  total_bill INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN status = 'RECONCILED' THEN GREATEST(0, qty_drop - COALESCE(qty_returned, 0)) * price_unit
      ELSE 0
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batches_outlet_id ON public.consignment_batches(outlet_id);
CREATE INDEX IF NOT EXISTS idx_batches_date ON public.consignment_batches(date DESC);
CREATE INDEX IF NOT EXISTS idx_batches_status_payment ON public.consignment_batches(status, payment_status);

-- 4. Tabel Expenses / Buku Kas Belanja (PRD Bagian 3 & 7)
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL CHECK (category IN ('Bahan Baku Utama', 'Kemasan', 'Operasional Lainnya')),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);

-- 5. Database View Finansial (PRD Bagian 3 & 7)
-- Menggunakan security_invoker = true agar view mematuhi hak akses & RLS pemanggil.
CREATE OR REPLACE VIEW public.view_financial_summary
WITH (security_invoker = true) AS
WITH batch_totals AS (
  SELECT
    COALESCE(SUM(total_bill) FILTER (WHERE status = 'RECONCILED' AND payment_status = 'UNPAID'), 0)::BIGINT AS total_receivables,
    COALESCE(SUM(total_bill) FILTER (WHERE status = 'RECONCILED' AND payment_status = 'PAID'), 0)::BIGINT AS real_cash_in
  FROM public.consignment_batches
),
expense_totals AS (
  SELECT
    COALESCE(SUM(amount), 0)::BIGINT AS total_expenses
  FROM public.expenses
)
SELECT
  b.total_receivables,
  b.real_cash_in,
  e.total_expenses,
  (b.real_cash_in - e.total_expenses)::BIGINT AS net_cash,
  ((b.real_cash_in + b.total_receivables) - e.total_expenses)::BIGINT AS projected_profit,
  ((b.real_cash_in - e.total_expenses) < 50000) AS low_cash_warning
FROM batch_totals b
CROSS JOIN expense_totals e;

-- 6. Explicit Data API Grants (Wajib agar Data API dapat mengakses tabel & view)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outlets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.consignment_batches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO anon, authenticated;
GRANT SELECT ON public.view_financial_summary TO anon, authenticated;

-- 7. Row Level Security (RLS)
-- Sesuai PRD: Aplikasi admin tunggal tanpa login (menggunakan kunci publishable/anon).
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "melpud_outlets_all" ON public.outlets;
CREATE POLICY "melpud_outlets_all"
  ON public.outlets FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "melpud_products_all" ON public.products;
CREATE POLICY "melpud_products_all"
  ON public.products FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "melpud_batches_all" ON public.consignment_batches;
CREATE POLICY "melpud_batches_all"
  ON public.consignment_batches FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "melpud_expenses_all" ON public.expenses;
CREATE POLICY "melpud_expenses_all"
  ON public.expenses FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 8. Seed Master Data Awal PRD (Tanpa Transaksi Dummy)
-- 5 Outlet Mitra Awal (PRD Bagian 2.1)
INSERT INTO public.outlets (id, name, contact, active) VALUES
  ('p-bungin', 'P. BUNGIN', '0812-3456-7890', true),
  ('p-moyo-conato', 'P. MOYO CONATO', '0813-9876-5432', true),
  ('p-singkep', 'P. SINGKEP', '0811-2233-4455', true),
  ('bubuh-bali', 'BUBUH BALI', '0878-6543-2109', true),
  ('skensa-mami', 'SKENSA MAMI', '0857-1122-3344', true)
ON CONFLICT (id) DO NOTHING;

-- Katalog Produk Awal (PRD Bagian 2.1)
INSERT INTO public.products (id, name, price) VALUES
  ('pudding-coklat', 'Pudding Coklat', 5000)
ON CONFLICT (id) DO NOTHING;

-- 9. Aktifkan Supabase Realtime untuk sinkronisasi piutang & transaksi real-time
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['outlets', 'products', 'consignment_batches', 'expenses'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Opsional: Jika ingin mengosongkan seluruh transaksi di masa depan, jalankan:
-- TRUNCATE TABLE public.consignment_batches, public.expenses;
