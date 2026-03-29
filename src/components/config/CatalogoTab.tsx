import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTypes, createType, updateType,
  fetchCategories, createCategory, updateCategory,
  fetchVariantSets, createVariantSet, updateVariantSet,
  fetchVariantValues, createVariantValue, updateVariantValue,
  type ProductType, type ProductCategory, type VariantSet, type VariantValue,
} from "@/lib/config-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";

export default function CatalogoTab() {
  const qc = useQueryClient();

  // ─── Types ──────────────────────────────────────────
  const { data: types = [] } = useQuery({ queryKey: ["cfg-types"], queryFn: fetchTypes });
  const typesPag = usePagination(types, 5);
  const [typeModal, setTypeModal] = useState(false);
  const [editType, setEditType] = useState<ProductType | null>(null);
  const [typeName, setTypeName] = useState("");

  const saveType = async () => {
    if (!typeName.trim()) return;
    try {
      if (editType) {
        await updateType(editType.id, { name: typeName });
      } else {
        await createType(typeName);
      }
      qc.invalidateQueries({ queryKey: ["cfg-types"] });
      setTypeModal(false);
      toast.success(editType ? "Tipo actualizado" : "Tipo creado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleType = async (t: ProductType) => {
    await updateType(t.id, { is_active: !t.is_active });
    qc.invalidateQueries({ queryKey: ["cfg-types"] });
  };

  // ─── Categories ─────────────────────────────────────
  const { data: categories = [] } = useQuery({ queryKey: ["cfg-categories"], queryFn: fetchCategories });
  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat] = useState<ProductCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catTypeId, setCatTypeId] = useState<string>("none");
  const [catTypeFilter, setCatTypeFilter] = useState("ALL");

  const filteredCats = catTypeFilter === "ALL" ? categories : categories.filter((c) => c.type_id === catTypeFilter);
  const catsPag = usePagination(filteredCats, 5);

  const saveCat = async () => {
    if (!catName.trim()) return;
    try {
      const tid = catTypeId === "none" ? null : catTypeId;
      if (editCat) {
        await updateCategory(editCat.id, { name: catName, type_id: tid });
      } else {
        await createCategory(catName, tid);
      }
      qc.invalidateQueries({ queryKey: ["cfg-categories"] });
      setCatModal(false);
      toast.success(editCat ? "Categoría actualizada" : "Categoría creada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleCat = async (c: ProductCategory) => {
    await updateCategory(c.id, { is_active: !c.is_active });
    qc.invalidateQueries({ queryKey: ["cfg-categories"] });
  };

  // ─── Variant Sets ──────────────────────────────────
  const { data: variantSets = [] } = useQuery({ queryKey: ["cfg-variant-sets"], queryFn: fetchVariantSets });
  const [vsModal, setVsModal] = useState(false);
  const [editVs, setEditVs] = useState<VariantSet | null>(null);
  const [vsName, setVsName] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const { data: variantValues = [] } = useQuery({
    queryKey: ["cfg-variant-values", selectedSetId],
    queryFn: () => fetchVariantValues(selectedSetId!),
    enabled: !!selectedSetId,
  });
  const vvPag = usePagination(variantValues, 5);

  const saveVs = async () => {
    if (!vsName.trim()) return;
    try {
      if (editVs) {
        await updateVariantSet(editVs.id, { name: vsName });
      } else {
        const newId = await createVariantSet(vsName);
        setSelectedSetId(newId);
      }
      qc.invalidateQueries({ queryKey: ["cfg-variant-sets"] });
      setVsModal(false);
      toast.success(editVs ? "Set actualizado" : "Set creado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const [vvModal, setVvModal] = useState(false);
  const [editVv, setEditVv] = useState<VariantValue | null>(null);
  const [vvValue, setVvValue] = useState("");

  const saveVv = async () => {
    if (!vvValue.trim() || !selectedSetId) return;
    try {
      if (editVv) {
        await updateVariantValue(editVv.id, { value: vvValue });
      } else {
        await createVariantValue(selectedSetId, vvValue);
      }
      qc.invalidateQueries({ queryKey: ["cfg-variant-values", selectedSetId] });
      setVvModal(false);
      toast.success(editVv ? "Valor actualizado" : "Valor creado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleVv = async (v: VariantValue) => {
    await updateVariantValue(v.id, { is_active: !v.is_active });
    qc.invalidateQueries({ queryKey: ["cfg-variant-values", selectedSetId] });
  };

  return (
    <div className="space-y-6 mt-4">
      {/* ─── TIPOS ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Tipos de producto</CardTitle>
          <Button size="sm" onClick={() => { setEditType(null); setTypeName(""); setTypeModal(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typesPag.paged.map((t) => (
                <TableRow key={t.id} className={!t.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleType(t)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditType(t); setTypeName(t.name); setTypeModal(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sin tipos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination page={typesPag.page} totalPages={typesPag.totalPages} total={typesPag.total} onPageChange={typesPag.setPage} />
        </CardContent>
      </Card>

      {/* ─── CATEGORÍAS ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Categorías</CardTitle>
          <div className="flex gap-2">
            <Select value={catTypeFilter} onValueChange={(v) => { setCatTypeFilter(v); catsPag.setPage(1); }}>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="Filtrar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {types.filter((t) => t.is_active).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => { setEditCat(null); setCatName(""); setCatTypeId("none"); setCatModal(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catsPag.paged.map((c) => (
                <TableRow key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {types.find((t) => t.id === c.type_id)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={c.is_active} onCheckedChange={() => toggleCat(c)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditCat(c); setCatName(c.name); setCatTypeId(c.type_id ?? "none"); setCatModal(true);
                    }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCats.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sin categorías</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination page={catsPag.page} totalPages={catsPag.totalPages} total={catsPag.total} onPageChange={catsPag.setPage} />
        </CardContent>
      </Card>

      {/* ─── VARIANTES ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Sets de variantes</CardTitle>
          <Button size="sm" onClick={() => { setEditVs(null); setVsName(""); setVsModal(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo set
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {variantSets.map((vs) => (
              <Badge
                key={vs.id}
                variant={selectedSetId === vs.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => { setSelectedSetId(vs.id); vvPag.setPage(1); }}
              >
                {vs.name}
              </Badge>
            ))}
          </div>

          {selectedSetId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Valores de "{variantSets.find((v) => v.id === selectedSetId)?.name}"
                </h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const vs = variantSets.find((v) => v.id === selectedSetId);
                    if (vs) { setEditVs(vs); setVsName(vs.name); setVsModal(true); }
                  }}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar set
                  </Button>
                  <Button size="sm" onClick={() => { setEditVv(null); setVvValue(""); setVvModal(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Agregar valor
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-center">Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vvPag.paged.map((v) => (
                    <TableRow key={v.id} className={!v.is_active ? "opacity-50" : ""}>
                      <TableCell>{v.value}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={v.is_active} onCheckedChange={() => toggleVv(v)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setEditVv(v); setVvValue(v.value); setVvModal(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {variantValues.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sin valores</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination page={vvPag.page} totalPages={vvPag.totalPages} total={vvPag.total} onPageChange={vvPag.setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── MODALS ─── */}
      <Dialog open={typeModal} onOpenChange={setTypeModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editType ? "Editar tipo" : "Nuevo tipo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="Ej: Remeras" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeModal(false)}>Cancelar</Button>
            <Button onClick={saveType}>{editType ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catModal} onOpenChange={setCatModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editCat ? "Editar categoría" : "Nueva categoría"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ej: Nike" /></div>
            <div>
              <Label>Tipo (opcional)</Label>
              <Select value={catTypeId} onValueChange={setCatTypeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {types.filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatModal(false)}>Cancelar</Button>
            <Button onClick={saveCat}>{editCat ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vsModal} onOpenChange={setVsModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editVs ? "Editar set" : "Nuevo set de variantes"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={vsName} onChange={(e) => setVsName(e.target.value)} placeholder="Ej: Talles" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVsModal(false)}>Cancelar</Button>
            <Button onClick={saveVs}>{editVs ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vvModal} onOpenChange={setVvModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editVv ? "Editar valor" : "Nuevo valor"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Valor</Label><Input value={vvValue} onChange={(e) => setVvValue(e.target.value)} placeholder="Ej: XL" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVvModal(false)}>Cancelar</Button>
            <Button onClick={saveVv}>{editVv ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
