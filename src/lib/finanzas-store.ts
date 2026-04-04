import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { dayStart, dayEnd } from "@/lib/date-utils";
import { fetchPurchasesTotalByFund } from "@/lib/purchase-store";

// ─── Types ───────────────────────────────────────────────────────────

export type PaymentMethodExpense = "EFECTIVO" | "QR" | "TRANSFERENCIA" | "TARJETA";
export type Fund = "EFECTIVO" | "MERCADOPAGO";

export interface Expense {
  id: string;
  date: string;
  amount: number;
  payment_method: string;
  fund: string;
  category: string | null;
  description: string | null;
  is_pass_through: boolean;
  created_at: string;
}

export interface OpeningBalance {
  id: string;
  date: string;
  fund: string;
  amount: number;
  notes: string | null;
}

export interface DayRow {
  date: string;
  bruto: number;
  comisiones: number;
  neto: number;
  cogs: number;
  gastos: number;
  ganancia: number;
}

export interface DayDetail {
  ticketCount: number;
  layawayCount: number;
  bruto: number;
  comisiones: number;
  cogs: number;
  expenses: Expense[];
}

export interface CapitalFund {
  fund: string;
  saldoInicial: number;
  entradas: number;
  salidas: number;
  compras: number;
  esperado: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function computeFund(paymentMethod: string): Fund {
  return paymentMethod === "EFECTIVO" ? "EFECTIVO" : "MERCADOPAGO";
}

// ─── Resultado ───────────────────────────────────────────────────────

export async function fetchResultadoRange(from: string, to: string): Promise<DayRow[]> {
  // Revenue is attributed to each payment's own created_at date, not the sale date.
  // This ensures layaway balance payments show up on the day they were actually collected.
  // COGS is still attributed to the sale creation date (when stock is physically reserved).

  // 1. Fetch payments made in the date range
  const { data: rawPayments } = await supabase
    .from("pos_payments")
    .select("sale_id, amount, commission_amount, created_at")
    .gte("created_at", dayStart(from))
    .lte("created_at", dayEnd(to));

  const paymentSaleIds = [...new Set((rawPayments ?? []).map((p) => p.sale_id))];

  // 2. Validate those sales are COMPLETED or LAYAWAY
  const validSaleIds = new Set<string>();
  if (paymentSaleIds.length > 0) {
    const { data: validSales } = await supabase
      .from("pos_sales")
      .select("id")
      .in("id", paymentSaleIds)
      .in("status", ["COMPLETED", "LAYAWAY"]);
    for (const s of validSales ?? []) validSaleIds.add(s.id);
  }

  const payments = (rawPayments ?? []).filter((p) => validSaleIds.has(p.sale_id));

  // 3. For COGS: sales *created* in the date range (stock reserved at creation time)
  const { data: cogsSales } = await supabase
    .from("pos_sales")
    .select("id, created_at")
    .in("status", ["COMPLETED", "LAYAWAY"])
    .gte("created_at", dayStart(from))
    .lte("created_at", dayEnd(to));

  const cogsSaleIds = (cogsSales ?? []).map((s) => s.id);
  const cogsSaleDateMap = new Map<string, string>();
  for (const s of cogsSales ?? []) {
    cogsSaleDateMap.set(s.id, format(new Date(s.created_at), "yyyy-MM-dd"));
  }

  let items: { sale_id: string; qty: number; cost_price: number }[] = [];
  if (cogsSaleIds.length > 0) {
    const { data } = await supabase
      .from("pos_sale_items")
      .select("sale_id, qty, owner, product_id, products(cost_price)")
      .in("sale_id", cogsSaleIds)
      .eq("owner", "LOCAL");
    items = (data ?? []).map((i: any) => ({
      sale_id: i.sale_id,
      qty: i.qty,
      cost_price: i.products?.cost_price ?? 0,
    }));
  }

  // 4. Fetch operating expenses
  const { data: expenses } = await supabase
    .from("expenses")
    .select("date, amount")
    .gte("date", from)
    .lte("date", to)
    .eq("is_pass_through", false);

  // Build day map
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const map = new Map<string, DayRow>();
  for (const d of days) {
    const key = format(d, "yyyy-MM-dd");
    map.set(key, { date: key, bruto: 0, comisiones: 0, neto: 0, cogs: 0, gastos: 0, ganancia: 0 });
  }

  // Aggregate revenue by payment date
  for (const p of payments) {
    const key = format(new Date(p.created_at), "yyyy-MM-dd");
    const row = map.get(key);
    if (row) {
      row.bruto += p.amount;
      row.comisiones += p.commission_amount ?? 0;
    }
  }

  // Aggregate COGS by sale creation date
  for (const i of items) {
    const key = cogsSaleDateMap.get(i.sale_id);
    const row = key ? map.get(key) : undefined;
    if (row) {
      row.cogs += i.qty * i.cost_price;
    }
  }

  // Aggregate expenses
  for (const e of expenses ?? []) {
    const row = map.get(e.date);
    if (row) {
      row.gastos += e.amount;
    }
  }

  // Compute derived fields
  const result = Array.from(map.values());
  for (const r of result) {
    r.neto = r.bruto - r.comisiones;
    r.ganancia = r.neto - r.cogs - r.gastos;
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchDayDetail(dateStr: string): Promise<DayDetail> {
  // Revenue: payments made on this day (by payment date, not sale date)
  const { data: rawPayments } = await supabase
    .from("pos_payments")
    .select("sale_id, amount, commission_amount")
    .gte("created_at", dayStart(dateStr))
    .lte("created_at", dayEnd(dateStr));

  const paymentSaleIds = [...new Set((rawPayments ?? []).map((p) => p.sale_id))];

  // Validate sales status
  const saleStatusMap = new Map<string, string>();
  if (paymentSaleIds.length > 0) {
    const { data: validSales } = await supabase
      .from("pos_sales")
      .select("id, status")
      .in("id", paymentSaleIds)
      .in("status", ["COMPLETED", "LAYAWAY"]);
    for (const s of validSales ?? []) saleStatusMap.set(s.id, s.status);
  }

  const payments = (rawPayments ?? []).filter((p) => saleStatusMap.has(p.sale_id));

  let bruto = 0;
  let comisiones = 0;
  for (const p of payments) {
    bruto += p.amount;
    comisiones += p.commission_amount ?? 0;
  }

  const ticketCount = new Set(payments.map((p) => p.sale_id)).size;
  const layawayCount = new Set(
    payments.filter((p) => saleStatusMap.get(p.sale_id) === "LAYAWAY").map((p) => p.sale_id)
  ).size;

  // COGS: sales *created* on this day (stock reserved at creation)
  const { data: cogsSales } = await supabase
    .from("pos_sales")
    .select("id")
    .in("status", ["COMPLETED", "LAYAWAY"])
    .gte("created_at", dayStart(dateStr))
    .lte("created_at", dayEnd(dateStr));

  const cogsSaleIds = (cogsSales ?? []).map((s) => s.id);
  let cogs = 0;
  if (cogsSaleIds.length > 0) {
    const { data: items } = await supabase
      .from("pos_sale_items")
      .select("qty, products(cost_price)")
      .in("sale_id", cogsSaleIds)
      .eq("owner", "LOCAL");
    for (const i of items ?? []) {
      cogs += i.qty * ((i as any).products?.cost_price ?? 0);
    }
  }

  // Expenses
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("date", dateStr)
    .eq("is_pass_through", false)
    .order("created_at", { ascending: false });

  return {
    ticketCount,
    layawayCount,
    bruto,
    comisiones,
    cogs,
    expenses: (expenses ?? []) as Expense[],
  };
}

// ─── Capital ─────────────────────────────────────────────────────────

export interface FundMovement {
  id: string;
  date: string;
  fund: string;
  amount: number;
  type: string; // INGRESO | RETIRO
  description: string | null;
  created_at: string;
}

export async function fetchCapitalRange(from: string, to: string) {
  const [
    { data: payments },
    { data: expenses },
    { data: movements },
    { data: obEfectivo },
    { data: obMercadoPago },
    purchaseTotals,
  ] = await Promise.all([
    supabase.from("pos_payments")
      .select("fund, amount, commission_amount, sale_id, pos_sales!inner(created_at, status)")
      .gte("pos_sales.created_at", dayStart(from))
      .lte("pos_sales.created_at", dayEnd(to))
      .in("pos_sales.status", ["COMPLETED", "LAYAWAY"]),
    supabase.from("expenses")
      .select("fund, amount")
      .gte("date", from)
      .lte("date", to),
    supabase.from("fund_movements")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("created_at", { ascending: false }),
    supabase.from("cash_opening_balances")
      .select("*")
      .eq("fund", "EFECTIVO")
      .lte("date", from)
      .order("date", { ascending: false })
      .limit(1),
    supabase.from("cash_opening_balances")
      .select("*")
      .eq("fund", "MERCADOPAGO")
      .lte("date", from)
      .order("date", { ascending: false })
      .limit(1),
    fetchPurchasesTotalByFund(from, to),
  ]);

  return aggregateCapital(payments, expenses, movements, obEfectivo, obMercadoPago, purchaseTotals);
}

export async function fetchCapitalCurrent() {
  const today = format(new Date(), "yyyy-MM-dd");

  const [
    { data: payments },
    { data: expenses },
    { data: movements },
    { data: obEfectivo },
    { data: obMercadoPago },
    purchaseTotals,
  ] = await Promise.all([
    supabase.from("pos_payments")
      .select("fund, amount, commission_amount, sale_id, pos_sales!inner(created_at, status)")
      .in("pos_sales.status", ["COMPLETED", "LAYAWAY"]),
    supabase.from("expenses")
      .select("fund, amount"),
    supabase.from("fund_movements")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("cash_opening_balances")
      .select("*")
      .eq("fund", "EFECTIVO")
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(1),
    supabase.from("cash_opening_balances")
      .select("*")
      .eq("fund", "MERCADOPAGO")
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(1),
    fetchPurchasesTotalByFund(),
  ]);

  return aggregateCapital(payments, expenses, movements, obEfectivo, obMercadoPago, purchaseTotals);
}

function aggregateCapital(
  payments: any[] | null,
  expenses: any[] | null,
  movements: any[] | null,
  obEfectivo: any[] | null,
  obMercadoPago: any[] | null,
  purchaseTotals: { efectivo: number; mercadopago: number } = { efectivo: 0, mercadopago: 0 },
) {
  let entradasEf = 0, entradasMP = 0;

  for (const p of payments ?? []) {
    const amt = (p as any).amount ?? 0;
    if ((p as any).fund === "EFECTIVO") {
      entradasEf += amt;
    } else {
      entradasMP += amt;
    }
  }

  // Add fund movement ingresos to entradas
  for (const m of movements ?? []) {
    const mv = m as FundMovement;
    if (mv.type === "INGRESO") {
      if (mv.fund === "EFECTIVO") entradasEf += mv.amount;
      else entradasMP += mv.amount;
    }
  }

  const salidasEfectivo = (expenses ?? [])
    .filter((e: any) => e.fund === "EFECTIVO")
    .reduce((sum: number, e: any) => sum + e.amount, 0);
  const salidasMP = (expenses ?? [])
    .filter((e: any) => e.fund === "MERCADOPAGO")
    .reduce((sum: number, e: any) => sum + e.amount, 0);

  // Add fund movement retiros to salidas
  let retiroEf = 0, retiroMP = 0;
  for (const m of movements ?? []) {
    const mv = m as FundMovement;
    if (mv.type === "RETIRO") {
      if (mv.fund === "EFECTIVO") retiroEf += mv.amount;
      else retiroMP += mv.amount;
    }
  }

  const totalSalidasEf = salidasEfectivo + retiroEf;
  const totalSalidasMP = salidasMP + retiroMP;

  const siEfectivo = obEfectivo?.[0]?.amount ?? null;
  const siMP = obMercadoPago?.[0]?.amount ?? null;

  const funds: CapitalFund[] = [
    {
      fund: "EFECTIVO",
      saldoInicial: siEfectivo ?? 0,
      entradas: entradasEf,
      salidas: totalSalidasEf,
      compras: purchaseTotals.efectivo,
      esperado: (siEfectivo ?? 0) + entradasEf - totalSalidasEf - purchaseTotals.efectivo,
    },
    {
      fund: "MERCADOPAGO",
      saldoInicial: siMP ?? 0,
      entradas: entradasMP,
      salidas: totalSalidasMP,
      compras: purchaseTotals.mercadopago,
      esperado: (siMP ?? 0) + entradasMP - totalSalidasMP - purchaseTotals.mercadopago,
    },
  ];

  return {
    funds,
    movements: (movements ?? []) as FundMovement[],
    missingSaldoInicial: siEfectivo === null || siMP === null,
    openingBalances: {
      efectivo: obEfectivo?.[0] as OpeningBalance | undefined,
      mercadopago: obMercadoPago?.[0] as OpeningBalance | undefined,
    },
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────

export async function createExpense(data: {
  date: string;
  amount: number;
  payment_method: string;
  category: string;
  description: string;
}) {
  const fund = computeFund(data.payment_method);
  const is_pass_through = data.category === "Rendición restaurante";

  const { error } = await supabase.from("expenses").insert({
    date: data.date,
    amount: data.amount,
    payment_method: data.payment_method,
    fund,
    category: data.category,
    description: data.description,
    is_pass_through,
  });

  if (error) throw error;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchExpensesRange(from: string, to: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function upsertOpeningBalance(
  date: string,
  fund: string,
  amount: number,
  notes: string
) {
  const { data: existing } = await supabase
    .from("cash_opening_balances")
    .select("id")
    .eq("date", date)
    .eq("fund", fund)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("cash_opening_balances")
      .update({ amount, notes })
      .eq("id", existing[0].id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("cash_opening_balances")
      .insert({ date, fund, amount, notes });
    if (error) throw error;
  }
}

export async function createFundMovement(data: {
  date: string;
  fund: string;
  amount: number;
  type: string;
  description: string;
}) {
  const { error } = await supabase.from("fund_movements").insert(data);
  if (error) throw error;
}

export async function deleteFundMovement(id: string) {
  const { error } = await supabase.from("fund_movements").delete().eq("id", id);
  if (error) throw error;
}
