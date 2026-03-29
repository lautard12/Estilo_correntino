
-- Add fund column to price_terms
ALTER TABLE public.price_terms ADD COLUMN fund text NOT NULL DEFAULT 'EFECTIVO';

-- Drop term_allowed_methods table (and its policies)
DROP POLICY IF EXISTS "Authenticated can read term_allowed_methods" ON public.term_allowed_methods;
DROP POLICY IF EXISTS "Encargado can manage term_allowed_methods" ON public.term_allowed_methods;
DROP TABLE public.term_allowed_methods;

-- Drop payment_methods table (and its policies/triggers)
DROP TRIGGER IF EXISTS validate_fund ON public.payment_methods;
DROP POLICY IF EXISTS "Authenticated can read payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Encargado can manage payment_methods" ON public.payment_methods;
DROP TABLE public.payment_methods;
