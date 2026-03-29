import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllProducts, addProduct, updateProduct, toggleProduct, duplicateProduct, deleteProduct } from "@/lib/supabase-store";
import { fetchPriceCompleteness } from "@/lib/price-store";
import { fetchTypes, fetchCategories as fetchCfgCategories, fetchVariantSets, fetchVariantValues, createType, createCategory, createVariantSet, createVariantValue, type ProductType as CfgType, type ProductCategory as CfgCat, type VariantSet, type VariantValue } from "@/lib/config-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Copy, Pencil, DollarSign, Trash2, Settings, Truck } from "lucide-react";
import { StarRating, StarRatingDisplay } from "@/components/ui/star-rating";
import { toast } from "@/hooks/use-toast";
import PriceDrawer from "@/components/product/PriceDrawer";
import CreditSettings from "@/components/product/CreditSettings";
import SuppliersDrawer from "@/components/product/SuppliersDrawer";

const defaultForm = {
  name: '',
  type: '',
  category: '',
  variant_label: '',
  sku: '',
  min_stock: 3,
  track_stock: true,
  is_active: true,
  cost_price: 0,
  quality_rating: null as number | null,
  type_id: null as string | null,
  category_id: null as string | null,
  variant_set_id: null as string | null,
  variant_value_id: null as string | null,
};

function generateSku(typeName: string, name: string, variant: string) {
  const prefix = typeName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const namePart = name.trim().substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const variantPart = variant.trim().replace(/\s+/g, '').substring(0, 4).toUpperCase() || '0';
  return `${prefix}-${namePart}-${variantPart}`;
}

