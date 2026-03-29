
-- Phase 2: Payment methods, installments, commissions

-- Add installments and commission tracking to pos_payments
ALTER TABLE public.pos_payments ADD COLUMN installments integer NOT NULL DEFAULT 1;
ALTER TABLE public.pos_payments ADD COLUMN commission_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.pos_payments ADD COLUMN commission_amount integer NOT NULL DEFAULT 0;

-- Add discount/commission percentages to price_settings
ALTER TABLE public.price_settings ADD COLUMN cash_discount_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.price_settings ADD COLUMN debit_commission_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.price_settings ADD COLUMN credit_commission_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.price_settings ADD COLUMN mp_commission_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.price_settings ADD COLUMN qr_commission_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.price_settings ADD COLUMN transfer_commission_pct numeric NOT NULL DEFAULT 0;
