import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ShoppingBag, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { fetchPurchases, createPurchase, type StockPurchase, type PurchaseItemInput } from "@/lib/purchase-store";
import { fetchSuppliers, type Supplier } from "@/lib/supplier-store";
import { fetchProductsWithStock } from "@/lib/supabase-store";

const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;

export default function Compras() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["stock-purchases"],
    queryFn: () => fetchPurchases(),
  });

  const totalCompras = purchases.reduce((s, p) => s + p.total_amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Compras de Mercadería</h1>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva compra
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total compras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(totalCompras)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compras registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{purchases.length}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : purchases.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">No hay compras registradas.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fondo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                  <TableCell>{format(new Date(p.purchase_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{p.supplier_name_snapshot || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{p.payment_fund}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(p.total_amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{p.notes || "—"}</TableCell>
                  <TableCell>
                    {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PurchaseFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["stock-purchases"] });
          qc.invalidateQueries({ queryKey: ["products-with-stock"] });
          qc.invalidateQueries({ queryKey: ["finanzas-capital"] });
          setShowForm(false);
        }}
      />
    </div>
  );
}

// ─── Purchase Form Dialog ───────────────────────────────────────────

function PurchaseFormDialog({
  open, onClose, onSaved,
}: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplierId, setSupplierId] = useState("");
  const [fund, setFund] = useState("EFECTIVO");
  const [notes, setNotes] = useState("");
  const [updateCosts, setUpdateCosts] = useState(false);
  const [items, setItems] = useState<(PurchaseItemInput & { name?: string })[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: products = [] } = useQuery({ queryKey: ["products-with-stock"], queryFn: fetchProductsWithStock });

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const addItem = () => {
    setItems((prev) => [...prev, { product_id: "", qty: 1, unit_cost: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "product_id") {
        const prod = products.find((p: any) => p.id === value);
        if (prod) {
          updated.name = `${(prod as any).name} ${(prod as any).variant_label || ""}`.trim();
          updated.unit_cost = (prod as any).cost_price || 0;
        }
      }
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((s, i) => s + i.qty * i.unit_cost, 0);

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("Agregá al menos un producto");
      return;
    }
    const validItems = items.filter((i) => i.product_id && i.qty > 0);
    if (validItems.length === 0) {
      toast.error("Completá los datos de al menos un producto");
      return;
    }

    setSaving(true);
    try {
      await createPurchase({
        purchase_date: date,
        supplier_id: supplierId || null,
        supplier_name_snapshot: selectedSupplier?.name || "",
        payment_fund: fund,
        payment_method: fund,
        notes,
        items: validItems,
        updateCostPrices: updateCosts,
      });
      toast.success("Compra registrada");
      setItems([]);
      setNotes("");
      setSupplierId("");
      onSaved();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Compra de Mercadería</DialogTitle>
          <DialogDescription>
            Registrá una compra. Suma stock y reduce capital del fondo elegido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Fondo de pago</Label>
              <Select value={fund} onValueChange={setFund}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="MERCADOPAGO">MercadoPago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Proveedor</Label>
            <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin proveedor</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opcional..." />
          </div>

          {/* Items table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Productos</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Agregar producto
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Agregá productos a la compra
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
                    <div className="col-span-5">
                      <Label className="text-xs">Producto</Label>
                      <Select value={item.product_id || "none"} onValueChange={(v) => updateItem(idx, "product_id", v === "none" ? "" : v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Seleccionar...</SelectItem>
                          {products.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.variant_label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        className="h-9"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, "qty", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Costo unit.</Label>
                      <Input
                        type="number"
                        min="0"
                        className="h-9"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(idx, "unit_cost", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <Label className="text-xs">Subtotal</Label>
                      <p className="font-semibold text-sm h-9 flex items-center justify-end">
                        {fmt(item.qty * item.unit_cost)}
                      </p>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="update-costs"
              checked={updateCosts}
              onCheckedChange={(v) => setUpdateCosts(v === true)}
            />
            <Label htmlFor="update-costs" className="text-sm cursor-pointer">
              Actualizar costo de los productos con los valores de esta compra
            </Label>
          </div>

          <div className="bg-muted rounded-md p-4 flex justify-between items-center">
            <span className="font-semibold text-lg">Total compra</span>
            <span className="font-bold text-xl">{fmt(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || items.length === 0}>
            {saving ? "Registrando…" : "Confirmar compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
