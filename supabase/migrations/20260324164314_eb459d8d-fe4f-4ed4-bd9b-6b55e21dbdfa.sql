
CREATE OR REPLACE FUNCTION public.validate_payment_method_fund()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_fund NOT IN ('EFECTIVO', 'MERCADOPAGO') THEN
    RAISE EXCEPTION 'fund must be EFECTIVO or MERCADOPAGO';
  END IF;
  RETURN NEW;
END;
$function$;
