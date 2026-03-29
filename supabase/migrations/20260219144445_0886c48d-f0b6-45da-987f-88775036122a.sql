
-- Table for layaways (señas)
CREATE TABLE public.pos_layaways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.pos_layaways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to pos_layaways"
ON public.pos_layaways
FOR ALL
USING (true)
WITH CHECK (true);

-- Add LAYAWAY status support - pos_sales already has status column with default 'COMPLETED'
-- No schema change needed, we just use 'LAYAWAY' as a value

-- Enable RETURN as a stock movement type - stock_movements.type is text, no constraint needed