export default function Products() {
  const queryClient = useQueryClient();
  const { data: allProducts = [], isLoading } = useQuery({ queryKey: ["all-products"], queryFn: fetchAllProducts });
  const { data: priceCompleteness = {} } = useQuery({ queryKey: ["price-completeness"], queryFn: fetchPriceCompleteness });

  // Config data
  const { data: cfgTypes = [] } = useQuery({ queryKey: ["cfg-types"], queryFn: fetchTypes });
  const { data: cfgCategories = [] } = useQuery({ queryKey: ["cfg-categories"], queryFn: fetchCfgCategories });
  const { data: cfgVariantSets = [] } = useQuery({ queryKey: ["cfg-variant-sets"], queryFn: fetchVariantSets });

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [priceProductId, setPriceProductId] = useState<string | null>(null);
  const [priceProductName, setPriceProductName] = useState("");
  const [showCreditSettings, setShowCreditSettings] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);

  // Variant values for selected set
  const { data: cfgVariantValues = [] } = useQuery({
    queryKey: ["cfg-variant-values", form.variant_set_id],
    queryFn: () => fetchVariantValues(form.variant_set_id!),
    enabled: !!form.variant_set_id,
  });

  // Inline create modals
  const [inlineTypeModal, setInlineTypeModal] = useState(false);
  const [inlineTypeName, setInlineTypeName] = useState("");
  const [inlineCatModal, setInlineCatModal] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");
  const [inlineVsModal, setInlineVsModal] = useState(false);
  const [inlineVsName, setInlineVsName] = useState("");
  const [inlineVvModal, setInlineVvModal] = useState(false);
  const [inlineVvValue, setInlineVvValue] = useState("");

  const activeTypes = cfgTypes.filter((t) => t.is_active);
  const filteredCategories = cfgCategories.filter((c) => c.is_active && (!form.type_id || c.type_id === form.type_id || !c.type_id));
  const activeVariantSets = cfgVariantSets.filter((v) => v.is_active);
  const activeVariantValues = cfgVariantValues.filter((v) => v.is_active);

  const filtered = useMemo(() => {
    if (!search) return allProducts;
    const term = search.toLowerCase();
    return allProducts.filter((p: any) =>
      p.name.toLowerCase().includes(term) ||
      p.variant_label.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term)
    );
  }, [allProducts, search]);

  const openCreate = () => { setEditingId(null); setForm(defaultForm); setFormOpen(true); };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name, type: p.type, category: p.category, variant_label: p.variant_label,
      sku: p.sku, min_stock: p.min_stock, track_stock: p.track_stock, is_active: p.is_active,
      cost_price: p.cost_price ?? 0,
      quality_rating: p.quality_rating ?? null,
      type_id: p.type_id ?? null, category_id: p.category_id ?? null,
      variant_set_id: p.variant_set_id ?? null, variant_value_id: p.variant_value_id ?? null,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const typeName = activeTypes.find((t) => t.id === form.type_id)?.name ?? form.type;
    const catName = filteredCategories.find((c) => c.id === form.category_id)?.name ?? form.category;
    const variantLabel = activeVariantValues.find((v) => v.id === form.variant_value_id)?.value ?? form.variant_label;
    const autoSku = generateSku(typeName, form.name, variantLabel);
    const payload = {
      name: form.name,
      type: typeName, category: catName, variant_label: variantLabel,
      sku: autoSku, min_stock: form.min_stock, track_stock: form.track_stock,
      is_active: form.is_active, cost_price: form.cost_price,
      quality_rating: form.quality_rating,
      type_id: form.type_id, category_id: form.category_id,
      variant_set_id: form.variant_set_id, variant_value_id: form.variant_value_id,
    };
    try {
      if (editingId) {
        await updateProduct(editingId, payload);
        toast({ title: "Producto actualizado" });
      } else {
        await addProduct(payload);
        toast({ title: "Producto creado" });
      }
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      setFormOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDuplicate = async (p: any) => {
    try {
      await duplicateProduct(p.id);
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      toast({ title: "Producto duplicado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (p: any) => {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteProduct(p.id);
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      toast({ title: "Producto eliminado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = async (p: any) => {
    try {
      await toggleProduct(p.id, p.is_active);
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'type_id') {
        next.category_id = null;
        next.category = '';
      }
      if (key === 'variant_set_id') {
        next.variant_value_id = null;
        next.variant_label = '';
      }
      return next;
    });
  };

  // Inline creates
  const handleInlineCreateType = async () => {
    if (!inlineTypeName.trim()) return;
    try {
      await createType(inlineTypeName);
      const updated = await queryClient.fetchQuery({ queryKey: ["cfg-types"], queryFn: fetchTypes });
      const newType = updated.find((t: CfgType) => t.name === inlineTypeName);
      if (newType) updateField('type_id', newType.id);
      setInlineTypeModal(false);
      toast({ title: "Tipo creado" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleInlineCreateCat = async () => {
    if (!inlineCatName.trim()) return;
    try {
      await createCategory(inlineCatName, form.type_id);
      const updated = await queryClient.fetchQuery({ queryKey: ["cfg-categories"], queryFn: fetchCfgCategories });
      const newCat = updated.find((c: CfgCat) => c.name === inlineCatName);
      if (newCat) updateField('category_id', newCat.id);
      setInlineCatModal(false);
      toast({ title: "Categoría creada" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleInlineCreateVs = async () => {
    if (!inlineVsName.trim()) return;
    try {
      const newId = await createVariantSet(inlineVsName);
      queryClient.invalidateQueries({ queryKey: ["cfg-variant-sets"] });
      updateField('variant_set_id', newId);
      setInlineVsModal(false);
      toast({ title: "Set creado" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleInlineCreateVv = async () => {
    if (!inlineVvValue.trim() || !form.variant_set_id) return;
    try {
      await createVariantValue(form.variant_set_id, inlineVvValue);
      queryClient.invalidateQueries({ queryKey: ["cfg-variant-values", form.variant_set_id] });
      setInlineVvModal(false);
      toast({ title: "Valor creado" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Cargando productos...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Productos</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSuppliers(true)}><Truck className="mr-2 h-4 w-4" /> Proveedores</Button>
          <Button size="icon" variant="outline" onClick={() => setShowCreditSettings(true)}><Settings className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo Producto</Button>
        </div>
      </div>

      <Input placeholder="Buscar producto, variante o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Variante</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-center">Precios</TableHead>
            <TableHead className="text-center">Calidad</TableHead>
            <TableHead className="text-right">Costo</TableHead>
            <TableHead className="text-center">Mín.</TableHead>
            <TableHead className="text-center">Activo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No se encontraron productos</TableCell></TableRow>
          )}
          {filtered.map((p: any) => (
            <TableRow key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
              <TableCell className="text-sm">{p.variant_label}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{p.sku}</TableCell>
              <TableCell className="text-center">
                <Badge variant={priceCompleteness[p.id] >= 2 ? "default" : "outline"} className="text-xs">
                  {priceCompleteness[p.id] ?? 0}/6
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <StarRatingDisplay value={p.quality_rating} />
              </TableCell>
              <TableCell className="text-right text-sm">{p.cost_price > 0 ? `$${p.cost_price.toLocaleString("es-AR")}` : '-'}</TableCell>
              <TableCell className="text-center">{p.min_stock}</TableCell>
              <TableCell className="text-center"><Switch checked={p.is_active} onCheckedChange={() => handleToggle(p)} /></TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setPriceProductId(p.id); setPriceProductName(p.name); }}><DollarSign className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                  
                  <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(p)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Product Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nombre</Label><Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Nombre del producto" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex gap-1">
                  <Select value={form.type_id ?? "none"} onValueChange={(v) => updateField('type_id', v === "none" ? null : v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin tipo</SelectItem>
                      {activeTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => { setInlineTypeName(""); setInlineTypeModal(true); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <div className="flex gap-1">
                  <Select value={form.category_id ?? "none"} onValueChange={(v) => updateField('category_id', v === "none" ? null : v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin categoría</SelectItem>
                      {filteredCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => { setInlineCatName(""); setInlineCatModal(true); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Set de variante</Label>
                <div className="flex gap-1">
                  <Select value={form.variant_set_id ?? "none"} onValueChange={(v) => updateField('variant_set_id', v === "none" ? null : v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin set</SelectItem>
                      {activeVariantSets.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => { setInlineVsName(""); setInlineVsModal(true); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor variante</Label>
                {form.variant_set_id ? (
                  <div className="flex gap-1">
                    <Select value={form.variant_value_id ?? "none"} onValueChange={(v) => {
                      const valId = v === "none" ? null : v;
                      updateField('variant_value_id', valId);
                      const val = activeVariantValues.find((vv) => vv.id === valId);
                      if (val) setForm((p) => ({ ...p, variant_label: val.value }));
                    }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {activeVariantValues.map((v) => <SelectItem key={v.id} value={v.id}>{v.value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => { setInlineVvValue(""); setInlineVvModal(true); }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Input value={form.variant_label} onChange={(e) => updateField('variant_label', e.target.value)} placeholder="Variante libre" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Stock Mínimo</Label><Input type="number" min="0" value={form.min_stock} onChange={(e) => updateField('min_stock', parseInt(e.target.value) || 0)} /></div>
              <div className="space-y-2"><Label>Precio de Costo</Label><Input type="number" min="0" placeholder="0" value={form.cost_price || ''} onChange={(e) => updateField('cost_price', parseInt(e.target.value) || 0)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Calidad del producto</Label>
              <StarRating value={form.quality_rating} onChange={(v) => updateField('quality_rating', v === 0 ? null : v)} />
            </div>
            <div className="space-y-2">
              <Label>SKU (auto)</Label>
              <Input value={generateSku((activeTypes.find((t) => t.id === form.type_id)?.name ?? form.type) || 'XXX', form.name, form.variant_label)} readOnly className="bg-muted text-muted-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline create modals */}
      <Dialog open={inlineTypeModal} onOpenChange={setInlineTypeModal}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Nuevo tipo</DialogTitle></DialogHeader>
          <Input value={inlineTypeName} onChange={(e) => setInlineTypeName(e.target.value)} placeholder="Ej: Remeras" />
          <DialogFooter><Button onClick={handleInlineCreateType}>Crear</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={inlineCatModal} onOpenChange={setInlineCatModal}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
          <Input value={inlineCatName} onChange={(e) => setInlineCatName(e.target.value)} placeholder="Ej: Nike" />
          <DialogFooter><Button onClick={handleInlineCreateCat}>Crear</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={inlineVsModal} onOpenChange={setInlineVsModal}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Nuevo set de variantes</DialogTitle></DialogHeader>
          <Input value={inlineVsName} onChange={(e) => setInlineVsName(e.target.value)} placeholder="Ej: Talles" />
          <DialogFooter><Button onClick={handleInlineCreateVs}>Crear</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={inlineVvModal} onOpenChange={setInlineVvModal}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Nuevo valor</DialogTitle></DialogHeader>
          <Input value={inlineVvValue} onChange={(e) => setInlineVvValue(e.target.value)} placeholder="Ej: XL" />
          <DialogFooter><Button onClick={handleInlineCreateVv}>Crear</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <PriceDrawer
        open={!!priceProductId}
        onOpenChange={(open) => { if (!open) setPriceProductId(null); }}
        productId={priceProductId}
        productName={priceProductName}
      />

      <CreditSettings open={showCreditSettings} onOpenChange={setShowCreditSettings} />
      <SuppliersDrawer open={showSuppliers} onOpenChange={setShowSuppliers} />
    </div>
  );
}
