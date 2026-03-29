import { supabase } from "@/integrations/supabase/client";

export type Channel = "LOCAL" | "ONLINE";
export type PriceTerm = string;
export type PaymentMethod = string;
export type Fund = "EFECTIVO" | "MERCADOPAGO";
export type Owner = "LOCAL";

export interface CartItem {
  id: string;
  owner: Owner;
  item_type: "PRODUCT";
  product_id?: string;
  name: string;
  variant: string;
  qty: number;
  unit_price: number;
  notes: string;
  track_stock: boolean;
}

export interface PaymentLine {
  payment_method: PaymentMethod;
  amount: number;
  installments: number;
  commission_pct: number;
  commission_amount: number;
}

export interface ActiveProduct {
  id: string;
  name: string;
  type: string;
  category: string;
  variant_label: string;
  track_stock: boolean;
  qty_on_hand: number;
  prices: Record<string, number>;
}

// Fund is now stored per payment in pos_payments, derived from the price_term's fund field
function getFundFallback(method: string): Fund {
  return method === "EFECTIVO" ? "EFECTIVO" : "MERCADOPAGO";
}

export async function fetchActiveProductsWithPrices(): Promise<ActiveProduct[]> {
  const { data: products, error: pe } = await supabase
    .from("products")
    .select("id, name, type, category, variant_label, track_stock")
    .eq("is_active", true);
  if (pe) throw pe;

  const { data: balances, error: be } = await supabase
    .from("stock_balances")
    .select("product_id, qty_on_hand");
  if (be) throw be;

  const { data: prices, error: pre } = await supabase
    .from("product_prices")
    .select("product_id, channel, term, price");
  if (pre) throw pre;

  const balMap: Record<string, number> = {};
  for (const b of balances ?? []) balMap[b.product_id] = b.qty_on_hand;

  const priceMap: Record<string, Record<string, number>> = {};
  for (const p of prices ?? []) {
    if (!priceMap[p.product_id]) priceMap[p.product_id] = {};
    priceMap[p.product_id][`${p.channel}_${p.term}`] = p.price;
  }

  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    category: p.category,
    variant_label: p.variant_label,
    track_stock: p.track_stock,
    qty_on_hand: balMap[p.id] ?? 0,
    prices: priceMap[p.id] ?? {},
  }));
}

