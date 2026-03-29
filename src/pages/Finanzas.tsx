import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Wallet, Plus, TrendingUp, TrendingDown, DollarSign, Trash2, AlertTriangle, Receipt, Filter, ArrowDown, ArrowRight, Minus, ChevronRight, BarChart3, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import {
  fetchResultadoRange,
  fetchDayDetail,
  fetchCapitalCurrent,
  fetchExpensesRange,
  createExpense,
  deleteExpense,
  upsertOpeningBalance,
  createFundMovement,
  deleteFundMovement,
  computeFund,
  type DayRow,
  type DayDetail,
  type Expense,
  type FundMovement,
} from "@/lib/finanzas-store";

const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;

const CATEGORIES = [
  "Alquiler",
  "Servicios",
  "Sueldos",
  "Impuestos",
  "Limpieza",
  "Otros",
  "Rendición restaurante",
];

const PAYMENT_METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "DEBITO", label: "Débito" },
  { value: "CREDITO", label: "Crédito" },
  { value: "QR", label: "QR" },
  { value: "MERCADOPAGO", label: "MercadoPago" },
];

type RangePreset = "today" | "7days" | "month" | "custom";

export default function Finanzas() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [preset, setPreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  const { from, to } = useMemo(() => {
    switch (preset) {
      case "today":
        return { from: today, to: today };
      case "7days":
        return { from: format(subDays(new Date(), 6), "yyyy-MM-dd"), to: today };
      case "month":
        return { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: today };
      case "custom":
        return { from: customFrom, to: customTo };
    }
  }, [preset, customFrom, customTo, today]);

  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);

  const resultadoQ = useQuery({
    queryKey: ["finanzas-resultado", from, to],
    queryFn: () => fetchResultadoRange(from, to),
  });

  const capitalQ = useQuery({
    queryKey: ["finanzas-capital"],
    queryFn: () => fetchCapitalCurrent(),
  });

  const gastosQ = useQuery({
    queryKey: ["finanzas-gastos", from, to],
    queryFn: () => fetchExpensesRange(from, to),
  });

  const dayDetailQ = useQuery({
    queryKey: ["finanzas-day", dayDetailDate],
    queryFn: () => fetchDayDetail(dayDetailDate!),
    enabled: !!dayDetailDate,
  });

  const [gastosCategoryFilter, setGastosCategoryFilter] = useState<string>("ALL");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["finanzas-resultado"] });
    qc.invalidateQueries({ queryKey: ["finanzas-capital"] });
    qc.invalidateQueries({ queryKey: ["finanzas-day"] });
    qc.invalidateQueries({ queryKey: ["finanzas-gastos"] });
  };

  const rows = resultadoQ.data ?? [];
  const totalBruto = rows.reduce((s, r) => s + r.bruto, 0);
  const totalComisiones = rows.reduce((s, r) => s + r.comisiones, 0);
  const totalNeto = totalBruto - totalComisiones;
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0);
  const totalGastos = rows.reduce((s, r) => s + r.gastos, 0);
  const totalMargenBruto = totalNeto - totalCogs;
  const totalGanancia = totalMargenBruto - totalGastos;

  const capital = capitalQ.data;
  const allZero = totalBruto === 0 && totalGastos === 0 && totalCogs === 0;

  const presetLabel = preset === "today" ? "Hoy" : preset === "7days" ? "Últimos 7 días" : preset === "month" ? "Este mes" : "Período personalizado";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <Wallet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Finanzas</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Entendé cuánto vendiste, cuánto te quedó y si realmente ganaste plata.
        </p>
      </div>

      <Tabs defaultValue="resultado">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="resultado" className="flex-1">Resultado</TabsTrigger>
          <TabsTrigger value="gastos" className="flex-1">Gastos</TabsTrigger>
          <TabsTrigger value="capital" className="flex-1">Capital</TabsTrigger>
        </TabsList>

        {/* ═══════════════════ TAB RESULTADO ═══════════════════ */}
        <TabsContent value="resultado" className="space-y-6 mt-4">
          {/* Filtros compactos */}
          <div className="flex flex-wrap items-center gap-2">
            {(["today", "7days", "month", "custom"] as RangePreset[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={preset === p ? "default" : "outline"}
                onClick={() => setPreset(p)}
                className="h-8 text-xs"
              >
                {p === "today" ? "Hoy" : p === "7days" ? "7 días" : p === "month" ? "Mes" : "Custom"}
              </Button>
            ))}
            {preset === "custom" && (
              <div className="flex gap-2 items-center ml-1">
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36 h-8 text-xs" />
                <span className="text-xs text-muted-foreground">a</span>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36 h-8 text-xs" />
              </div>
            )}
            <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
              {format(new Date(from + "T12:00:00"), "dd/MM/yyyy")} — {format(new Date(to + "T12:00:00"), "dd/MM/yyyy")}
            </span>
          </div>

          {resultadoQ.isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Cargando…</p>
          ) : allZero && rows.length <= 1 ? (
            /* Estado vacío */
            <EmptyFinanceState />
          ) : (
            <>
              {/* KPIs principales */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label="Ganancia neta"
                  value={totalGanancia}
                  highlight
                  positive={totalGanancia >= 0}
                  icon={TrendingUp}
                />
                <KpiCard
                  label="Ventas brutas"
                  value={totalBruto}
                  icon={DollarSign}
                />
                <KpiCard
                  label="Margen bruto"
                  value={totalMargenBruto}
                  positive={totalMargenBruto >= 0}
                  icon={BarChart3}
                />
                <KpiCard
                  label="Gastos operativos"
                  value={totalGastos}
                  negative
                  icon={TrendingDown}
                />
              </div>

              {/* Card cascada */}
              <WaterfallCard
                bruto={totalBruto}
                comisiones={totalComisiones}
                neto={totalNeto}
                cogs={totalCogs}
                margenBruto={totalMargenBruto}
                gastos={totalGastos}
                ganancia={totalGanancia}
                periodLabel={presetLabel}
              />

              {/* Tabla diaria */}
              <DailyTable rows={rows} onDayClick={setDayDetailDate} />
            </>
          )}
        </TabsContent>

        {/* ═══════════════════ TAB GASTOS ═══════════════════ */}
        <TabsContent value="gastos" className="space-y-4 mt-4">
          {/* Filtros de fecha para gastos */}
          <div className="flex flex-wrap items-center gap-2">
            {(["today", "7days", "month", "custom"] as RangePreset[]).map((p) => (
              <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => setPreset(p)} className="h-8 text-xs">
                {p === "today" ? "Hoy" : p === "7days" ? "7 días" : p === "month" ? "Mes" : "Custom"}
              </Button>
            ))}
            {preset === "custom" && (
              <div className="flex gap-2 items-center ml-1">
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36 h-8 text-xs" />
                <span className="text-xs text-muted-foreground">a</span>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36 h-8 text-xs" />
              </div>
            )}
          </div>

          {(() => {
            const allExpenses = gastosQ.data ?? [];
            const operatingExpenses = allExpenses.filter(e => !e.is_pass_through);
            const passThrough = allExpenses.filter(e => e.is_pass_through);

            const catMap = new Map<string, { total: number; count: number }>();
            for (const e of operatingExpenses) {
              const cat = e.category || "Sin categoría";
              const prev = catMap.get(cat) ?? { total: 0, count: 0 };
              catMap.set(cat, { total: prev.total + e.amount, count: prev.count + 1 });
            }
            const catEntries = Array.from(catMap.entries()).sort((a, b) => b[1].total - a[1].total);
            const totalOp = operatingExpenses.reduce((s, e) => s + e.amount, 0);
            const totalPT = passThrough.reduce((s, e) => s + e.amount, 0);

            const filtered = gastosCategoryFilter === "ALL"
              ? allExpenses
              : gastosCategoryFilter === "PASS_THROUGH"
                ? passThrough
                : operatingExpenses.filter(e => (e.category || "Sin categoría") === gastosCategoryFilter);

            const methodMap = new Map<string, number>();
            for (const e of operatingExpenses) {
              methodMap.set(e.payment_method, (methodMap.get(e.payment_method) ?? 0) + e.amount);
            }

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard icon={Receipt} label="Gastos operativos" value={totalOp} negative />
                  <KpiCard icon={Receipt} label="Rendiciones" value={totalPT} icon2Color="text-amber-500" />
                  <KpiCard icon={Receipt} label="Total egresos" value={totalOp + totalPT} negative />
                </div>

                {catEntries.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Desglose por categoría</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {catEntries.map(([cat, { total, count }]) => {
                        const pct = totalOp > 0 ? Math.round((total / totalOp) * 100) : 0;
                        return (
                          <div key={cat} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                className="font-medium hover:underline"
                                onClick={() => setGastosCategoryFilter(gastosCategoryFilter === cat ? "ALL" : cat)}
                              >
                                {cat}
                              </button>
                              <Badge variant="secondary" className="text-xs">{count}</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-20 bg-muted rounded-full h-2 overflow-hidden">
                                <div className="bg-destructive h-2 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-muted-foreground text-xs w-8 text-right">{pct}%</span>
                              <span className="font-bold text-destructive w-24 text-right">{fmt(total)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {methodMap.size > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Por medio de pago</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3">
                        {Array.from(methodMap.entries()).map(([method, total]) => (
                          <div key={method} className="text-sm border rounded-md px-3 py-1.5">
                            <span className="text-muted-foreground">{method}</span>
                            <span className="ml-2 font-bold">{fmt(total)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={gastosCategoryFilter} onValueChange={setGastosCategoryFilter}>
                      <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas las categorías</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="PASS_THROUGH">Rendiciones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={() => setShowExpenseModal(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Registrar gasto
                  </Button>
                </div>

                {gastosQ.isLoading ? (
                  <p className="text-muted-foreground text-sm">Cargando…</p>
                ) : filtered.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin gastos en el rango.</p>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((e) => (
                      <div key={e.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{e.category || "Sin categoría"}</span>
                            {e.is_pass_through && <Badge variant="outline" className="text-xs">Rendición</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(e.date + "T12:00:00"), "dd/MM/yyyy")}
                            {e.description ? ` — ${e.description}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">{e.payment_method} → {e.fund}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-destructive">{fmt(e.amount)}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                            await deleteExpense(e.id);
                            toast.success("Gasto eliminado");
                            invalidate();
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* ═══════════════════ TAB CAPITAL ═══════════════════ */}
        <TabsContent value="capital" className="space-y-4 mt-4">
          {capital?.missingSaldoInicial && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Cargá saldo inicial para calcular capital correctamente.</AlertDescription>
            </Alert>
          )}

          {capital && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard icon={DollarSign} label="Efectivo esp." value={capital.funds[0].esperado} positive={capital.funds[0].esperado >= 0} />
                <KpiCard icon={DollarSign} label="MercadoPago esp." value={capital.funds[1].esperado} positive={capital.funds[1].esperado >= 0} />
                <KpiCard icon={DollarSign} label="Total" value={capital.funds[0].esperado + capital.funds[1].esperado} highlight positive={(capital.funds[0].esperado + capital.funds[1].esperado) >= 0} />
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowBalanceModal(true)}>
                  Editar saldo inicial
                </Button>
                <Button size="sm" onClick={() => setShowFundModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar / Retirar fondos
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowExpenseModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Registrar gasto
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fondo</TableHead>
                      <TableHead className="text-right">Saldo inicial</TableHead>
                      <TableHead className="text-right">Entradas</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capital.funds.map((f) => (
                      <TableRow key={f.fund}>
                        <TableCell className="font-medium">{f.fund}</TableCell>
                        <TableCell className="text-right">{fmt(f.saldoInicial)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{fmt(f.entradas)}</TableCell>
                        <TableCell className="text-right text-destructive">{fmt(f.salidas)}</TableCell>
                        <TableCell className="text-right text-amber-600">{fmt(f.compras)}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(f.esperado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {capital.movements && capital.movements.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Movimientos de fondos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {capital.movements.map((m) => (
                      <div key={m.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                        <div>
                          <p className="font-medium">
                            {m.type === "INGRESO" ? "Ingreso" : "Retiro"} — {m.fund}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(m.date + "T12:00:00"), "dd/MM/yyyy")}
                            {m.description ? ` — ${m.description}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${m.type === "INGRESO" ? "text-emerald-600" : "text-destructive"}`}>
                            {m.type === "INGRESO" ? "+" : "-"}{fmt(m.amount)}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                            await deleteFundMovement(m.id);
                            toast.success("Movimiento eliminado");
                            invalidate();
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {capitalQ.isLoading && <p className="text-muted-foreground text-sm">Cargando…</p>}
        </TabsContent>

      </Tabs>

      {/* Modals */}
      <DayDetailDialog
        date={dayDetailDate}
        data={dayDetailQ.data}
        loading={dayDetailQ.isLoading}
        onClose={() => setDayDetailDate(null)}
        onDeleteExpense={async (id) => {
          await deleteExpense(id);
          toast.success("Gasto eliminado");
          invalidate();
          qc.invalidateQueries({ queryKey: ["finanzas-day", dayDetailDate] });
        }}
      />

      <ExpenseModal
        open={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSaved={() => {
          invalidate();
          setShowExpenseModal(false);
        }}
      />

      <BalanceModal
        open={showBalanceModal}
        onClose={() => setShowBalanceModal(false)}
        onSaved={() => {
          invalidate();
          setShowBalanceModal(false);
        }}
      />

      <FundMovementModal
        open={showFundModal}
        onClose={() => setShowFundModal(false)}
        onSaved={() => {
          invalidate();
          setShowFundModal(false);
        }}
      />
    </div>
  );
}

/* ═══════════════════ COMPONENTES INTERNOS ═══════════════════ */

function EmptyFinanceState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Todavía no hay movimientos en este período</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Cuando registres ventas y gastos, vas a ver acá la rentabilidad del negocio.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  highlight,
  positive,
  negative,
  icon2Color,
}: {
  label: string;
  value: number;
  icon?: any;
  highlight?: boolean;
  positive?: boolean;
  negative?: boolean;
  icon2Color?: string;
}) {
  let valueColor = "text-foreground";
  if (highlight && positive !== undefined) {
    valueColor = positive ? "text-emerald-600" : "text-destructive";
  } else if (negative) {
    valueColor = "text-destructive";
  } else if (positive !== undefined) {
    valueColor = positive ? "text-emerald-600" : "text-destructive";
  }

  return (
    <Card className={highlight ? "border-2 border-primary/20 bg-primary/[0.02]" : ""}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          {Icon && <Icon className={`h-4 w-4 ${icon2Color || "text-muted-foreground/50"}`} />}
        </div>
        <p className={`text-xl font-bold tabular-nums ${valueColor}`}>{fmt(value)}</p>
      </CardContent>
    </Card>
  );
}

function WaterfallCard({
  bruto,
  comisiones,
  neto,
  cogs,
  margenBruto,
  gastos,
  ganancia,
  periodLabel,
}: {
  bruto: number;
  comisiones: number;
  neto: number;
  cogs: number;
  margenBruto: number;
  gastos: number;
  ganancia: number;
  periodLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Cómo se forma tu ganancia</CardTitle>
        <p className="text-xs text-muted-foreground">Resumen — {periodLabel}</p>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Rows */}
        <WaterfallRow label="Ventas brutas" value={bruto} type="base" />
        <WaterfallRow label="Comisiones" value={comisiones} type="subtract" />
        <WaterfallRow label="Neto cobrado" value={neto} type="subtotal" />
        <WaterfallRow label="Costo de mercadería" value={cogs} type="subtract" />
        <WaterfallRow label="Margen bruto" value={margenBruto} type="subtotal" />
        <WaterfallRow label="Gastos operativos" value={gastos} type="subtract" />
        <WaterfallRow label="Ganancia neta" value={ganancia} type="result" />
      </CardContent>
    </Card>
  );
}

function WaterfallRow({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: "base" | "subtract" | "subtotal" | "result";
}) {
  const isResult = type === "result";
  const isSubtotal = type === "subtotal";
  const isSubtract = type === "subtract";

  let textColor = "text-foreground";
  let valueDisplay = fmt(value);

  if (isSubtract) {
    textColor = "text-destructive/80";
    valueDisplay = value > 0 ? `−${fmt(value)}` : "—";
  } else if (isSubtotal) {
    textColor = value >= 0 ? "text-foreground" : "text-destructive";
  } else if (isResult) {
    textColor = value >= 0 ? "text-emerald-600" : "text-destructive";
  }

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-1 ${
        isResult
          ? "border-t-2 border-foreground/20 mt-1 pt-3"
          : isSubtotal
            ? "border-t border-border"
            : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {isSubtract && <Minus className="h-3 w-3 text-destructive/60" />}
        <span
          className={`text-sm ${
            isResult ? "font-bold text-base" : isSubtotal ? "font-semibold" : isSubtract ? "text-muted-foreground" : "font-medium"
          }`}
        >
          {label}
        </span>
      </div>
      <span
        className={`tabular-nums ${textColor} ${
          isResult ? "text-lg font-bold" : isSubtotal ? "font-semibold" : "font-medium text-sm"
        }`}
      >
        {valueDisplay}
      </span>
    </div>
  );
}

function DailyTable({ rows, onDayClick }: { rows: DayRow[]; onDayClick: (date: string) => void }) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Detalle diario del período</h3>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">Día</TableHead>
              <TableHead className="text-right text-xs">Ventas</TableHead>
              <TableHead className="text-right text-xs hidden md:table-cell">Comisiones</TableHead>
              <TableHead className="text-right text-xs hidden md:table-cell">Neto cobrado</TableHead>
              <TableHead className="text-right text-xs hidden lg:table-cell">Costo merc.</TableHead>
              <TableHead className="text-right text-xs hidden lg:table-cell">Margen</TableHead>
              <TableHead className="text-right text-xs hidden md:table-cell">Gastos</TableHead>
              <TableHead className="text-right text-xs">Ganancia</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const neto = r.bruto - r.comisiones;
              const margen = neto - r.cogs;
              return (
                <TableRow
                  key={r.date}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => onDayClick(r.date)}
                >
                  <TableCell className="text-sm font-medium py-2.5">
                    {format(new Date(r.date + "T12:00:00"), "EEE dd/MM", { locale: es })}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums py-2.5">{fmt(r.bruto)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-destructive/70 hidden md:table-cell py-2.5">
                    {r.comisiones > 0 ? `−${fmt(r.comisiones)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums hidden md:table-cell py-2.5">{fmt(neto)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-destructive/70 hidden lg:table-cell py-2.5">
                    {r.cogs > 0 ? `−${fmt(r.cogs)}` : "—"}
                  </TableCell>
                  <TableCell className={`text-right text-sm tabular-nums hidden lg:table-cell py-2.5 ${margen >= 0 ? "" : "text-destructive"}`}>
                    {fmt(margen)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-destructive/70 hidden md:table-cell py-2.5">
                    {r.gastos > 0 ? `−${fmt(r.gastos)}` : "—"}
                  </TableCell>
                  <TableCell className={`text-right text-sm tabular-nums font-semibold py-2.5 ${r.ganancia >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {fmt(r.ganancia)}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ═══════════════════ MODALS (sin cambios de lógica) ═══════════════════ */

function DayDetailDialog({
  date, data, loading, onClose, onDeleteExpense,
}: {
  date: string | null; data?: DayDetail; loading: boolean; onClose: () => void; onDeleteExpense: (id: string) => void;
}) {
  if (!date) return null;
  const totalGastosDay = data?.expenses.reduce((s, e) => s + e.amount, 0) ?? 0;
  const comisionesDay = data?.comisiones ?? 0;
  const netoDay = (data?.bruto ?? 0) - comisionesDay;
  const margenBrutoDay = netoDay - (data?.cogs ?? 0);
  const gananciaDay = margenBrutoDay - totalGastosDay;

  return (
    <Dialog open={!!date} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle — {format(new Date(date + "T12:00:00"), "EEEE dd/MM/yyyy", { locale: es })}</DialogTitle>
          <DialogDescription>Ventas y gastos operativos del día</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : data ? (
          <div className="space-y-4">
            <div className="space-y-0">
              <WaterfallRow label={`${data.ticketCount} tickets`} value={data.bruto} type="base" />
              <WaterfallRow label="Comisiones" value={comisionesDay} type="subtract" />
              <WaterfallRow label="Neto cobrado" value={netoDay} type="subtotal" />
              <WaterfallRow label="Costo de mercadería" value={data.cogs} type="subtract" />
              <WaterfallRow label="Margen bruto" value={margenBrutoDay} type="subtotal" />
              <WaterfallRow label="Gastos operativos" value={totalGastosDay} type="subtract" />
              <WaterfallRow label="Ganancia neta" value={gananciaDay} type="result" />
            </div>

            {data.expenses.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Gastos operativos</h4>
                <div className="space-y-2">
                  {data.expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                      <div>
                        <p className="font-medium">{e.category}</p>
                        <p className="text-xs text-muted-foreground">{e.description} — {e.payment_method}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-destructive">{fmt(e.amount)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteExpense(e.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [category, setCategory] = useState("Insumos");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fund = computeFund(method);

  const handleSave = async () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    setSaving(true);
    try {
      await createExpense({ date, amount: amt, payment_method: method, category, description });
      toast.success("Gasto registrado");
      setAmount("");
      setDescription("");
      onSaved();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar gasto</DialogTitle>
          <DialogDescription>Gasto operativo: afecta Resultado y Capital.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Medio de pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Fondo: {fund}</p>
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Opcional..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BalanceModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [efectivo, setEfectivo] = useState("");
  const [mp, setMp] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const efVal = parseInt(efectivo) || 0;
      const mpVal = parseInt(mp) || 0;
      await upsertOpeningBalance(date, "EFECTIVO", efVal, notes);
      await upsertOpeningBalance(date, "MERCADOPAGO", mpVal, notes);
      toast.success("Saldo inicial guardado");
      onSaved();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Saldo inicial</DialogTitle>
          <DialogDescription>Cargá el saldo real al inicio del período.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Efectivo</Label>
            <Input type="number" placeholder="0" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} />
          </div>
          <div>
            <Label>MercadoPago</Label>
            <Input type="number" placeholder="0" value={mp} onChange={(e) => setMp(e.target.value)} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opcional..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FundMovementModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [fund, setFund] = useState("EFECTIVO");
  const [type, setType] = useState("INGRESO");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    setSaving(true);
    try {
      await createFundMovement({ date, fund, amount: amt, type, description });
      toast.success(type === "INGRESO" ? "Ingreso registrado" : "Retiro registrado");
      setAmount("");
      setDescription("");
      onSaved();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar / Retirar fondos</DialogTitle>
          <DialogDescription>Registrá un ingreso o retiro de dinero del negocio.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INGRESO">Ingreso de dinero</SelectItem>
                <SelectItem value="RETIRO">Retiro de dinero</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fondo</Label>
            <Select value={fund} onValueChange={setFund}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                <SelectItem value="MERCADOPAGO">MercadoPago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ej: Aporte del dueño, retiro para pago..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
