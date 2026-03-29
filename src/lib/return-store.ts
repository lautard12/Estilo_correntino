import { supabase } from "@/integrations/supabase/client";

export interface SalePayment {
  payment_method: string;
  amount: number;
  installments: number;
  commission_amount: number;
}

export interface SaleForReturn {
  id: string;
  created_at: string;
  total: number;
  channel: string;
  status: string;
  seller_name: string;
  customer_name: string;
  customer_email: string;
  bruto: number;
  comisiones: number;
  neto: number;
  cogs: number;
  margen: number;
  items: {
    id: string;
    product_id: string | null;
    name_snapshot: string;
    variant_snapshot: string;
    qty: number;
    unit_price: number;
    line_total: number;
    cost_unit: number;
    cost_total: number;
    item_type: string;
    promotion_id: string | null;
  }[];
  payments: SalePayment[];
}

export async function fetchRecentSales(limit = 50): Promise<SaleForReturn[]> {
  const { data: sales, error } = await supabase
    .from("pos_sales")
    .select("id, created_at, total, channel, status, created_by, customer_name_snapshot, customer_email_snapshot")
    .eq("status", "COMPLETED")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const saleIds = (sales ?? []).map((s) => s.id);
  if (saleIds.length === 0) return [];

  const [itemsRes, paymentsRes, profilesRes, productsRes] = await Promise.all([
    supabase
      .from("pos_sale_items")
      .select("id, sale_id, product_id, name_snapshot, variant_snapshot, qty, unit_price, line_total, item_type, promotion_id")
      .in("sale_id", saleIds),
    supabase
      .from("pos_payments")
      .select("sale_id, payment_method, amount, installments, commission_amount")
      .in("sale_id", saleIds),
    supabase.from("profiles").select("user_id, display_name"),
    supabase.from("products").select("id, cost_price"),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (productsRes.error) throw productsRes.error;

  const productCostMap: Record<string, number> = {};
  for (const p of productsRes.data ?? []) {
    productCostMap[p.id] = p.cost_price ?? 0;
  }

  const itemMap: Record<string, SaleForReturn["items"]> = {};
  for (const i of itemsRes.data ?? []) {
    if (!itemMap[i.sale_id]) itemMap[i.sale_id] = [];
    const isDiscount = (i as any).item_type === "DISCOUNT";
    const costUnit = !isDiscount && i.product_id ? (productCostMap[i.product_id] ?? 0) : 0;
    itemMap[i.sale_id].push({
      ...i,
      item_type: (i as any).item_type ?? "PRODUCT",
      promotion_id: (i as any).promotion_id ?? null,
      cost_unit: costUnit,
      cost_total: costUnit * i.qty,
    });
  }

  const paymentMap: Record<string, SalePayment[]> = {};
  for (const p of paymentsRes.data ?? []) {
    if (!paymentMap[p.sale_id]) paymentMap[p.sale_id] = [];
    paymentMap[p.sale_id].push({
      payment_method: p.payment_method,
      amount: p.amount,
      installments: p.installments,
      commission_amount: p.commission_amount ?? 0,
    });
  }

  const profileMap: Record<string, string> = {};
  for (const p of profilesRes.data ?? []) {
    if (p.display_name?.trim()) profileMap[p.user_id] = p.display_name;
  }

  const missingSellerIds = Array.from(
    new Set((sales ?? []).map((s) => s.created_by).filter((id) => !profileMap[id]))
  );

  if (missingSellerIds.length > 0) {
    const { data: usersData } = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
    });

    if (Array.isArray(usersData)) {
      for (const u of usersData as Array<{ id: string; display_name?: string; email?: string }>) {
        if (u.display_name?.trim()) profileMap[u.id] = u.display_name;
        else if (u.email?.trim()) profileMap[u.id] = u.email;
      }
    }
  }

  return (sales ?? []).map((s) => {
    const saleItems = itemMap[s.id] ?? [];
    const salePayments = paymentMap[s.id] ?? [];

    const bruto = salePayments.length > 0
      ? salePayments.reduce((sum, p) => sum + p.amount, 0)
      : s.total;
    const comisiones = salePayments.reduce((sum, p) => sum + (p.commission_amount ?? 0), 0);
    const neto = bruto - comisiones;
    const cogs = saleItems.filter((i) => i.item_type !== "DISCOUNT").reduce((sum, i) => sum + (i.cost_total ?? 0), 0);
    const margen = neto - cogs;

    return {
      id: s.id,
      created_at: s.created_at,
      total: s.total,
      channel: s.channel,
      status: s.status,
      seller_name: profileMap[s.created_by] ?? s.created_by,
      customer_name: (s as any).customer_name_snapshot ?? "",
      customer_email: (s as any).customer_email_snapshot ?? "",
      bruto,
      comisiones,
      neto,
      cogs,
      margen,
      items: saleItems,
      payments: salePayments,
    };
  });
}

export async function processReturn(
  saleId: string,
  itemsToReturn: { product_id: string | null; qty: number; name: string }[]
): Promise<void> {
  for (const item of itemsToReturn) {
    if (!item.product_id) continue;

    await supabase.from("stock_movements").insert({
      product_id: item.product_id,
      type: "RETURN",
      qty: item.qty,
      reason: `Devolución - ${item.name}`,
      created_by: "admin",
    });

    const { data: bal } = await supabase
      .from("stock_balances")
      .select("qty_on_hand")
      .eq("product_id", item.product_id)
      .single();

    await supabase
      .from("stock_balances")
      .update({ qty_on_hand: (bal?.qty_on_hand ?? 0) + item.qty })
      .eq("product_id", item.product_id);
  }
}
