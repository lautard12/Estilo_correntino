
-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NULL,
  document text NULL,
  address text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique email case-insensitive (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS customers_unique_email_ci
ON public.customers (lower(email))
WHERE email IS NOT NULL;

-- Search indexes
CREATE INDEX IF NOT EXISTS customers_search_document_idx
ON public.customers (document);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user
CREATE POLICY "Authenticated can read customers"
ON public.customers FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- INSERT: any authenticated user (for quick-add from POS)
CREATE POLICY "Authenticated can insert customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: only encargado
CREATE POLICY "Encargado can update customers"
ON public.customers FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'encargado'::app_role));

-- DELETE: only encargado
CREATE POLICY "Encargado can delete customers"
ON public.customers FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'encargado'::app_role));

-- Add customer fields to pos_sales
ALTER TABLE public.pos_sales
ADD COLUMN IF NOT EXISTS customer_id uuid NULL REFERENCES public.customers(id);

ALTER TABLE public.pos_sales
ADD COLUMN IF NOT EXISTS customer_name_snapshot text NOT NULL DEFAULT '';

ALTER TABLE public.pos_sales
ADD COLUMN IF NOT EXISTS customer_email_snapshot text NOT NULL DEFAULT '';
