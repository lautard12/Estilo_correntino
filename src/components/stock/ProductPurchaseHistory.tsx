import { useQuery } from "@tanstack/react-query";
import { fetchProductPurchaseHistory } from "@/lib/supplier-store";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName: string;
}

export default function ProductPurchaseHistory({ open, onOpenChange, productId, productName }: Props) {
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["product-purchase-history", productId],
    queryFn: () => fetchProductPurchaseHistory(productId!),
    enabled: open && !!productId,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left">Historial de compras</SheetTitle>
          <p className="text-sm text-muted-foreground text-left">{productName}</p>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {!isLoading && purchases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No hay compras registradas para este producto</p>
          )}
          {purchases.map((p: any) => (
            <div key={p.id} className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  +{p.qty} unidades
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(p.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                </span>
              </div>
              {p.supplier && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {p.supplier.name}
                  </Badge>
                  {p.supplier.phone && (
                    <span className="text-xs text-muted-foreground">{p.supplier.phone}</span>
                  )}
                </div>
              )}
              {!p.supplier && (
                <span className="text-xs text-muted-foreground italic">Sin proveedor</span>
              )}
              {p.reason && p.reason !== "Compra mercadería" && (
                <p className="text-xs text-muted-foreground">{p.reason}</p>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
