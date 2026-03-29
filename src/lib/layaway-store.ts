import { supabase } from "@/integrations/supabase/client";

export interface Layaway {
  id: string;
  sale_id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  paid: number;
  balance: number;
  due_date: string | null;
  status: string;
  notes: string;
  created_at: string;
  completed_at: string | null;
  items?: LayawayItem[];
}

export interface LayawayItem {
  name_snapshot: string;
  variant_snapshot: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export async function fetchLayaways(statusFilter?: string): Promise<Layaway[]> {
  let q = supabase
    .from("pos_layaways")
    .select("*")
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "ALL") {
    q = q.eq("status", statusFilter);
  }

  const { data, error } = await q;
  if (error) throw error;

  // Fetch items for each layaway
  const saleIds = (data ?? []).map((l) => l.sale_id);
  if (saleIds.length === 0) return [];

  const { data: items, error: ie } = await supabase
    .from("pos_sale_items")
    .select("sale_id, name_snapshot, variant_snapshot, qty, unit_price, line_total")
    .in("sale_id", saleIds);
  if (ie) throw ie;

  const itemMap: Record<string, LayawayItem[]> = {};
  for (const i of items ?? []) {
    if (!itemMap[i.sale_id]) itemMap[i.sale_id] = [];
    itemMap[i.sale_id].push(i);
  }

  return (data ?? []).map((l) => ({
    ...l,
    items: itemMap[l.sale_id] ?? [],
  }));
}

export async function addLayawayPayment(
  layawayId: string,
  amount: number,
  paymentMethod: string
): Promise<void> {
  // Get current layaway
  const { data: lay, error: le } = await supabase
    .from("pos_layaways")
    .select("*")
    .eq("id", layawayId)
    .single();
  if (le) throw le;

  const newPaid = lay.paid + amount;
  const newBalance = lay.total - newPaid;
  const isComplete = newBalance <= 0;

  // Record payment
  const fund = paymentMethod === "EFECTIVO" ? "EFECTIVO" : "MERCADOPAGO"; // fallback logic
  const { error: pe } = await supabase.from("pos_payments").insert({
    sale_id: lay.sale_id,
    payment_method: paymentMethod,
    fund,
    amount,
    installments: 1,
    commission_pct: 0,
    commission_amount: 0,
  });
  if (pe) throw pe;

  // Update layaway
  const { error: ue } = await supabase
    .from("pos_layaways")
    .update({
      paid: newPaid,
      balance: Math.max(0, newBalance),
      status: isComplete ? "COMPLETED" : "PENDING",
      completed_at: isComplete ? new Date().toISOString() : null,
    })
    .eq("id", layawayId);
  if (ue) throw ue;

  // If complete, update sale status
  if (isComplete) {
    await supabase
      .from("pos_sales")
      .update({ status: "COMPLETED" })
      .eq("id", lay.sale_id);
  }
}

export async function cancelLayaway(layawayId: string): Promise<void> {
  const { data: lay, error: le } = await supabase
    .from("pos_layaways")
    .select("sale_id")
    .eq("id", layawayId)
    .single();
  if (le) throw le;

  // Update layaway status
  await supabase
    .from("pos_layaways")
    .update({ status: "CANCELLED" })
    .eq("id", layawayId);

  // Update sale status
  await supabase
    .from("pos_sales")
    .update({ status: "CANCELLED" })
    .eq("id", lay.sale_id);

  // Restore stock for items that track stock
  const { data: saleItems } = await supabase
    .from("pos_sale_items")
    .select("product_id, qty")
    .eq("sale_id", lay.sale_id)
    .not("product_id", "is", null);

  for (const item of saleItems ?? []) {
    if (!item.product_id) continue;
    // Add stock back
    await supabase.from("stock_movements").insert({
      product_id: item.product_id,
      type: "RETURN",
      qty: item.qty,
      reason: "Seña cancelada",
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
