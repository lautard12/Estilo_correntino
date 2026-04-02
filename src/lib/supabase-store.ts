import { supabase } from "@/integrations/supabase/client";
import { ProductType, MovementType } from "./types";

// Categories
export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function addCategory(name: string) {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Queries
export async function fetchProductsWithStock() {
  const [{ data, error }, { data: supplierData }] = await Promise.all([
    supabase
      .from("products")
      .select("*, stock_balances(qty_on_hand)")
      .eq("is_active", true),
    supabase.rpc("get_last_supplier_per_product"),
  ]);

  if (error) throw error;

  const supplierMap = new Map(
    (supplierData ?? []).map((s: any) => [s.product_id, { name: s.supplier_name, lead_time_days: s.lead_time_days }])
  );

  return (data ?? []).map((p: any) => {
    const qty = p.stock_balances?.qty_on_hand ?? 0;
    let status: "sin_stock" | "bajo" | "ok" = "ok";
    if (qty <= 0) status = "sin_stock";
    else if (qty <= p.min_stock) status = "bajo";
    const supplierInfo = supplierMap.get(p.id);
    return { ...p, qty_on_hand: qty, status, stock_balances: undefined, last_supplier: supplierInfo?.name || null, supplier_lead_time: supplierInfo?.lead_time_days ?? null };
  });
}

export async function fetchAllProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMovements() {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*, products(name, variant_label, type)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    product: m.products,
    products: undefined,
  }));
}

// Mutations
export async function addMovement(
  productId: string,
  type: MovementType,
  qty: number,
  reason: string
) {
  // Get current balance
  const { data: bal } = await supabase
    .from("stock_balances")
    .select("qty_on_hand")
    .eq("product_id", productId)
    .single();

  const currentQty = bal?.qty_on_hand ?? 0;

  let delta = qty;
  if (type === "WASTE" || type === "SALE") delta = -Math.abs(qty);
  if (type === "PURCHASE") delta = Math.abs(qty);

  const newQty = currentQty + delta;
  if (newQty < 0) {
    return { error: `Stock insuficiente. Stock actual: ${currentQty}` };
  }

  // Insert movement
  const { error: movErr } = await supabase.from("stock_movements").insert({
    product_id: productId,
    type,
    qty: delta,
    reason: reason || type,
  });
  if (movErr) return { error: movErr.message };

  // Upsert balance
  const { error: balErr } = await supabase.from("stock_balances").upsert(
    { product_id: productId, qty_on_hand: newQty },
    { onConflict: "product_id" }
  );
  if (balErr) return { error: balErr.message };

  return { success: true };
}

export async function addProduct(data: {
  name: string;
  type: string;
  category: string;
  variant_label: string;
  sku: string;
  min_stock: number;
  track_stock: boolean;
  is_active: boolean;
  cost_price?: number;
  type_id?: string | null;
  category_id?: string | null;
  variant_set_id?: string | null;
  variant_value_id?: string | null;
}) {
  const { data: product, error } = await supabase
    .from("products")
    .insert(data)
    .select()
    .single();
  if (error) throw error;

  // Create initial balance
  const { error: balanceError } = await supabase
    .from("stock_balances")
    .insert({ product_id: product.id, qty_on_hand: 0 });
  if (balanceError) throw balanceError;

  return product;
}

export async function updateProduct(
  id: string,
  data: Record<string, any>
) {
  const { error } = await supabase
    .from("products")
    .update(data)
    .eq("id", id);
  if (error) throw error;
}

