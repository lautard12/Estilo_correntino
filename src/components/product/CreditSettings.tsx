import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { fetchPriceTerms, updatePriceTerm, type PriceTerm } from "@/lib/config-store";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreditSettings({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [surcharges, setSurcharges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const { data: terms = [] } = useQuery<PriceTerm[]>({
    queryKey: ["cfg-price-terms"],
    queryFn: fetchPriceTerms,
  });

  // Only show active terms with surcharge capability (exclude EFECTIVO/TRANSFERENCIA base terms)
  const editableTerms = terms.filter((t) => t.is_active && t.surcharge_pct > 0);

  useEffect(() => {
    if (terms.length > 0) {
      const map: Record<string, string> = {};
      for (const t of editableTerms) {
        map[t.id] = String(t.surcharge_pct);
      }
      setSurcharges(map);
    }
  }, [terms]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const t of editableTerms) {
        const newPct = parseFloat(surcharges[t.id] ?? "0") || 0;
        if (newPct !== t.surcharge_pct) {
          await updatePriceTerm(t.id, { surcharge_pct: newPct });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["cfg-price-terms"] });
      toast({ title: "Configuración guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      // Fetch current terms for surcharges
      const currentTerms = await fetchPriceTerms();
      const surchargeMap: Record<string, number> = {};
      for (const t of currentTerms) {
        surchargeMap[t.code] = t.surcharge_pct;
      }

      // Get all BASE prices
      // Get all EFECTIVO (base) prices
      const { data: basePrices, error } = await supabase
        .from("product_prices")
        .select("product_id, channel, price")
        .eq("term", "EFECTIVO");
      if (error) throw error;

      // For each surcharge term, recalculate from base
      const nonBaseTerms = currentTerms.filter((t) => t.surcharge_pct > 0 && t.is_active);
      for (const bp of basePrices ?? []) {
        for (const term of nonBaseTerms) {
          const newPrice = Math.round(bp.price * (1 + term.surcharge_pct / 100));
          await supabase
            .from("product_prices")
            .update({ price: newPrice })
            .eq("product_id", bp.product_id)
            .eq("channel", bp.channel)
            .eq("term", term.code);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["price-completeness"] });
      toast({ title: "Todos los precios recalculados" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Configuración de Precios</DialogTitle>
          <DialogDescription>Recargos aplicados sobre el precio base.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm font-medium">Recargo por término de precio</p>
          <div className="grid grid-cols-2 gap-3">
            {editableTerms.map((t) => (
              <div key={t.id} className="space-y-1">
                <Label className="text-xs">{t.label} (%)</Label>
                <Input
                  type="number"
                  min="0"
                  value={surcharges[t.id] ?? "0"}
                  onChange={(e) => setSurcharges((prev) => ({ ...prev, [t.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {editableTerms.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay términos con recargo configurados. Agregá términos desde Configuración.</p>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleSave} disabled={saving || editableTerms.length === 0} className="w-full">
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
          <Button variant="outline" onClick={handleRecalculate} disabled={recalculating} className="w-full">
            {recalculating ? "Recalculando..." : "Recalcular todos los precios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