export interface SaleDiscountLine {
  item_type: "DISCOUNT";
  product_id: null;
  promotion_id: string;
  name: string;
  variant: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export async function createSale(
  saleData: {
    channel: Channel;
    price_term: PriceTerm;
    delivery_fee: number;
    customer_id?: string;
    customer_name_snapshot?: string;
    customer_email_snapshot?: string;
  },
  items: CartItem[],
  payments: PaymentLine[],
  userId?: string,
  discountLines?: SaleDiscountLine[]
) {
  // 1. Verify stock
  const stockItems = items.filter((i) => i.track_stock);
  if (stockItems.length > 0) {
    const productIds = stockItems.map((i) => i.product_id!);
    const { data: balances, error: be } = await supabase
      .from("stock_balances")
      .select("product_id, qty_on_hand")
      .in("product_id", productIds);
    if (be) throw be;

    const balMap: Record<string, number> = {};
    for (const b of balances ?? []) balMap[b.product_id] = b.qty_on_hand;

    for (const item of stockItems) {
      const available = balMap[item.product_id!] ?? 0;
      if (available < item.qty) {
        throw new Error(`Stock insuficiente para "${item.name}". Disponible: ${available}, pedido: ${item.qty}`);
      }
    }
  }

  // 2. Calculate totals
  const subtotalProducts = items.reduce((sum, i) => sum + i.unit_price * i.qty, 0);
  const discountAmount = (discountLines ?? []).reduce((sum, d) => sum + d.line_total, 0);
  const subtotalLocal = subtotalProducts + discountAmount;
  const total = subtotalLocal + saleData.delivery_fee;

  // 3. Insert sale
  const { data: sale, error: se } = await supabase
    .from("pos_sales")
    .insert({
      channel: saleData.channel,
      price_term: saleData.price_term,
      delivery_fee: saleData.delivery_fee,
      subtotal_local: subtotalLocal,
      subtotal_restaurant: 0,
      total,
      customer_id: saleData.customer_id || null,
      customer_name_snapshot: saleData.customer_name_snapshot || "",
      customer_email_snapshot: saleData.customer_email_snapshot || "",
      ...(userId ? { created_by: userId } : {}),
    })
    .select("id")
    .single();
  if (se) throw se;

  const saleId = sale.id;

  // 4. Insert sale items (PRODUCT)
  const saleItems = items.map((i) => ({
    sale_id: saleId,
    owner: i.owner,
    item_type: i.item_type,
    product_id: i.product_id || null,
    restaurant_item_id: null,
    name_snapshot: i.name,
    variant_snapshot: i.variant,
    qty: i.qty,
    unit_price: i.unit_price,
    line_total: i.unit_price * i.qty,
    notes: i.notes,
  }));

  // 4b. Insert DISCOUNT items
  const discountItems = (discountLines ?? []).map((d) => ({
    sale_id: saleId,
    owner: "LOCAL",
    item_type: "DISCOUNT",
    product_id: null,
    restaurant_item_id: null,
    name_snapshot: d.name,
    variant_snapshot: d.variant,
    qty: d.qty,
    unit_price: d.unit_price,
    line_total: d.line_total,
    notes: "",
    promotion_id: d.promotion_id,
  }));

  const allItems = [...saleItems, ...discountItems];
  const { error: ie } = await supabase.from("pos_sale_items").insert(allItems);
  if (ie) throw ie;

  // 5. Insert payments
  const paymentRows = payments.map((p) => ({
    sale_id: saleId,
    payment_method: p.payment_method,
    fund: (p as any).fund || getFundFallback(p.payment_method),
    amount: p.amount,
    installments: p.installments,
    commission_pct: p.commission_pct,
    commission_amount: p.commission_amount,
  }));

  const { error: ppe } = await supabase.from("pos_payments").insert(paymentRows);
  if (ppe) throw ppe;

  // 6. Deduct stock (only PRODUCT items)
  for (const item of stockItems) {
    const { error: me } = await supabase.from("stock_movements").insert({
      product_id: item.product_id!,
      type: "SALE",
      qty: item.qty,
      reason: "Venta POS",
      created_by: "admin",
    });
    if (me) throw me;

    const { data: bal } = await supabase
      .from("stock_balances")
      .select("qty_on_hand")
      .eq("product_id", item.product_id!)
      .single();

    const newQty = (bal?.qty_on_hand ?? 0) - item.qty;
    const { error: ue } = await supabase
      .from("stock_balances")
      .update({ qty_on_hand: newQty })
      .eq("product_id", item.product_id!);
    if (ue) throw ue;
  }

  return { saleId, total };
}

export async function createLayawaySale(
  saleData: {
    channel: Channel;
    price_term: PriceTerm;
    delivery_fee: number;
    customer_id?: string;
    customer_name_snapshot?: string;
    customer_email_snapshot?: string;
  },
  items: CartItem[],
  layawayData: {
    customerName: string;
    customerPhone: string;
    depositAmount: number;
    depositMethod: string;
    dueDate: string;
    notes: string;
  },
  userId?: string
) {
  // 1. Verify stock
  const stockItems = items.filter((i) => i.track_stock);
  if (stockItems.length > 0) {
    const productIds = stockItems.map((i) => i.product_id!);
    const { data: balances, error: be } = await supabase
      .from("stock_balances")
      .select("product_id, qty_on_hand")
      .in("product_id", productIds);
    if (be) throw be;

    const balMap: Record<string, number> = {};
    for (const b of balances ?? []) balMap[b.product_id] = b.qty_on_hand;

    for (const item of stockItems) {
      const available = balMap[item.product_id!] ?? 0;
      if (available < item.qty) {
        throw new Error(`Stock insuficiente para "${item.name}". Disponible: ${available}, pedido: ${item.qty}`);
      }
    }
  }

  // 2. Calculate totals
  const subtotalLocal = items.reduce((sum, i) => sum + i.unit_price * i.qty, 0);
  const total = subtotalLocal + saleData.delivery_fee;

  // 3. Insert sale with LAYAWAY status
  const { data: sale, error: se } = await supabase
    .from("pos_sales")
    .insert({
      channel: saleData.channel,
      price_term: saleData.price_term,
      delivery_fee: saleData.delivery_fee,
      subtotal_local: subtotalLocal,
      subtotal_restaurant: 0,
      total,
      status: "LAYAWAY",
      customer_id: saleData.customer_id || null,
      customer_name_snapshot: saleData.customer_name_snapshot || "",
      customer_email_snapshot: saleData.customer_email_snapshot || "",
      ...(userId ? { created_by: userId } : {}),
    })
    .select("id")
    .single();
  if (se) throw se;

  const saleId = sale.id;

  // 4. Insert sale items
  const saleItems = items.map((i) => ({
    sale_id: saleId,
    owner: i.owner,
    item_type: i.item_type,
    product_id: i.product_id || null,
    restaurant_item_id: null,
    name_snapshot: i.name,
    variant_snapshot: i.variant,
    qty: i.qty,
    unit_price: i.unit_price,
    line_total: i.unit_price * i.qty,
    notes: i.notes,
  }));

  const { error: ie } = await supabase.from("pos_sale_items").insert(saleItems);
  if (ie) throw ie;

  // 5. Create layaway record
  const { error: le } = await supabase.from("pos_layaways").insert({
    sale_id: saleId,
    customer_name: layawayData.customerName,
    customer_phone: layawayData.customerPhone,
    total,
    paid: layawayData.depositAmount,
    balance: total - layawayData.depositAmount,
    due_date: layawayData.dueDate || null,
    notes: layawayData.notes,
  });
  if (le) throw le;

  // 6. Record deposit payment
  if (layawayData.depositAmount > 0) {
    const fund = layawayData.depositMethod === "EFECTIVO" ? "EFECTIVO" : "MERCADOPAGO";
    await supabase.from("pos_payments").insert({
      sale_id: saleId,
      payment_method: layawayData.depositMethod,
      fund,
      amount: layawayData.depositAmount,
      installments: 1,
      commission_pct: 0,
      commission_amount: 0,
    });
  }

  // 7. Deduct stock (reserved for the layaway)
  for (const item of stockItems) {
    await supabase.from("stock_movements").insert({
      product_id: item.product_id!,
      type: "SALE",
      qty: item.qty,
      reason: "Seña - reserva",
      created_by: "admin",
    });

    const { data: bal } = await supabase
      .from("stock_balances")
      .select("qty_on_hand")
      .eq("product_id", item.product_id!)
      .single();

    const newQty = (bal?.qty_on_hand ?? 0) - item.qty;
    await supabase
      .from("stock_balances")
      .update({ qty_on_hand: newQty })
      .eq("product_id", item.product_id!);
  }

  return { saleId, total };
}