export async function toggleProduct(id: string, currentActive: boolean) {
  const { error } = await supabase
    .from("products")
    .update({ is_active: !currentActive })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function duplicateProduct(id: string) {
  const { data: src, error: fetchErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !src) throw fetchErr;

  const { id: _id, created_at: _ca, ...rest } = src;
  const dup = {
    ...rest,
    variant_label: src.variant_label + " (copia)",
    sku: src.sku + "-DUP",
  };

  const { data: newProduct, error } = await supabase
    .from("products")
    .insert(dup)
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("stock_balances")
    .insert({ product_id: newProduct.id, qty_on_hand: 0 });

  return newProduct;
}

// Purchase with optional expense registration (idempotent)
export async function addPurchaseWithExpense(params: {
  productId: string;
  qty: number;
  reason: string;
  registerExpense?: boolean;
  totalPaid?: number;
  paymentMethod?: string;
  fund?: string;
  updateCostPrice?: boolean;
  newCostPrice?: number;
  productName?: string;
  variantLabel?: string;
  supplierId?: string;
}) {
  const {
    productId, qty, reason, registerExpense,
    totalPaid, paymentMethod, fund,
    updateCostPrice, newCostPrice, productName, variantLabel,
    supplierId,
  } = params;

  // 1. Get current balance
  const { data: bal } = await supabase
    .from("stock_balances")
    .select("qty_on_hand")
    .eq("product_id", productId)
    .single();

  const currentQty = bal?.qty_on_hand ?? 0;
  const newQty = currentQty + Math.abs(qty);

  // 2. Insert stock_movement
  const movementData: any = {
    product_id: productId,
    type: "PURCHASE",
    qty: Math.abs(qty),
    reason: reason || "Compra mercadería",
  };
  if (supplierId) movementData.supplier_id = supplierId;

  const { data: movement, error: movErr } = await supabase
    .from("stock_movements")
    .insert(movementData)
    .select("id")
    .single();
  if (movErr) return { error: movErr.message };

  // 3. Upsert balance
  const { error: balErr } = await supabase.from("stock_balances").upsert(
    { product_id: productId, qty_on_hand: newQty },
    { onConflict: "product_id" }
  );
  if (balErr) return { error: balErr.message };

  // 4. Optional: update cost_price
  if (updateCostPrice && newCostPrice != null) {
    await supabase
      .from("products")
      .update({ cost_price: newCostPrice })
      .eq("id", productId);
  }

  // 5. Optional: register expense (idempotent upsert)
  let expenseError: string | undefined;
  if (registerExpense && totalPaid != null && paymentMethod && fund) {
    const today = new Date().toISOString().split("T")[0];
    const desc = `Compra mercadería: ${productName || ""} ${variantLabel || ""} x${qty}`.trim();

    const { error: expErr } = await supabase.from("expenses").insert({
      date: today,
      amount: totalPaid,
      payment_method: paymentMethod,
      fund,
      category: "Compra mercadería",
      description: desc,
      is_pass_through: true,
      source_stock_movement_id: movement.id,
      created_by: "admin",
    });
    if (expErr) expenseError = expErr.message;
  }

  return { success: true, expenseError };
}

export async function applyCount(counts: Record<string, number>) {
  // Get current balances
  const productIds = Object.keys(counts);
  const { data: balances } = await supabase
    .from("stock_balances")
    .select("*")
    .in("product_id", productIds);

  const balMap = new Map(
    (balances ?? []).map((b) => [b.product_id, b.qty_on_hand])
  );

  const movementsToInsert: any[] = [];
  const balanceUpserts: any[] = [];

  for (const [productId, realQty] of Object.entries(counts)) {
    const currentQty = balMap.get(productId) ?? 0;
    const diff = realQty - currentQty;
    if (diff !== 0) {
      movementsToInsert.push({
        product_id: productId,
        type: "ADJUST",
        qty: diff,
        reason: `Conteo físico: ${currentQty} → ${realQty}`,
      });
      balanceUpserts.push({
        product_id: productId,
        qty_on_hand: realQty,
      });
    }
  }

  if (movementsToInsert.length > 0) {
    const { error: movErr } = await supabase
      .from("stock_movements")
      .insert(movementsToInsert);
    if (movErr) throw movErr;

    const { error: balErr } = await supabase
      .from("stock_balances")
      .upsert(balanceUpserts, { onConflict: "product_id" });
    if (balErr) throw balErr;
  }

  return movementsToInsert.length;
}
