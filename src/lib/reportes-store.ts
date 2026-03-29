import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { dayStart, dayEnd } from "@/lib/date-utils";

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

export interface SalesByDay {
  date: string;
  total: number;
  count: number;
}

export interface SalesByMethod {
  method: string;
  total: number;
}

export interface MarginByCategory {
  category: string;
  revenue: number;
  cost: number;
  margin: number;
}

export async function fetchTopProducts(from: string, to: string, limit = 10): Promise<TopProduct[]> {
  const { data: sales } = await supabase
    .from("pos_sales")
    .select("id")
    .eq("status", "COMPLETED")
    .gte("created_at", dayStart(from))
    .lte("created_at", dayEnd(to));

  if (!sales?.length) return [];

  const { data: items } = await supabase
    .from("pos_sale_items")
    .select("name_snapshot, variant_snapshot, qty, line_total")
    .eq("owner", "LOCAL")
    .in("sale_id", sales.map((s) => s.id));

  const map = new Map<string, TopProduct>();
  for (const item of items ?? []) {
    const name = item.variant_snapshot ? `${item.name_snapshot} ${item.variant_snapshot}` : item.name_snapshot;
    const existing = map.get(name);
    if (existing) {
      existing.qty += item.qty;
      existing.revenue += item.line_total;
    } else {
      map.set(name, { name, qty: item.qty, revenue: item.line_total });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function fetchSalesByDay(from: string, to: string): Promise<SalesByDay[]> {
  const { data: sales } = await supabase
    .from("pos_sales")
    .select("created_at, total")
    .eq("status", "COMPLETED")
    .gte("created_at", dayStart(from))
    .lte("created_at", dayEnd(to));

  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const map = new Map<string, SalesByDay>();
  for (const d of days) {
    const key = format(d, "yyyy-MM-dd");
    map.set(key, { date: key, total: 0, count: 0 });
  }

  for (const s of sales ?? []) {
    const key = format(new Date(s.created_at), "yyyy-MM-dd");
    const row = map.get(key);
    if (row) {
      row.total += s.total;
      row.count += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchSalesByMethod(from: string, to: string): Promise<SalesByMethod[]> {
  const { data: sales } = await supabase
    .from("pos_sales")
    .select("id")
    .eq("status", "COMPLETED")
    .gte("created_at", dayStart(from))
    .lte("created_at", dayEnd(to));

  if (!sales?.length) return [];

  const { data: payments } = await supabase
    .from("pos_payments")
    .select("payment_method, amount")
    .in("sale_id", sales.map((s) => s.id));

  const map = new Map<string, number>();
  for (const p of payments ?? []) {
    map.set(p.payment_method, (map.get(p.payment_method) ?? 0) + p.amount);
  }

  return Array.from(map.entries())
    .map(([method, total]) => ({ method, total }))
    .sort((a, b) => b.total - a.total);
}

export async function fetchMarginByCategory(from: string, to: string): Promise<MarginByCategory[]> {
  const { data: sales } = await supabase
    .from("pos_sales")
    .select("id")
    .eq("status", "COMPLETED")
    .gte("created_at", dayStart(from))
    .lte("created_at", dayEnd(to));

  if (!sales?.length) return [];

  const { data: items } = await supabase
    .from("pos_sale_items")
    .select("product_id, qty, line_total")
    .eq("owner", "LOCAL")
    .in("sale_id", sales.map((s) => s.id));

  if (!items?.length) return [];

  const productIds = [...new Set(items.filter((i) => i.product_id).map((i) => i.product_id!))];
  const { data: products } = await supabase
    .from("products")
    .select("id, type, cost_price")
    .in("id", productIds);

  const prodMap = new Map(products?.map((p) => [p.id, p]) ?? []);

  const catMap = new Map<string, { revenue: number; cost: number }>();
  for (const item of items) {
    const prod = item.product_id ? prodMap.get(item.product_id) : null;
    const cat = prod?.type ?? "Otros";
    const cost = (prod?.cost_price ?? 0) * item.qty;
    const existing = catMap.get(cat) ?? { revenue: 0, cost: 0 };
    existing.revenue += item.line_total;
    existing.cost += cost;
    catMap.set(cat, existing);
  }

  return Array.from(catMap.entries())
    .map(([category, d]) => ({
      category,
      revenue: d.revenue,
      cost: d.cost,
      margin: d.revenue - d.cost,
    }))
    .sort((a, b) => b.margin - a.margin);
}
