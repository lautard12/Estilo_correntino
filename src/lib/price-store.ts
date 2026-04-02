import { supabase } from "@/integrations/supabase/client";

const CHANNELS = ["LOCAL", "ONLINE"] as const;
const TERMS = ["EFECTIVO", "CREDITO_1", "CREDITO_3"] as const;

export type Channel = (typeof CHANNELS)[number];
export type Term = (typeof TERMS)[number];

export interface PriceSettings {
  credit_1_pct: number;
  credit_3_pct: number;
  cash_discount_pct: number;
  debit_commission_pct: number;
  credit_commission_pct: number;
  mp_commission_pct: number;
  qr_commission_pct: number;
  transfer_commission_pct: number;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  channel: Channel;
  term: Term;
  price: number;
}

export async function fetchPriceSettings(): Promise<PriceSettings> {
  const { data, error } = await supabase
    .from("price_settings")
    .select("credit_1_pct, credit_3_pct, cash_discount_pct, debit_commission_pct, credit_commission_pct, mp_commission_pct, qr_commission_pct, transfer_commission_pct")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as PriceSettings;
}

export async function updatePriceSettings(credit_1_pct: number, credit_3_pct: number) {
  const { error } = await supabase
    .from("price_settings")
    .update({ credit_1_pct, credit_3_pct, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

export async function fetchProductPrices(productId: string): Promise<ProductPrice[]> {
  const { data, error } = await supabase
    .from("product_prices")
    .select("*")
    .eq("product_id", productId);
  if (error) throw error;
  return (data ?? []) as ProductPrice[];
}

export async function ensureProductPrices(productId: string): Promise<ProductPrice[]> {
  const existing = await fetchProductPrices(productId);
  const missing: { product_id: string; channel: string; term: string; price: number }[] = [];

  for (const channel of CHANNELS) {
    for (const term of TERMS) {
      if (!existing.find((p) => p.channel === channel && p.term === term)) {
        missing.push({ product_id: productId, channel, term, price: 0 });
      }
    }
  }

  if (missing.length > 0) {
    const { error } = await supabase.from("product_prices").insert(missing);
    if (error) throw error;
    return fetchProductPrices(productId);
  }

  return existing;
}

export async function saveProductPrices(
  productId: string,
  baseRestaurante: number,
  baseDelivery: number,
  credit1Pct: number,
  credit3Pct: number
) {
  const rows = [
    { channel: "LOCAL", term: "EFECTIVO", price: baseRestaurante },
    { channel: "LOCAL", term: "CREDITO_1", price: Math.round(baseRestaurante * (1 + credit1Pct / 100)) },
    { channel: "LOCAL", term: "CREDITO_3", price: Math.round(baseRestaurante * (1 + credit3Pct / 100)) },
    { channel: "ONLINE", term: "EFECTIVO", price: baseDelivery },
    { channel: "ONLINE", term: "CREDITO_1", price: Math.round(baseDelivery * (1 + credit1Pct / 100)) },
    { channel: "ONLINE", term: "CREDITO_3", price: Math.round(baseDelivery * (1 + credit3Pct / 100)) },
  ];

  for (const row of rows) {
    const { error } = await supabase
      .from("product_prices")
      .update({ price: row.price })
      .eq("product_id", productId)
      .eq("channel", row.channel)
      .eq("term", row.term);
    if (error) throw error;
  }
}

export async function recalculateAllPrices() {
  const settings = await fetchPriceSettings();

  const { data: basePrices, error } = await supabase
    .from("product_prices")
    .select("product_id, channel, price")
    .eq("term", "EFECTIVO");
  if (error) throw error;

  for (const bp of basePrices ?? []) {
    const c1 = Math.round(bp.price * (1 + settings.credit_1_pct / 100));
    const c3 = Math.round(bp.price * (1 + settings.credit_3_pct / 100));

    await supabase
      .from("product_prices")
      .update({ price: c1 })
      .eq("product_id", bp.product_id)
      .eq("channel", bp.channel)
      .eq("term", "CREDITO_1");

    await supabase
      .from("product_prices")
      .update({ price: c3 })
      .eq("product_id", bp.product_id)
      .eq("channel", bp.channel)
      .eq("term", "CREDITO_3");
  }
}

export async function fetchPriceCompleteness(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("product_prices")
    .select("product_id, price");
  if (error) throw error;

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.price > 0) {
      map[row.product_id] = (map[row.product_id] ?? 0) + 1;
    }
  }
  return map;
}
