import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPriceTerms, createPriceTerm, updatePriceTerm,
  type PriceTerm,
} from "@/lib/config-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";

export default function PreciosTab() {
  const qc = useQueryClient();

  const { data: terms = [] } = useQuery({ queryKey: ["cfg-price-terms"], queryFn: fetchPriceTerms });
  const termsPag = usePagination(terms, 10);
  const [modal, setModal] = useState(false);
  const [editTerm, setEditTerm] = useState<PriceTerm | null>(null);
  const [form, setForm] = useState({
    code: "", label: "", surcharge_pct: 0, default_installments: "" as string,
    fund: "EFECTIVO", sort_order: 0,
  });

  const saveTerm = async () => {
    if (!form.code.trim() || !form.label.trim()) return;
    const code = form.code.toUpperCase().replace(/\s+/g, "_");
    const pct = Math.max(-50, Math.min(200, form.surcharge_pct));
    const inst = form.default_installments ? parseInt(form.default_installments) || null : null;
    try {
      if (editTerm) {
        await updatePriceTerm(editTerm.id, { code, label: form.label, surcharge_pct: pct, default_installments: inst, fund: form.fund, sort_order: form.sort_order });
      } else {
        await createPriceTerm({ code, label: form.label, surcharge_pct: pct, default_installments: inst, fund: form.fund, sort_order: form.sort_order });
      }
      qc.invalidateQueries({ queryKey: ["cfg-price-terms"] });
      setModal(false);
      toast.success(editTerm ? "Opción actualizada" : "Opción creada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleTerm = async (t: PriceTerm) => {
    await updatePriceTerm(t.id, { is_active: !t.is_active });
    qc.invalidateQueries({ queryKey: ["cfg-price-terms"] });
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Opciones de cobro</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Cada opción define el recargo al cliente (= comisión del procesador) y el fondo de destino.
            </p>
          </div>
          <Button size="sm" onClick={() => {
            setEditTerm(null);
            setForm({ code: "", label: "", surcharge_pct: 0, default_installments: "", fund: "EFECTIVO", sort_order: terms.length });
            setModal(true);
          }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead className="text-right">Recargo %</TableHead>
                <TableHead className="text-center">Cuotas</TableHead>
                <TableHead>Fondo</TableHead>
                <TableHead className="text-center">Orden</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {termsPag.paged.map((t) => (
                <TableRow key={t.id} className={!t.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell className="text-right">{t.surcharge_pct}%</TableCell>
                  <TableCell className="text-center">{t.default_installments ?? "—"}</TableCell>
                  <TableCell className="text-sm">{t.fund}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{t.sort_order}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleTerm(t)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditTerm(t);
                      setForm({
                        code: t.code, label: t.label, surcharge_pct: t.surcharge_pct,
                        default_installments: t.default_installments?.toString() ?? "",
                        fund: t.fund, sort_order: t.sort_order,
                      });
                      setModal(true);
                    }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination page={termsPag.page} totalPages={termsPag.totalPages} total={termsPag.total} onPageChange={termsPag.setPage} />
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editTerm ? "Editar opción" : "Nueva opción"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="CREDITO_3" /></div>
            <div><Label>Etiqueta</Label><Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Crédito 3 cuotas" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Recargo %</Label><Input type="number" value={form.surcharge_pct} onChange={(e) => setForm((p) => ({ ...p, surcharge_pct: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Cuotas (opc.)</Label><Input type="number" value={form.default_installments} onChange={(e) => setForm((p) => ({ ...p, default_installments: e.target.value }))} placeholder="—" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fondo destino</Label>
                <Select value={form.fund} onValueChange={(v) => setForm((p) => ({ ...p, fund: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">EFECTIVO</SelectItem>
                    <SelectItem value="MERCADOPAGO">MERCADOPAGO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={saveTerm}>{editTerm ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
