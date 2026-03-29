import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, TrendingUp, ShoppingCart, Receipt, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  fetchCustomerRanking,
  fetchCustomerDetail,
  getPeriodRange,
  type CustomerRankingRow,
} from "@/lib/customer-stats-store";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/config/TablePagination";

const fmt = (n: number) =>
  "$" + n.toLocaleString("es-AR");

const PRESETS = [
  { key: "month", label: "Este mes" },
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
  { key: "custom", label: "Custom" },
] as const;

export default function ClientesStats() {
  const [preset, setPreset] = useState<string>("30");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [selected, setSelected] = useState<CustomerRankingRow | null>(null);

  const { from, to } = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return getPeriodRange(preset);
  }, [preset, customFrom, customTo]);

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["customer-ranking", from.toISOString(), to.toISOString()],
    queryFn: () => fetchCustomerRanking(from, to),
  });

  const { page, totalPages, paged, setPage, total } = usePagination(ranking, 15);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? "default" : "outline"}
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}

        {preset === "custom" && (
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {customFrom ? format(customFrom, "dd/MM/yyyy") : "Desde"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {customTo ? format(customTo, "dd/MM/yyyy") : "Hasta"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {ranking.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Clientes activos</p>
                <p className="text-xl font-bold">{ranking.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total facturado</p>
                <p className="text-xl font-bold">{fmt(ranking.reduce((s, r) => s + r.total_spent, 0))}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Receipt className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total ventas</p>
                <p className="text-xl font-bold">{ranking.reduce((s, r) => s + r.sale_count, 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No hay ventas con clientes registrados en este período.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Total gastado</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Ticket prom.</TableHead>
                <TableHead className="hidden md:table-cell">Última compra</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r, i) => (
                <TableRow
                  key={r.customer_id}
                  className="cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <TableCell className="text-muted-foreground">{(page - 1) * 15 + i + 1}</TableCell>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="text-right">{r.sale_count}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.total_spent)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{fmt(r.avg_ticket)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {format(new Date(r.last_purchase), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* Detail sheet */}
      {selected && (
        <CustomerDetailSheet
          customer={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function CustomerDetailSheet({
  customer,
  onClose,
}: {
  customer: CustomerRankingRow;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", customer.customer_id],
    queryFn: () => fetchCustomerDetail(customer.customer_id),
  });

  const chartData = useMemo(() => {
    if (!data?.monthlySpend) return [];
    return data.monthlySpend.map((m) => ({
      name: format(new Date(m.month + "-01"), "MMM", { locale: es }),
      total: m.total,
    }));
  }, [data]);

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{customer.full_name}</SheetTitle>
          <SheetDescription>Detalle de compras</SheetDescription>
        </SheetHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Card>
            <CardContent className="pt-3 pb-2 text-center">
              <p className="text-xs text-muted-foreground">Compras</p>
              <p className="text-lg font-bold">{customer.sale_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{fmt(customer.total_spent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 text-center">
              <p className="text-xs text-muted-foreground">Prom.</p>
              <p className="text-lg font-bold">{fmt(customer.avg_ticket)}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground mt-4">Cargando…</p>
        ) : (
          <>
            {/* Top products */}
            {data && data.topProducts.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-2">Productos más comprados</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">
                            {p.name}
                            {p.variant && (
                              <span className="text-muted-foreground ml-1 text-xs">{p.variant}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">x{p.qty}</TableCell>
                          <TableCell className="text-right">{fmt(p.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Monthly chart */}
            {chartData.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-2">Gasto por mes (últimos 6 meses)</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 10 }}>
                      <XAxis type="number" tickFormatter={(v) => fmt(v)} className="text-xs" />
                      <YAxis type="category" dataKey="name" width={40} className="text-xs" />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} className="fill-primary" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
