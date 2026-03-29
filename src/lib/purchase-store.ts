import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────

export interface StockPurchase {
  id: string;
  purchase_date: string;
  supplier_id: string | null;
  supplier_name_snapshot: string;
  payment_fund: string;
  payment_method: string;
  total_amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  items?: StockPurchaseItem[];
}

export interface StockPurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  qty: number;
  unit_cost: number;
  line_total: number;
  product_name?: string;
  variant_label?: string;
}

export interface PurchaseItemInput {
  product_id: string;
  qty: number;
  unit_cost: number;
}

// ─── Queries ─────────────────────────────────────────────────────────

export async function fetchPurchases(from?: string, to?: string): Promise<StockPurchase[]> {
  let query = supabase
    .from("stock_purchases")
    .select("*")
    .order("purchase_date", { ascending: false });

  if (from) query = query.gte("purchase_date", from);
  if (to) query = query.lte("purchase_date", to);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StockPurchase[];
}

export async function fetchPurchaseWithItems(purchaseId: string): Promise<StockPurchase | null> {
  const { data: purchase, error: pe } = await supabase
    .from("stock_purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();
  if (pe) throw pe;
  if (!purchase) return null;

  const { data: items, error: ie } = await supabase
    .from("stock_purchase_items")
    .select("*, products(name, variant_label)")
    .eq("purchase_id", purchaseId);
  if (ie) throw ie;

  return {
    ...purchase,
    items: (items ?? []).map((i: any) => ({
      ...i,
      product_name: i.products?.name ?? "",
      variant_label: i.products?.variant_label ?? "",
      products: undefined,
    })),
  } as StockPurchase;
}

// ─── Create Purchase ─────────────────────────────────────────────────

export async function createPurchase(params: {
  purchase_date: string;
  supplier_id?: string | null;
  supplier_name_snapshot: string;
  payment_fund: string;
  payment_method: string;
  notes?: string;
  items: PurchaseItemInput[];
  updateCostPrices?: boolean;
}): Promise<{ purchaseId: string }> {
  const {
    purchase_date, supplier_id, supplier_name_snapshot,
    payment_fund, payment_method, notes, items, updateCostPrices,
  } = params;

  const total_amount = items.reduce((s, i) => s + i.qty * i.unit_cost, 0);

  // 1. Insert purchase header
  const { data: purchase, error: pe } = await supabase
    .from("stock_purchases")
    .insert({
      purchase_date,
      supplier_id: supplier_id || null,
      supplier_name_snapshot,
      payment_fund,
      payment_method,
      total_amount,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (pe) throw new Error(pe.message);

  const purchaseId = purchase.id;

  // 2. Insert purchase items
  const itemRows = items.map((i) => ({
    purchase_id: purchaseId,
    product_id: i.product_id,
    qty: i.qty,
    unit_cost: i.unit_cost,
    line_total: i.qty * i.unit_cost,
  }));
  const { error: ie } = await supabase.from("stock_purchase_items").insert(itemRows);
  if (ie) throw new Error(ie.message);

  // 3. Update stock for each product
  for (const item of items) {
    // Insert stock_movement
    const movementData: any = {
      product_id: item.product_id,
      type: "PURCHASE",
      qty: Math.abs(item.qty),
      reason: `Compra mercadería #${purchaseId.slice(0, 8)}`,
    };
    if (supplier_id) movementData.supplier_id = supplier_id;

    const { error: me } = await supabase.from("stock_movements").insert(movementData);
    if (me) throw new Error(me.message);

    // Upsert balance
    const { data: bal } = await supabase
      .from("stock_balances")
      .select("qty_on_hand")
      .eq("product_id", item.product_id)
      .single();

    const newQty = (bal?.qty_on_hand ?? 0) + Math.abs(item.qty);
    const { error: be } = await supabase.from("stock_balances").upsert(
      { product_id: item.product_id, qty_on_hand: newQty },
      { onConflict: "product_id" }
    );
    if (be) throw new Error(be.message);

    // 4. Optionally update cost_price
    if (updateCostPrices && item.unit_cost > 0) {
      await supabase
        .from("products")
        .update({ cost_price: item.unit_cost })
        .eq("id", item.product_id);
    }
  }

  return { purchaseId };
}

// ─── Fetch total purchases for capital calculation ───────────────────

export async function fetchPurchasesTotalByFund(from?: string, to?: string) {
  let query = supabase
    .from("stock_purchases")
    .select("payment_fund, total_amount");
  
  if (from) query = query.gte("purchase_date", from);
  if (to) query = query.lte("purchase_date", to);

  const { data, error } = await query;
  if (error) throw error;

  let efectivo = 0;
  let mercadopago = 0;
  for (const p of data ?? []) {
    if (p.payment_fund === "EFECTIVO") efectivo += p.total_amount;
    else mercadopago += p.total_amount;
  }

  return { efectivo, mercadopago };
}
