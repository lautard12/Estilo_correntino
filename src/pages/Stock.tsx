import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProductsWithStock, fetchMovements, addMovement, applyCount, fetchCategories } from "@/lib/supabase-store";
import { ProductType, MovementType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { History, ClipboardCheck, Plus, Minus, SlidersHorizontal, Package, CalendarCheck, ShoppingBag } from "lucide-react";
import { StarRatingDisplay } from "@/components/ui/star-rating";
import { StockActionModal } from "@/components/stock/StockActionModal";
import { HistoryDrawer } from "@/components/stock/HistoryDrawer";
import { CountMode } from "@/components/stock/CountMode";
import { WeeklyCountMode } from "@/components/stock/WeeklyCountMode";
import ProductPurchaseHistory from "@/components/stock/ProductPurchaseHistory";
import { toast } from "@/hooks/use-toast";

const typeBadgeStyles: Record<ProductType, string> = {
  JUEGOS_PARRILLEROS: 'bg-orange-100 text-orange-800 border-orange-200',
  CUCHILLOS_CHICOS: 'bg-sky-100 text-sky-800 border-sky-200',
  CUCHILLOS_MEDIANOS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CUCHILLOS_ESPECIALES: 'bg-violet-100 text-violet-800 border-violet-200',
  CUCHILLOS_RAROS: 'bg-rose-100 text-rose-800 border-rose-200',
  FACONES_Y_DAGAS: 'bg-amber-100 text-amber-800 border-amber-200',
  GAMA_PREMIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ACCESORIOS: 'bg-teal-100 text-teal-800 border-teal-200',
};

const statusBadge: Record<string, { label: string; className: string }> = {
  sin_stock: { label: 'Sin Stock', className: 'bg-red-100 text-red-800 border-red-200' },
  bajo: { label: 'Bajo', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  ok: { label: 'OK', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const statusOrder: Record<string, number> = { sin_stock: 0, bajo: 1, ok: 2 };

export default function Stock() {
  const queryClient = useQueryClient();
  const [stockMode, setStockMode] = useState<'inventario' | 'conteo-semanal'>('inventario');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-with-stock"],
    queryFn: fetchProductsWithStock,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["movements"],
    queryFn: fetchMovements,
  });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [onlyLow, setOnlyLow] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const [actionProduct, setActionProduct] = useState<any>(null);
  const [actionType, setActionType] = useState<'PURCHASE' | 'WASTE' | 'ADJUST' | null>(null);
  const [purchaseHistoryProduct, setPurchaseHistoryProduct] = useState<any>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const filterProducts = () => {
    return products
      .filter((p: any) => {
        if (search) {
          const term = search.toLowerCase();
          if (!p.name.toLowerCase().includes(term) && !p.variant_label.toLowerCase().includes(term)) return false;
        }
        if (categoryFilter !== 'all') {
          // Check if filter matches category or type
          if (p.category !== categoryFilter && p.type !== categoryFilter) return false;
        }
        if (onlyLow && p.status === 'ok') return false;
        return true;
      })
      .sort((a: any, b: any) => statusOrder[a.status] - statusOrder[b.status]);
  };

  const handleMovement = async (productId: string, type: MovementType, qty: number, reason: string) => {
    const result = await addMovement(productId, type, qty, reason);
    if (result.error) return result;
    queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
    queryClient.invalidateQueries({ queryKey: ["movements"] });
    toast({ title: "Movimiento registrado" });
    return result;
  };

  const handlePurchaseComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
    queryClient.invalidateQueries({ queryKey: ["movements"] });
    toast({ title: "Stock actualizado" });
  };

  const handleApplyCount = async (counts: Record<string, number>) => {
    try {
      const n = await applyCount(counts);
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      toast({ title: `Conteo aplicado: ${n} ajuste(s)` });
      return [];
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      return [];
    }
  };

  const renderTable = (items: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Proveedor</TableHead>
          <TableHead className="text-center">Calidad</TableHead>
          <TableHead className="text-center">Stock</TableHead>
          <TableHead className="text-center">Mín.</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
              No se encontraron productos
            </TableCell>
          </TableRow>
        )}
        {items.map((p: any) => {
          const sb = statusBadge[p.status] || statusBadge.ok;
          return (
            <TableRow key={p.id}>
              <TableCell>
                <span className="font-medium">{p.name}</span>{' '}
                <span className="text-muted-foreground text-sm">{p.variant_label}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={typeBadgeStyles[p.type as ProductType]}>{p.type}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.last_supplier ? (
                  <div>
                    <span>{p.last_supplier}</span>
                    {p.supplier_lead_time != null && (
                      <span className="block text-xs text-muted-foreground/70">{p.supplier_lead_time} días reposición</span>
                    )}
                  </div>
                ) : <span className="italic text-muted-foreground/50">—</span>}
              </TableCell>
              <TableCell className="text-center">
                <StarRatingDisplay value={p.quality_rating} />
              </TableCell>
              <TableCell className="text-center font-mono font-semibold">{p.qty_on_hand}</TableCell>
              <TableCell className="text-center text-muted-foreground">{p.min_stock}</TableCell>
              <TableCell>
                <Badge variant="outline" className={sb.className}>{sb.label}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setActionProduct(p); setActionType('PURCHASE'); }}>
                    <Plus className="h-3 w-3 mr-1" />Compra
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setPurchaseHistoryProduct(p)}>
                    <ShoppingBag className="h-3 w-3 mr-1" />Compras
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Cargando inventario...</div>;
  }

  const typeOptions = [
    { label: 'Juegos Parrilleros', value: 'JUEGOS_PARRILLEROS' },
    { label: 'Cuchillos Chicos', value: 'CUCHILLOS_CHICOS' },
    { label: 'Cuchillos Medianos', value: 'CUCHILLOS_MEDIANOS' },
    { label: 'Cuchillos Especiales', value: 'CUCHILLOS_ESPECIALES' },
    { label: 'Facones y Dagas', value: 'FACONES_Y_DAGAS' },
    { label: 'Gama Premium', value: 'GAMA_PREMIUM' },
    { label: 'Accesorios', value: 'ACCESORIOS' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Stock</h2>
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <button
            onClick={() => setStockMode('inventario')}
            className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all", stockMode === 'inventario' ? 'bg-background text-foreground shadow-sm' : '')}
          >
            <Package className="mr-2 h-4 w-4" /> Inventario
          </button>
          <button
            onClick={() => setStockMode('conteo-semanal')}
            className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all", stockMode === 'conteo-semanal' ? 'bg-background text-foreground shadow-sm' : '')}
          >
            <CalendarCheck className="mr-2 h-4 w-4" /> Conteo semanal
          </button>
        </div>
      </div>

      {stockMode === 'conteo-semanal' ? (
        <WeeklyCountMode />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filtrar por..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {categories.length > 0 && (
                  <>
                    <SelectItem disabled value="__cat_header__" className="text-xs font-semibold text-muted-foreground">— Categorías —</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </>
                )}
                <SelectItem disabled value="__type_header__" className="text-xs font-semibold text-muted-foreground">— Tipos —</SelectItem>
                {typeOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="low-stock" checked={onlyLow} onCheckedChange={setOnlyLow} />
              <Label htmlFor="low-stock" className="text-sm cursor-pointer">Solo bajos</Label>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                <History className="mr-2 h-4 w-4" /> Historial
              </Button>


            </div>
          </div>

          {renderTable(filterProducts())}
        </>
      )}

      <StockActionModal
        product={actionProduct}
        action={actionType}
        open={!!actionProduct && !!actionType}
        onClose={() => { setActionProduct(null); setActionType(null); }}
        onSubmit={handleMovement}
      />
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} movements={movements} />
      <ProductPurchaseHistory
        open={!!purchaseHistoryProduct}
        onOpenChange={(open) => { if (!open) setPurchaseHistoryProduct(null); }}
        productId={purchaseHistoryProduct?.id ?? null}
        productName={purchaseHistoryProduct ? `${purchaseHistoryProduct.name} ${purchaseHistoryProduct.variant_label}` : ""}
      />
    </div>
  );
}
