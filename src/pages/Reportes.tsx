import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  fetchTopProducts,
  fetchSalesByDay,
  fetchSalesByMethod,
  fetchMarginByCategory,
} from "@/lib/reportes-store";

const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;

const COLORS = [
  "hsl(222, 47%, 30%)",
  "hsl(210, 60%, 45%)",
  "hsl(180, 40%, 50%)",
  "hsl(150, 45%, 45%)",
  "hsl(40, 80%, 55%)",
  "hsl(0, 60%, 55%)",
  "hsl(270, 50%, 55%)",
  "hsl(320, 50%, 50%)",
];

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  QR: "QR",
  MERCADOPAGO: "MercadoPago",
};

type Preset = "7days" | "month" | "custom";

export default function Reportes() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  const { from, to } = useMemo(() => {
    switch (preset) {
      case "7days":
        return { from: format(subDays(new Date(), 6), "yyyy-MM-dd"), to: today };
      case "month":
        return { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: today };
      case "custom":
        return { from: customFrom, to: customTo };
    }
  }, [preset, customFrom, customTo, today]);

  const topQ = useQuery({ queryKey: ["rep-top", from, to], queryFn: () => fetchTopProducts(from, to) });
  const dailyQ = useQuery({ queryKey: ["rep-daily", from, to], queryFn: () => fetchSalesByDay(from, to) });
  const methodQ = useQuery({ queryKey: ["rep-method", from, to], queryFn: () => fetchSalesByMethod(from, to) });
  const marginQ = useQuery({ queryKey: ["rep-margin", from, to], queryFn: () => fetchMarginByCategory(from, to) });

  const dailyData = (dailyQ.data ?? []).map((d) => ({
    ...d,
    label: format(new Date(d.date + "T12:00:00"), "dd/MM", { locale: es }),
  }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Reportes</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["7days", "month", "custom"] as Preset[]).map((p) => (
            <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => setPreset(p)}>
              {p === "7days" ? "7 días" : p === "month" ? "Mes" : "Custom"}
            </Button>
          ))}
        </div>
      </div>

      {preset === "custom" && (
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
          </div>
        </div>
      )}

      {/* Ventas por día */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventas por día</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyQ.isLoading ? (
            <p className="text-muted-foreground text-sm">Cargando…</p>
          ) : dailyData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Día ${l}`} />
                <Bar dataKey="total" fill="hsl(222, 47%, 30%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Ventas por método de pago */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por medio de pago</CardTitle>
          </CardHeader>
          <CardContent>
            {methodQ.isLoading ? (
              <p className="text-muted-foreground text-sm">Cargando…</p>
            ) : (methodQ.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={(methodQ.data ?? []).map((m) => ({ ...m, name: METHOD_LABELS[m.method] || m.method }))}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(methodQ.data ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Margen por categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Margen por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {marginQ.isLoading ? (
              <p className="text-muted-foreground text-sm">Cargando…</p>
            ) : (marginQ.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin datos (cargá precio de costo en productos).</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={marginQ.data} layout="vertical">
                  <XAxis type="number" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="category" fontSize={12} width={80} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="revenue" fill="hsl(210, 60%, 45%)" name="Ingreso" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="margin" fill="hsl(150, 45%, 45%)" name="Margen" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top productos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top productos</CardTitle>
        </CardHeader>
        <CardContent>
          {topQ.isLoading ? (
            <p className="text-muted-foreground text-sm">Cargando…</p>
          ) : (topQ.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin ventas en el período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Unid.</TableHead>
                  <TableHead className="text-right">Facturado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(topQ.data ?? []).map((p, i) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{p.qty}</TableCell>
                    <TableCell className="text-right">{fmt(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
