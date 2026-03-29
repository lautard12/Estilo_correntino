import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";
import {
  ensureProductPrices, saveProductPrices, fetchPriceSettings,
  type ProductPrice, type PriceSettings,
} from "@/lib/price-store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName: string;
}

export default function PriceDrawer({ open, onOpenChange, productId, productName }: Props) {
  const queryClient = useQueryClient();
  const [baseRest, setBaseRest] = useState("");
  const [baseDel, setBaseDel] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery<PriceSettings>({
    queryKey: ["price-settings"],
    queryFn: fetchPriceSettings,
  });

  const { data: prices } = useQuery<ProductPrice[]>({
    queryKey: ["product-prices", productId],
    queryFn: () => ensureProductPrices(productId!),
    enabled: !!productId && open,
  });

  useEffect(() => {
    if (prices) {
      const br = prices.find((p) => p.channel === "LOCAL" && p.term === "EFECTIVO");
      const bd = prices.find((p) => p.channel === "ONLINE" && p.term === "EFECTIVO");
      setBaseRest(br && br.price > 0 ? String(br.price) : "");
      setBaseDel(bd && bd.price > 0 ? String(bd.price) : "");
    }
  }, [prices]);

  const c1Pct = settings?.credit_1_pct ?? 10;
  const c3Pct = settings?.credit_3_pct ?? 20;

  const calc = (base: string, pct: number) => {
    const n = parseFloat(base) || 0;
    return n > 0 ? Math.round(n * (1 + pct / 100)) : 0;
  };

  const handleSave = async () => {
    if (!productId || !settings) return;
    const br = parseFloat(baseRest) || 0;
    const bd = parseFloat(baseDel) || 0;
    if (br < 0 || bd < 0) {
      toast({ title: "Los precios no pueden ser negativos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveProductPrices(productId, br, bd, settings);
      queryClient.invalidateQueries({ queryKey: ["product-prices", productId] });
      queryClient.invalidateQueries({ queryKey: ["price-completeness"] });
      toast({ title: "Precios guardados" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyRestToDelivery = () => {
    setBaseDel(baseRest);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Precios: {productName}</SheetTitle>
          <SheetDescription className="text-xs">
            Crédito 1: +{c1Pct}% | Crédito 3: +{c3Pct}%
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">LOCAL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">BASE (Efectivo/Débito)</Label>
                <Input type="number" min="0" placeholder="0" value={baseRest} onChange={(e) => setBaseRest(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Crédito 1 (+{c1Pct}%)</Label>
                  <Input readOnly className="bg-muted" value={calc(baseRest, c1Pct) || ""} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Crédito 3 (+{c3Pct}%)</Label>
                  <Input readOnly className="bg-muted" value={calc(baseRest, c3Pct) || ""} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" size="sm" className="w-full" onClick={copyRestToDelivery}>
            <Copy className="mr-2 h-3 w-3" /> Copiar Local → Online
          </Button>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ONLINE</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">BASE (Efectivo/Débito)</Label>
                <Input type="number" min="0" placeholder="0" value={baseDel} onChange={(e) => setBaseDel(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Crédito 1 (+{c1Pct}%)</Label>
                  <Input readOnly className="bg-muted" value={calc(baseDel, c1Pct) || ""} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Crédito 3 (+{c3Pct}%)</Label>
                  <Input readOnly className="bg-muted" value={calc(baseDel, c3Pct) || ""} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
