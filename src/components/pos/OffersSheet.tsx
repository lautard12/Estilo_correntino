import { useQuery } from "@tanstack/react-query";
import { Tag, Check, X, Package } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchActivePromotionsWithProducts,
  type PromotionWithProducts,
} from "@/lib/promotions-store";

function promoSummary(p: PromotionWithProducts): string {
  switch (p.type) {
    case "BUY_X_GET_Y":
      return `Comprá ${p.buy_qty}, llevá ${(p.buy_qty ?? 0) + (p.get_qty ?? 0)}`;
    case "PERCENT_OFF":
      return `${p.percent_off}% de descuento`;
    case "FIXED_PRICE":
      return `Precio fijo $${(p.fixed_price ?? 0).toLocaleString("es-AR")} c/u`;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set of promotion IDs currently applied */
  appliedPromoIds: Set<string>;
  onSelectOffer: (promo: PromotionWithProducts) => void;
  onRemoveOffer: (promoId: string) => void;
}

export function OffersSheet({ open, onOpenChange, appliedPromoIds, onSelectOffer, onRemoveOffer }: Props) {
  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["promos-active-with-products"],
    queryFn: fetchActivePromotionsWithProducts,
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Tag className="h-5 w-5" />Ofertas disponibles</SheetTitle>
          <SheetDescription>Seleccioná una oferta y los productos se agregan al carrito automáticamente.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando ofertas…</p>
          ) : promos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No hay ofertas activas</p>
          ) : (
            <div className="space-y-3">
              {promos.map((promo) => {
                const isApplied = appliedPromoIds.has(promo.id);

                return (
                  <div
                    key={promo.id}
                    className={`border rounded-lg p-4 space-y-3 transition-colors ${
                      isApplied ? "bg-primary/5 border-primary" : ""
                    }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{promo.name}</p>
                        <p className="text-xs text-muted-foreground">{promoSummary(promo)}</p>
                      </div>
                      {isApplied && (
                        <Badge variant="default" className="text-xs shrink-0">Aplicada</Badge>
                      )}
                    </div>

                    {/* Products list */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" /> Productos incluidos:
                      </p>
                      {promo.products.map((prod) => (
                        <div key={prod.id} className="flex justify-between items-center text-xs pl-4">
                          <span className="truncate">
                            {prod.name}
                            {prod.variant_label && <span className="text-muted-foreground ml-1">{prod.variant_label}</span>}
                          </span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            ${prod.unit_price.toLocaleString("es-AR")}
                            {prod.track_stock && <span className="ml-1">(st: {prod.qty_on_hand})</span>}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Action button */}
                    {isApplied ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => onRemoveOffer(promo.id)}
                      >
                        <X className="h-4 w-4 mr-1" /> Quitar oferta
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => onSelectOffer(promo)}
                      >
                        <Check className="h-4 w-4 mr-1" /> Aplicar oferta
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
