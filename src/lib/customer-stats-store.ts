import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, subDays, subMonths, format } from "date-fns";

export interface CustomerRankingRow {
  customer_id: string;
  full_name: string;
  total_spent: number;
  sale_count: number;
  avg_ticket: number;
  last_purchase: string;
}

export interface ProductStatRow {
  name: string;
  variant: string;
  qty: number;
  total: number;
}

export interface MonthlySpend {
  month: string;
  total: number;
}

export interface CustomerDetail {
  topProducts: ProductStatRow[];
  monthlySpend: MonthlySpend[];
}

export async function fetchCustomerRanking(
  from: Date,
  to: Date
): Promise<CustomerRankingRow[]> {
  // Fetch completed sales with customer_id in date range
  const { data: sales, error } = await supabase
    .from("pos_sales")
    .select("id, customer_id, total, created_at")
    .eq("status", "COMPLETED")
    .not("customer_id", "is", null)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  if (error) throw error;
  if (!sales || sales.length === 0) return [];

  // Fetch customer names
  const customerIds = [...new Set(sales.map((s) => s.customer_id!))];
  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name")
    .in("id", customerIds);

  const nameMap = new Map(
    (customers ?? []).map((c) => [c.id, c.full_name])
  );

  // Aggregate by customer
  const map = new Map<
    string,
    { total_spent: number; sale_count: number; last_purchase: string }
  >();

  for (const s of sales) {
    const cid = s.customer_id!;
    const existing = map.get(cid);
    if (existing) {
      existing.total_spent += s.total;
      existing.sale_count += 1;
      if (s.created_at > existing.last_purchase)
        existing.last_purchase = s.created_at;
    } else {
      map.set(cid, {
        total_spent: s.total,
        sale_count: 1,
        last_purchase: s.created_at,
      });
    }
  }

  const rows: CustomerRankingRow[] = [];
  for (const [cid, agg] of map) {
    rows.push({
      customer_id: cid,
      full_name: nameMap.get(cid) ?? "Cliente eliminado",
      total_spent: agg.total_spent,
      sale_count: agg.sale_count,
      avg_ticket: Math.round(agg.total_spent / agg.sale_count),
      last_purchase: agg.last_purchase,
    });
  }

  rows.sort((a, b) => b.total_spent - a.total_spent);
  return rows;
}

export async function fetchCustomerDetail(
  customerId: string
): Promise<CustomerDetail> {
  // Fetch all completed sales for this customer (last 6 months)
  const sixMonthsAgo = subMonths(new Date(), 6);

  const { data: sales } = await supabase
    .from("pos_sales")
    .select("id, total, created_at")
    .eq("status", "COMPLETED")
    .eq("customer_id", customerId)
    .gte("created_at", sixMonthsAgo.toISOString());

  if (!sales || sales.length === 0)
    return { topProducts: [], monthlySpend: [] };

  const saleIds = sales.map((s) => s.id);

  // Fetch items for those sales
  const { data: items } = await supabase
    .from("pos_sale_items")
    .select("name_snapshot, variant_snapshot, qty, line_total, item_type")
    .in("sale_id", saleIds)
    .eq("item_type", "PRODUCT");

  // Aggregate products
  const prodMap = new Map<string, { qty: number; total: number; variant: string }>();
  for (const it of items ?? []) {
    const key = `${it.name_snapshot}||${it.variant_snapshot}`;
    const ex = prodMap.get(key);
    if (ex) {
      ex.qty += it.qty;
      ex.total += it.line_total;
    } else {
      prodMap.set(key, {
        qty: it.qty,
        total: it.line_total,
        variant: it.variant_snapshot,
      });
    }
  }

  const topProducts: ProductStatRow[] = [...prodMap.entries()]
    .map(([key, v]) => ({
      name: key.split("||")[0],
      variant: v.variant,
      qty: v.qty,
      total: v.total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Monthly spend
  const monthMap = new Map<string, number>();
  for (const s of sales) {
    const m = format(new Date(s.created_at), "yyyy-MM");
    monthMap.set(m, (monthMap.get(m) ?? 0) + s.total);
  }

  const monthlySpend: MonthlySpend[] = [...monthMap.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { topProducts, monthlySpend };
}

/** Period presets */
export function getPeriodRange(preset: string): { from: Date; to: Date } {
  const now = new Date();
  const to = now;
  switch (preset) {
    case "month":
      return { from: startOfMonth(now), to };
    case "30":
      return { from: subDays(now, 30), to };
    case "90":
      return { from: subDays(now, 90), to };
    default:
      return { from: subDays(now, 30), to };
  }
}
