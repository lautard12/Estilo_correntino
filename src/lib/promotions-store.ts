import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/pos-store";

export type PromotionType = "BUY_X_GET_Y" | "PERCENT_OFF" | "FIXED_PRICE";

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  buy_qty: number | null;
  get_qty: number | null;
  percent_off: number | null;
  fixed_price: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  product_ids?: string[];
}

export interface DiscountLine {
  item_type: "DISCOUNT";
  product_id: null;
  promotion_id: string;
  name: string;
  variant: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

// ── Admin CRUD ──

export async function fetchPromotionsAdmin(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .order("sort_order");
  if (error) throw error;

  const promoIds = (data ?? []).map((p) => p.id);
  if (promoIds.length === 0) return [];

  const { data: pp, error: ppe } = await supabase
    .from("promotion_products")
    .select("promotion_id, product_id")
    .in("promotion_id", promoIds);
  if (ppe) throw ppe;

  const ppMap: Record<string, string[]> = {};
  for (const r of pp ?? []) {
    if (!ppMap[r.promotion_id]) ppMap[r.promotion_id] = [];
    ppMap[r.promotion_id].push(r.product_id);
  }

  return (data ?? []).map((p) => ({
    ...p,
    type: p.type as PromotionType,
    product_ids: ppMap[p.id] ?? [],
  }));
}

export async function createPromotion(payload: {
  name: string;
  type: PromotionType;
  buy_qty?: number | null;
  get_qty?: number | null;
  percent_off?: number | null;
  fixed_price?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  sort_order?: number;
  product_ids?: string[];
}) {
  const { product_ids, ...rest } = payload;
  const { data, error } = await supabase
    .from("promotions")
    .insert(rest)
    .select("id")
    .single();
  if (error) throw error;

  if (product_ids && product_ids.length > 0) {
    await setPromotionProducts(data.id, product_ids);
  }
  return data;
}

export async function updatePromotion(
  id: string,
  payload: Partial<Omit<Promotion, "id" | "created_at" | "product_ids">> & { product_ids?: string[] }
) {
  const { product_ids, ...rest } = payload;
  const { error } = await supabase.from("promotions").update(rest).eq("id", id);
  if (error) throw error;

  if (product_ids !== undefined) {
    await setPromotionProducts(id, product_ids);
  }
}

export async function togglePromotion(id: string, is_active: boolean) {
  const { error } = await supabase.from("promotions").update({ is_active }).eq("id", id);
  if (error) throw error;
}

export async function setPromotionProducts(promotion_id: string, product_ids: string[]) {
  const { error: de } = await supabase
    .from("promotion_products")
    .delete()
    .eq("promotion_id", promotion_id);
  if (de) throw de;

  if (product_ids.length > 0) {
    const rows = product_ids.map((product_id) => ({ promotion_id, product_id }));
    const { error } = await supabase.from("promotion_products").insert(rows);
    if (error) throw error;
  }
}

// ── POS: fetch active promos for cart products ──

export async function fetchActivePromotionsForProducts(
  productIds: string[]
): Promise<Record<string, Promotion[]>> {
  if (productIds.length === 0) return {};

  const today = new Date().toISOString().slice(0, 10);

  const { data: promos, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;

  const validPromos = (promos ?? []).filter((p) => {
    if (p.start_date && p.start_date > today) return false;
    if (p.end_date && p.end_date < today) return false;
    return true;
  });

  if (validPromos.length === 0) return {};

  const promoIds = validPromos.map((p) => p.id);
  const { data: pp, error: ppe } = await supabase
    .from("promotion_products")
    .select("promotion_id, product_id")
    .in("promotion_id", promoIds)
    .in("product_id", productIds);
  if (ppe) throw ppe;

  const result: Record<string, Promotion[]> = {};
  const promoMap = new Map(validPromos.map((p) => [p.id, p]));

  for (const r of pp ?? []) {
    const promo = promoMap.get(r.promotion_id);
    if (!promo) continue;
    if (!result[r.product_id]) result[r.product_id] = [];
    result[r.product_id].push({ ...promo, type: promo.type as PromotionType });
  }

  return result;
}

// ── POS: fetch ALL active promos with their product details (combo-first flow) ──

export interface PromotionWithProducts extends Promotion {
  products: { id: string; name: string; variant_label: string; cost_price: number; unit_price: number; track_stock: boolean; qty_on_hand: number }[];
}

export async function fetchActivePromotionsWithProducts(): Promise<PromotionWithProducts[]> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: promos, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;

  const validPromos = (promos ?? []).filter((p) => {
    if (p.start_date && p.start_date > today) return false;
    if (p.end_date && p.end_date < today) return false;
    return true;
  });

  if (validPromos.length === 0) return [];

  const promoIds = validPromos.map((p) => p.id);
  const { data: pp, error: ppe } = await supabase
    .from("promotion_products")
    .select("promotion_id, product_id")
    .in("promotion_id", promoIds);
  if (ppe) throw ppe;

  // Get unique product IDs
  const allProductIds = [...new Set((pp ?? []).map((r) => r.product_id))];
  if (allProductIds.length === 0) return [];

  // Fetch product info
  const { data: prods, error: pe } = await supabase
    .from("products")
    .select("id, name, variant_label, cost_price, track_stock, is_active")
    .in("id", allProductIds);
  if (pe) throw pe;

  // Fetch stock
  const { data: stocks, error: se } = await supabase
    .from("stock_balances")
    .select("product_id, qty_on_hand")
    .in("product_id", allProductIds);
  if (se) throw se;

  // Fetch prices (LOCAL_EFECTIVO as default)
  const { data: prices, error: pre } = await supabase
    .from("product_prices")
    .select("product_id, price")
    .in("product_id", allProductIds)
    .eq("channel", "LOCAL")
    .eq("term", "EFECTIVO");
  if (pre) throw pre;

  const stockMap = new Map((stocks ?? []).map((s) => [s.product_id, s.qty_on_hand]));
  const priceMap = new Map((prices ?? []).map((p) => [p.product_id, Number(p.price)]));
  const prodMap = new Map((prods ?? []).map((p) => [p.id, p]));

  // Build promo -> product_ids mapping
  const promoProductMap: Record<string, string[]> = {};
  for (const r of pp ?? []) {
    if (!promoProductMap[r.promotion_id]) promoProductMap[r.promotion_id] = [];
    promoProductMap[r.promotion_id].push(r.product_id);
  }

  return validPromos.map((p) => {
    const pIds = promoProductMap[p.id] ?? [];
    const products = pIds
      .map((pid) => {
        const prod = prodMap.get(pid);
        if (!prod || !prod.is_active) return null;
        return {
          id: pid,
          name: prod.name,
          variant_label: prod.variant_label,
          cost_price: prod.cost_price,
          unit_price: priceMap.get(pid) ?? 0,
          track_stock: prod.track_stock,
          qty_on_hand: stockMap.get(pid) ?? 0,
        };
      })
      .filter(Boolean) as PromotionWithProducts["products"];

    return {
      ...p,
      type: p.type as PromotionType,
      product_ids: pIds,
      products,
    };
  }).filter((p) => p.products.length > 0);
}

// ── Discount computation ──

export function computeDiscountLines(
  cartItems: CartItem[],
  appliedOffers: Record<string, string>, // productId -> promotionId
  promotionsByProduct: Record<string, Promotion[]>
): DiscountLine[] {
  const lines: DiscountLine[] = [];
  
  // Group by promotion_id to create one discount line per promotion
  const promoGroups: Record<string, { promo: Promotion; items: CartItem[] }> = {};
  
  for (const item of cartItems) {
    if (item.item_type !== "PRODUCT" || !item.product_id) continue;
    const promoId = appliedOffers[item.product_id];
    if (!promoId) continue;

    const promos = promotionsByProduct[item.product_id] ?? [];
    const promo = promos.find((p) => p.id === promoId);
    if (!promo) continue;

    if (!promoGroups[promoId]) {
      promoGroups[promoId] = { promo, items: [] };
    }
    promoGroups[promoId].items.push(item);
  }

  // Calculate discount for each promotion
  for (const [promoId, group] of Object.entries(promoGroups)) {
    const { promo, items } = group;
    let totalDiscount = 0;

    switch (promo.type) {
      case "BUY_X_GET_Y": {
        const buyQty = promo.buy_qty ?? 1;
        const getQty = promo.get_qty ?? 1;
        const groupSize = buyQty + getQty;
        
        // For combos with multiple products, calculate discount differently
        if (items.length > 1) {
          // Multi-product combo: find the cheapest item(s) to discount
          const sortedItems = items.sort((a, b) => a.unit_price - b.unit_price);
          const itemsToDiscount = sortedItems.slice(0, getQty);
          totalDiscount = itemsToDiscount.reduce((sum, item) => sum + item.unit_price, 0);
        } else {
          // Single product combo: standard calculation
          const item = items[0];
          const freeQty = Math.floor(item.qty / groupSize) * getQty;
          totalDiscount = freeQty * item.unit_price;
        }
        break;
      }
      case "PERCENT_OFF": {
        const pct = promo.percent_off ?? 0;
        for (const item of items) {
          const subtotal = item.qty * item.unit_price;
          totalDiscount += Math.round(subtotal * pct / 100);
        }
        break;
      }
      case "FIXED_PRICE": {
        const fp = promo.fixed_price ?? 0;
        for (const item of items) {
          const currentTotal = item.qty * item.unit_price;
          const targetTotal = item.qty * fp;
          totalDiscount += Math.max(0, currentTotal - targetTotal);
        }
        break;
      }
    }

    if (totalDiscount <= 0) continue;

    lines.push({
      item_type: "DISCOUNT",
      product_id: null,
      promotion_id: promo.id,
      name: `Promo ${promo.name}`,
      variant: "",
      qty: 1,
      unit_price: -totalDiscount,
      line_total: -totalDiscount,
    });
  }

  return lines;
}
