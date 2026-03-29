import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import {
  fetchPromotionsAdmin,
  createPromotion,
  updatePromotion,
  togglePromotion,
  type Promotion,
  type PromotionType,
} from "@/lib/promotions-store";
import { supabase } from "@/integrations/supabase/client";

const TYPE_LABELS: Record<PromotionType, string> = {
  BUY_X_GET_Y: "Comprá X, llevá Y",
  PERCENT_OFF: "% Descuento",
  FIXED_PRICE: "Precio fijo",
};

interface FormState {
  name: string;
  type: PromotionType;
  buy_qty: string;
  get_qty: string;
  percent_off: string;
  fixed_price: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  sort_order: string;
  product_ids: string[];
}

const emptyForm: FormState = {
  name: "",
  type: "PERCENT_OFF",
  buy_qty: "1",
  get_qty: "1",
  percent_off: "10",
  fixed_price: "",
  start_date: "",
  end_date: "",
  is_active: true,
  sort_order: "0",
  product_ids: [],
};

export default function OfertasTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["promos-admin"],
    queryFn: fetchPromotionsAdmin,
  });

  const { data: activeProducts = [] } = useQuery({
    queryKey: ["products-for-promos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, variant_label")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      buy_qty: String(p.buy_qty ?? 1),
      get_qty: String(p.get_qty ?? 1),
      percent_off: String(p.percent_off ?? ""),
      fixed_price: String(p.fixed_price ?? ""),
      start_date: p.start_date ?? "",
      end_date: p.end_date ?? "",
      is_active: p.is_active,
      sort_order: String(p.sort_order),
      product_ids: p.product_ids ?? [],
    });
    setDialogOpen(true);
  };

  const handleToggle = async (p: Promotion) => {
    try {
      await togglePromotion(p.id, !p.is_active);
      qc.invalidateQueries({ queryKey: ["promos-admin"] });
      toast.success(p.is_active ? "Oferta desactivada" : "Oferta activada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const validate = (): boolean => {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return false; }
    if (form.type === "BUY_X_GET_Y") {
      if ((parseInt(form.buy_qty) || 0) < 1) { toast.error("buy_qty >= 1"); return false; }
      if ((parseInt(form.get_qty) || 0) < 1) { toast.error("get_qty >= 1"); return false; }
    }
    if (form.type === "PERCENT_OFF") {
      const pct = parseFloat(form.percent_off);
      if (!pct || pct < 1 || pct > 100) { toast.error("% entre 1 y 100"); return false; }
    }
    if (form.type === "FIXED_PRICE") {
      if ((parseInt(form.fixed_price) || 0) <= 0) { toast.error("Precio fijo > 0"); return false; }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        buy_qty: form.type === "BUY_X_GET_Y" ? parseInt(form.buy_qty) || 1 : null,
        get_qty: form.type === "BUY_X_GET_Y" ? parseInt(form.get_qty) || 1 : null,
        percent_off: form.type === "PERCENT_OFF" ? parseFloat(form.percent_off) || 0 : null,
        fixed_price: form.type === "FIXED_PRICE" ? parseInt(form.fixed_price) || 0 : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order) || 0,
        product_ids: form.product_ids,
      };

      if (editing) {
        await updatePromotion(editing.id, payload);
        toast.success("Oferta actualizada");
      } else {
        await createPromotion(payload);
        toast.success("Oferta creada");
      }
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["promos-admin"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setForm((prev) => ({
      ...prev,
      product_ids: prev.product_ids.includes(productId)
        ? prev.product_ids.filter((id) => id !== productId)
        : [...prev.product_ids, productId],
    }));
  };

  const promoDescription = (p: Promotion) => {
    switch (p.type) {
      case "BUY_X_GET_Y":
        return `Comprá ${p.buy_qty}, llevá ${(p.buy_qty ?? 0) + (p.get_qty ?? 0)}`;
      case "PERCENT_OFF":
        return `${p.percent_off}% off`;
      case "FIXED_PRICE":
        return `$${(p.fixed_price ?? 0).toLocaleString("es-AR")} c/u`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gestionar ofertas y promociones aplicables en caja.</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nueva oferta</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : promos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay ofertas creadas.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="secondary">{TYPE_LABELS[p.type]}</Badge></TableCell>
                  <TableCell className="text-sm">{promoDescription(p)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(p.product_ids ?? []).length} prod.</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.start_date || p.end_date
                      ? `${p.start_date ?? "∞"} → ${p.end_date ?? "∞"}`
                      : "Sin límite"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "outline"}>
                      {p.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleToggle(p)}>
                      <Power className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar oferta" : "Nueva oferta"}</DialogTitle>
            <DialogDescription>Configurá los detalles de la promoción.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: 2x1 en remeras" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as PromotionType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as PromotionType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.type === "BUY_X_GET_Y" && (
              <div className="space-y-3 bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium">Configuración del combo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pagás</Label>
                    <Input type="number" min={1} value={form.buy_qty} onChange={(e) => setForm((f) => ({ ...f, buy_qty: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Gratis</Label>
                    <Input type="number" min={1} value={form.get_qty} onChange={(e) => setForm((f) => ({ ...f, get_qty: e.target.value }))} />
                  </div>
                </div>
                {(() => {
                  const pay = parseInt(form.buy_qty) || 1;
                  const free = parseInt(form.get_qty) || 1;
                  const comboSize = pay + free;
                  return (
                    <div className="bg-background rounded-md p-2 border text-sm space-y-1">
                      <p className="font-medium">
                        Combo {comboSize}×{pay} → Llevás {comboSize}, pagás {pay}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        El cliente lleva {comboSize} producto{comboSize > 1 ? "s" : ""} y paga solo {pay}.
                        {comboSize <= 2
                          ? " Elegí hasta 2 productos abajo — pueden ser iguales o distintos."
                          : ` Elegí hasta ${comboSize} productos abajo.`}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {form.type === "PERCENT_OFF" && (
              <div>
                <Label>Porcentaje de descuento</Label>
                <Input type="number" min={1} max={100} value={form.percent_off} onChange={(e) => setForm((f) => ({ ...f, percent_off: e.target.value }))} />
              </div>
            )}

            {form.type === "FIXED_PRICE" && (
              <div>
                <Label>Precio fijo por unidad ($)</Label>
                <Input type="number" min={1} value={form.fixed_price} onChange={(e) => setForm((f) => ({ ...f, fixed_price: e.target.value }))} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div><Label>Desde (opcional)</Label><Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>Hasta (opcional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} /></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Orden</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                <Label>Activa</Label>
              </div>
            </div>

            <div>
              {(() => {
                const isBxy = form.type === "BUY_X_GET_Y";
                const comboSize = isBxy ? (parseInt(form.buy_qty) || 1) + (parseInt(form.get_qty) || 1) : 0;
                const maxProducts = isBxy ? comboSize : undefined;
                const atLimit = maxProducts !== undefined && form.product_ids.length >= maxProducts;

                return (
                  <>
                    <Label className="mb-1 block">
                      {isBxy
                        ? `Productos del combo (${form.product_ids.length}/${comboSize})`
                        : `Productos aplicables (${form.product_ids.length})`}
                    </Label>
                    {isBxy && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {form.product_ids.length === 1
                          ? "✓ Con 1 producto seleccionado, el combo aplica a unidades del mismo producto."
                          : form.product_ids.length >= comboSize
                            ? `✓ ${comboSize} productos seleccionados. El combo aplica cuando están en el carrito.`
                            : `Seleccioná hasta ${comboSize} productos. Si elegís 1 solo, el combo aplica a varias unidades del mismo.`}
                      </p>
                    )}
                    <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                      {activeProducts.map((p) => {
                        const isSelected = form.product_ids.includes(p.id);
                        const disabled = !isSelected && atLimit;
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2 text-sm rounded px-1 py-0.5 ${
                              disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"
                            } ${isSelected ? "bg-primary/10" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => !disabled && toggleProduct(p.id)}
                              disabled={disabled}
                              className="rounded"
                            />
                            <span>{p.name}{p.variant_label ? ` ${p.variant_label}` : ""}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear oferta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
