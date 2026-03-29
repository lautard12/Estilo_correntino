import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Receipt, Search, RotateCcw, CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { fetchRecentSales, processReturn, type SaleForReturn } from "@/lib/return-store";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/config/TablePagination";

const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  QR: "QR",
  MERCADOPAGO: "MercadoPago",
};

function PaymentBadges({ payments }: { payments: SaleForReturn["payments"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {payments.map((p, i) => (
        <Badge key={i} variant="secondary" className="text-xs">
          {PAYMENT_LABELS[p.payment_method] ?? p.payment_method}
          {p.installments > 1 && ` ${p.installments}c`}
        </Badge>
      ))}
    </div>
  );
}

/* ── Financial Summary Block (Detail Dialog) ── */
function FinancialSummary({ sale }: { sale: SaleForReturn }) {
  const bruto = (sale as any).bruto ?? sale.total;
  const comisiones = (sale as any).comisiones ?? 0;
  const neto = (sale as any).neto ?? sale.total;
  const cogs = (sale as any).cogs ?? 0;
  const margen = (sale as any).margen ?? 0;

  return (
    <div className="rounded-md border p-3 space-y-1">
      <p className="text-sm font-medium text-muted-foreground mb-2">Resumen financiero</p>
      <div className="flex justify-between text-sm">
        <span>Cobrado (Bruto)</span>
        <span className="font-medium">{fmt(bruto)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Comisiones</span>
        <span className="font-medium text-orange-500">-{fmt(Math.abs(comisiones))}</span>
      </div>
      <div className="flex justify-between text-sm border-t pt-1">
        <span className="font-medium">Neto (te queda)</span>
        <span className="font-bold text-green-600">{fmt(neto)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Costo mercadería (COGS)</span>
        <span className="font-medium text-amber-600">-{fmt(Math.abs(cogs))}</span>
      </div>
      <div className="flex justify-between text-sm border-t pt-1">
        <span className="font-medium">Margen</span>
        <span className={`font-bold ${margen >= 0 ? "text-green-600" : "text-red-500"}`}>
          {fmt(margen)}
        </span>
      </div>
    </div>
  );
}

/* ── Payment Detail Line ── */
function PaymentDetailLine({ p }: { p: SaleForReturn["payments"][number] }) {
  const comm = (p as any).commission_amount;
  const hasComm = comm != null && comm !== 0;

  return (
    <div className="py-1 border-b last:border-0">
      <div className="flex justify-between text-sm">
        <span>
          {PAYMENT_LABELS[p.payment_method] ?? p.payment_method}
          {p.installments > 1 && ` (${p.installments} cuotas)`}
        </span>
        <span className="font-medium">{fmt(p.amount)}</span>
      </div>
      {hasComm && comm > 0 && (
        <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
          <span className="text-orange-500">Comisión: -{fmt(comm)}</span>
          <span className="text-green-600">Neto: {fmt(p.amount - comm)}</span>
        </div>
      )}
      {hasComm && comm < 0 && (
        <div className="text-xs text-muted-foreground mt-0.5">
          <span className="text-green-600">Descuento efectivo: +{fmt(Math.abs(comm))}</span>
        </div>
      )}
    </div>
  );
}

/* ── Item Detail Line ── */
function ItemDetailLine({ item }: { item: SaleForReturn["items"][number] }) {
  const isDiscount = (item as any).item_type === "DISCOUNT" || item.line_total < 0;

  if (isDiscount) {
    return (
      <div className="py-1 border-b last:border-0">
        <div className="flex justify-between text-sm">
          <span className="text-primary font-medium">
            {item.name_snapshot}
          </span>
          <span className="font-bold text-primary">
            {item.line_total < 0 ? "-" : ""}${Math.abs(item.line_total).toLocaleString("es-AR")}
          </span>
        </div>
      </div>
    );
  }

  const costTotal = (item as any).cost_total;
  const costUnit = (item as any).cost_unit;
  const hasCost = costTotal != null || costUnit != null;
  const resolvedCostTotal = costTotal ?? (costUnit != null ? costUnit * item.qty : null);
  const lineMargin = resolvedCostTotal != null ? item.line_total - resolvedCostTotal : null;

  return (
    <div className="py-1 border-b last:border-0">
      <div className="flex justify-between text-sm">
        <span>
          {item.name_snapshot}
          {item.variant_snapshot && ` ${item.variant_snapshot}`}
          {" "}×{item.qty}
        </span>
        <span className="font-medium">{fmt(item.line_total)}</span>
      </div>
      {hasCost && resolvedCostTotal != null && (
        <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
          <span className="text-amber-600">Costo: {fmt(resolvedCostTotal)}</span>
          {lineMargin != null && (
            <span className={lineMargin >= 0 ? "text-green-600" : "text-red-500"}>
              Margen: {fmt(lineMargin)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Ventas() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sellerFilter, setSellerFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [detailSale, setDetailSale] = useState<SaleForReturn | null>(null);

  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [hourFrom, setHourFrom] = useState("");
  const [hourTo, setHourTo] = useState("");

  const [returnSale, setReturnSale] = useState<SaleForReturn | null>(null);
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["recent-sales"],
    queryFn: () => fetchRecentSales(100),
  });

  const sellers = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => set.add(s.seller_name));
    return Array.from(set).sort();
  }, [sales]);

  const filtered = useMemo(() => {
    let items = sales;
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((sale) =>
        sale.items.some((i) => i.name_snapshot.toLowerCase().includes(s))
      );
    }
    if (sellerFilter !== "ALL") {
      items = items.filter((s) => s.seller_name === sellerFilter);
    }
    if (methodFilter !== "ALL") {
      items = items.filter((s) =>
        s.payments.some((p) => p.payment_method === methodFilter)
      );
    }
    if (dateFilter) {
      const dayStart = startOfDay(dateFilter);
      const dayEnd = endOfDay(dateFilter);
      items = items.filter((s) => {
        const d = new Date(s.created_at);
        return isWithinInterval(d, { start: dayStart, end: dayEnd });
      });
    }
    if (hourFrom) {
      const [hh, mm] = hourFrom.split(":").map(Number);
      items = items.filter((s) => {
        const d = new Date(s.created_at);
        return d.getHours() > hh || (d.getHours() === hh && d.getMinutes() >= mm);
      });
    }
    if (hourTo) {
      const [hh, mm] = hourTo.split(":").map(Number);
      items = items.filter((s) => {
        const d = new Date(s.created_at);
        return d.getHours() < hh || (d.getHours() === hh && d.getMinutes() <= mm);
      });
    }
    return items;
  }, [sales, search, sellerFilter, methodFilter, dateFilter, hourFrom, hourTo]);

  const { page, totalPages, paged, setPage, total } = usePagination(filtered, 10);

  const openReturn = (sale: SaleForReturn) => {
    setReturnSale(sale);
    setReturnItems({});
    setDetailSale(null);
  };

  const toggleItem = (itemId: string, maxQty: number) => {
    setReturnItems((prev) => {
      if (prev[itemId]) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: maxQty };
    });
  };

  const updateReturnQty = (itemId: string, qty: number) => {
    setReturnItems((prev) => ({ ...prev, [itemId]: qty }));
  };

  const handleReturn = async () => {
    if (!returnSale) return;
    const items = Object.entries(returnItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = returnSale.items.find((i) => i.id === itemId)!;
        return { product_id: item.product_id, qty, name: item.name_snapshot };
      });

    if (items.length === 0) {
      toast.error("Seleccioná al menos un producto");
      return;
    }

    setProcessing(true);
    try {
      await processReturn(returnSale.id, items);
      toast.success("Devolución procesada, stock actualizado");
      setReturnSale(null);
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
      qc.invalidateQueries({ queryKey: ["recent-sales"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Historial de Ventas</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Detalle de cada venta: quién vendió, medio de pago y productos. Podés procesar devoluciones desde acá.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={sellerFilter} onValueChange={setSellerFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {sellers.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Medio de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date & Hour Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilter ? format(dateFilter, "dd/MM/yyyy") : "Filtrar por día"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={setDateFilter}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {dateFilter && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDateFilter(undefined)}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Desde</span>
          <Input
            type="time"
            value={hourFrom}
            onChange={(e) => setHourFrom(e.target.value)}
            className="w-[110px] h-9"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Hasta</span>
          <Input
            type="time"
            value={hourTo}
            onChange={(e) => setHourTo(e.target.value)}
            className="w-[110px] h-9"
          />
        </div>
        {(hourFrom || hourTo) && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setHourFrom(""); setHourTo(""); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay ventas.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Medio de pago</TableHead>
                <TableHead className="hidden lg:table-cell">Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right hidden md:table-cell">Neto</TableHead>
                <TableHead className="text-right hidden md:table-cell">Margen</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((s) => {
                const saleNeto = (s as any).neto ?? 0;
                const saleMargen = (s as any).margen ?? 0;
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailSale(s)}
                  >
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(s.created_at), "dd/MM HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="text-sm">{s.seller_name}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {s.items.filter((i) => (i as any).item_type !== "DISCOUNT").map((i) => `${i.name_snapshot} ×${i.qty}`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <PaymentBadges payments={s.payments} />
                    </TableCell>
                    <TableCell className="text-sm hidden lg:table-cell truncate max-w-[120px]">
                      {s.customer_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(s.total)}
                      {/* Mobile-only: neto & margen below total */}
                      <div className="md:hidden text-xs mt-1 space-y-0.5">
                        <div className="text-green-600">Neto: {fmt(saleNeto)}</div>
                        <div className={saleMargen >= 0 ? "text-green-600" : "text-red-500"}>
                          Margen: {fmt(saleMargen)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium hidden md:table-cell">
                      {fmt(saleNeto)}
                    </TableCell>
                    <TableCell className={`text-right font-medium hidden md:table-cell ${saleMargen >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {fmt(saleMargen)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); openReturn(s); }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Devolver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailSale} onOpenChange={() => setDetailSale(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de venta</DialogTitle>
            <DialogDescription>
              {detailSale && format(new Date(detailSale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
            </DialogDescription>
          </DialogHeader>
          {detailSale && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vendedor</p>
                <p className="text-sm">{detailSale.seller_name}</p>
              </div>

              {detailSale.customer_name && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                  <p className="text-sm">
                    {detailSale.customer_name}
                    {detailSale.customer_email && (
                      <span className="text-muted-foreground ml-1">({detailSale.customer_email})</span>
                    )}
                  </p>
                </div>
              )}

              {/* Financial Summary */}
              <FinancialSummary sale={detailSale} />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Productos</p>
                {detailSale.items.map((item) => (
                  <ItemDetailLine key={item.id} item={item} />
                ))}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Pagos</p>
                {detailSale.payments.map((p, i) => (
                  <PaymentDetailLine key={i} p={p} />
                ))}
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Total</span>
                <span>{fmt(detailSale.total)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailSale(null)}>Cerrar</Button>
            <Button onClick={() => detailSale && openReturn(detailSale)}>
              <RotateCcw className="h-3 w-3 mr-1" /> Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Modal */}
      <Dialog open={!!returnSale} onOpenChange={() => setReturnSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Procesar devolución</DialogTitle>
            <DialogDescription>
              Seleccioná los productos a devolver. El stock se actualizará automáticamente.
            </DialogDescription>
          </DialogHeader>
          {returnSale && (
            <div className="space-y-3">
              {returnSale.items
                .filter((item) => (item as any).item_type !== "DISCOUNT" && item.line_total >= 0)
                .map((item) => {
                  const checked = !!returnItems[item.id];
                  return (
                    <div key={item.id} className="flex items-center gap-3 border rounded-md p-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleItem(item.id, item.qty)}
                      />
                      <div className="flex-1 text-sm">
                        <p className="font-medium">
                          {item.name_snapshot}
                          {item.variant_snapshot && ` ${item.variant_snapshot}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vendido: {item.qty} — {fmt(item.unit_price)} c/u
                        </p>
                      </div>
                      {checked && (
                        <Input
                          type="number"
                          min={1}
                          max={item.qty}
                          value={returnItems[item.id]}
                          onChange={(e) =>
                            updateReturnQty(item.id, Math.min(item.qty, Math.max(1, parseInt(e.target.value) || 1)))
                          }
                          className="w-16 h-8"
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnSale(null)} disabled={processing}>
              Cancelar
            </Button>
            <Button onClick={handleReturn} disabled={processing || Object.keys(returnItems).length === 0}>
              {processing ? "Procesando…" : "Confirmar devolución"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
