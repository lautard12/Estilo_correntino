import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, DollarSign, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchDaySummary,
  fetchPaymentBreakdown,
  fetchProductLines,
} from "@/lib/cierre-store";
import { supabase } from "@/integrations/supabase/client";
import { dayStart, dayEnd } from "@/lib/date-utils";

const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  QR: "QR",
  MERCADOPAGO: "MercadoPago",
};

const FUND_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  MERCADOPAGO: "MercadoPago",
};

type CierreMode = "dia" | "semana";

// Reusable summary fetcher for a date range
async function fetchRangeSummary(from: string, to: string) {
  const { data } = await supabase
    .from("pos_sales")
    .select("total, subtotal_local, delivery_fee")
    .eq("status", "COMPLETED")
    .gte("created_at", dayStart(from))
    .lte("created_at", dayEnd(to));

  const rows = data || [];
  return {
    totalCobrado: rows.reduce((s, r) => s + r.total, 0),
    totalLocal: rows.reduce((s, r) => s + r.subtotal_local + r.delivery_fee, 0),
    totalDeliveryFee: rows.reduce((s, r) => s + r.delivery_fee, 0),
  };
}

async function fetchRangePayments(from: string, to: string) {
  const { data: sales } = await supabase
    .from("pos_sales")
    .select("id")
    .eq("status", "COMPLETED")
    .gte("created_at", dayStart(from))
    .lte("created_at", dayEnd(to));

  if (!sales?.length) return [];
  const { data: payments } = await supabase
    .from("pos_payments")
    .select("payment_method, fund, amount")
    .in("sale_id", sales.map((s) => s.id));

  const map = new Map<string, { payment_method: string; fund: string; total: number }>();
  for (const p of payments ?? []) {
    const key = `${p.payment_method}|${p.fund}`;
    const ex = map.get(key);
    if (ex) ex.total += p.amount;
    else map.set(key, { payment_method: p.payment_method, fund: p.fund, total: p.amount });
  }
  return Array.from(map.values());
}

async function fetchRangeProductLines(from: string, to: string) {
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

  const map = new Map<string, { name: string; qty: number; total: number }>();
  for (const item of items ?? []) {
    const name = item.variant_snapshot ? `${item.name_snapshot} ${item.variant_snapshot}` : item.name_snapshot;
    const ex = map.get(name);
    if (ex) { ex.qty += item.qty; ex.total += item.line_total; }
    else map.set(name, { name, qty: item.qty, total: item.line_total });
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export default function CierreDelDia() {
  const [mode, setMode] = useState<CierreMode>("dia");
  const [date, setDate] = useState<Date>(new Date());

  const dateStr = format(date, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const from = mode === "dia" ? dateStr : weekStart;
  const to = mode === "dia" ? dateStr : weekEnd;

  const rangeLabel = mode === "dia"
    ? format(date, "dd MMM yyyy", { locale: es })
    : `${format(new Date(weekStart + "T12:00:00"), "dd/MM")} — ${format(new Date(weekEnd + "T12:00:00"), "dd/MM/yyyy")}`;

  // Use range-based fetchers for both modes
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["cierre-summary", from, to],
    queryFn: () => mode === "dia" ? fetchDaySummary(dateStr) : fetchRangeSummary(from, to),
  });

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["cierre-payments", from, to],
    queryFn: () => mode === "dia" ? fetchPaymentBreakdown(dateStr) : fetchRangePayments(from, to),
  });

  const { data: localLines = [] } = useQuery({
    queryKey: ["cierre-local-lines", from, to],
    queryFn: () => mode === "dia" ? fetchProductLines(dateStr, "LOCAL") : fetchRangeProductLines(from, to),
  });

  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((p) => map.set(p.payment_method, (map.get(p.payment_method) || 0) + p.total));
    return Array.from(map.entries()).map(([method, total]) => ({ method, total }));
  }, [payments]);

  const byFund = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((p) => map.set(p.fund, (map.get(p.fund) || 0) + p.total));
    return Array.from(map.entries()).map(([fund, total]) => ({ fund, total }));
  }, [payments]);

  const loading = loadingSummary || loadingPayments;
  const totalCobrado = summary?.totalCobrado ?? 0;
  const totalLocal = summary?.totalLocal ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Cierre</h1>
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as CierreMode)}>
            <TabsList>
              <TabsTrigger value="dia">Día</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
            </TabsList>
          </Tabs>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {rangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : totalCobrado === 0 ? (
        <p className="text-muted-foreground text-center py-12">No hay ventas registradas para este período.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> Total cobrado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(totalCobrado)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Store className="h-4 w-4" /> Ventas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(totalLocal)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pagos del período</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Por método de pago</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {byMethod.map((m) => (
                    <div key={m.method} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">{METHOD_LABELS[m.method] || m.method}</p>
                      <p className="text-lg font-semibold">{fmt(m.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Por fondo</p>
                <div className="grid grid-cols-2 gap-2">
                  {byFund.map((f) => (
                    <div key={f.fund} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">{FUND_LABELS[f.fund] || f.fund}</p>
                      <p className="text-lg font-semibold">{fmt(f.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {localLines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Detalle de ventas</span>
                  <span className="text-lg">{fmt(totalLocal)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Unid.</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localLines.map((l) => (
                      <TableRow key={l.name}>
                        <TableCell>{l.name}</TableCell>
                        <TableCell className="text-right">{l.qty}</TableCell>
                        <TableCell className="text-right">{fmt(l.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
