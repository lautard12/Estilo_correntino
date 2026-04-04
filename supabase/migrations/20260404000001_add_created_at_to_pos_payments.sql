-- Add created_at to pos_payments so individual payments can be attributed
-- to the day they were actually made (needed for layaway partial-payment accounting).
-- Existing rows default to now() which is acceptable (they were all same-day sales).

ALTER TABLE public.pos_payments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
