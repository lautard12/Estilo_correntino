import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchActiveProductsWithPrices,
  createSale,
  createLayawaySale,
  type CartItem,
  type Channel,
  type PaymentLine,
  type ActiveProduct,
} from "@/lib/pos-store";
import { fetchPriceTerms, type PriceTerm as CfgPriceTerm } from "@/lib/config-store";
import {
  computeDiscountLines,
  fetchActivePromotionsForProducts,
  type DiscountLine,
  type PromotionWithProducts,
} from "@/lib/promotions-store";
import { useAuth } from "@/hooks/use-auth";
import { CheckoutModal } from "@/components/pos/CheckoutModal";
import { CustomerSelector } from "@/components/pos/CustomerSelector";
import { OffersSheet } from "@/components/pos/OffersSheet";
import type { Customer } from "@/lib/customer-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, Plus, Minus, Trash2, Search, AlertCircle, Tag,
} from "lucide-react";

let cartIdCounter = 0;

export default function POS() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [channel, setChannel] = useState<Channel>("LOCAL");
  const [selectedTermCode, setSelectedTermCode] = useState("BASE");
  const [deliveryFee, setDeliveryFee] = useState(0);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [localSearch, setLocalSearch] = useState("");
  const [localCatFilter, setLocalCatFilter] = useState("ALL");
  const [localStockOnly, setLocalStockOnly] = useState(false);

  // Offers state — combo-first: promoId -> productIds it added
  const [offersOpen, setOffersOpen] = useState(false);
  const [appliedOffers, setAppliedOffers] = useState<Record<string, string>>({});
  // Track which promos are applied (promoId -> promo data)
  const [appliedPromos, setAppliedPromos] = useState<Record<string, PromotionWithProducts>>({});

  const { data: products = [], isLoading: loadingP } = useQuery({
    queryKey: ["pos-products"],
    queryFn: fetchActiveProductsWithPrices,
  });

  const { data: priceTerms = [] } = useQuery({
    queryKey: ["cfg-price-terms"],
    queryFn: fetchPriceTerms,
  });

  const activeTerms = priceTerms.filter((t) => t.is_active);
  const selectedTerm = activeTerms.find((t) => t.code === selectedTermCode) ?? activeTerms[0];

  const getPriceKey = (ch: Channel, termCode: string) => `${ch}_${termCode}`;

  const getUnitPrice = (product: ActiveProduct, ch: Channel, term: CfgPriceTerm | undefined) => {
    if (!term) return 0;
    const exactKey = getPriceKey(ch, term.code);
    const exactPrice = product.prices[exactKey];
    if (exactPrice && exactPrice > 0) return exactPrice;
    const baseKey = getPriceKey(ch, "EFECTIVO");
    const basePrice = product.prices[baseKey];
    if (!basePrice || basePrice <= 0) return 0;
    return Math.round(basePrice * (1 + (term.surcharge_pct ?? 0) / 100));
  };

  const localCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let items = products;
    if (localCatFilter !== "ALL") items = items.filter((p) => p.category === localCatFilter);
    if (localStockOnly) items = items.filter((p) => !p.track_stock || p.qty_on_hand > 0);
    const s = localSearch.toLowerCase();
    if (s) items = items.filter((p) => p.name.toLowerCase().includes(s) || p.variant_label.toLowerCase().includes(s) || p.category.toLowerCase().includes(s));
    return items.sort((a, b) => {
      const aHas = !a.track_stock || a.qty_on_hand > 0 ? 0 : 1;
      const bHas = !b.track_stock || b.qty_on_hand > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.name.localeCompare(b.name);
    });
  }, [products, localSearch, localCatFilter, localStockOnly]);

  const addLocalProduct = (p: ActiveProduct) => {
    const price = getUnitPrice(p, channel, selectedTerm);
    if (!price || price <= 0) {
      toast({ title: "Falta precio", description: `No hay precio para ${channel} / ${selectedTerm?.label}`, variant: "destructive" });
      return;
    }
    const existing = cart.find((c) => c.product_id === p.id);
    if (existing) {
      if (p.track_stock && existing.qty + 1 > p.qty_on_hand) {
        toast({ title: "Stock insuficiente", description: `Disponible: ${p.qty_on_hand}`, variant: "destructive" });
        return;
      }
      setCart((prev) => prev.map((c) => (c.id === existing.id ? { ...c, qty: c.qty + 1, unit_price: price } : c)));
    } else {
      if (p.track_stock && p.qty_on_hand < 1) {
        toast({ title: "Sin stock", description: p.name, variant: "destructive" });
        return;
      }
      setCart((prev) => [...prev, {
        id: `cart-${++cartIdCounter}`, owner: "LOCAL", item_type: "PRODUCT",
        product_id: p.id, name: p.name + (p.variant_label ? ` ${p.variant_label}` : ""),
        variant: p.variant_label, qty: 1, unit_price: price, notes: "", track_stock: p.track_stock,
      }]);
    }
  };

  // ── Combo-first: select offer → auto-add products ──
  const handleSelectOffer = (promo: PromotionWithProducts) => {
    const newAppliedOffers = { ...appliedOffers };

    for (const prod of promo.products) {
      // Determine required qty
      let requiredQty = 1;
      if (promo.type === "BUY_X_GET_Y") {
        const comboSize = (promo.buy_qty ?? 1) + (promo.get_qty ?? 1);
        // If multiple products, 1 of each. If single product, full combo qty.
        requiredQty = promo.products.length === 1 ? comboSize : 1;
      }

      // Find price for current channel/term
      const fullProd = products.find((p) => p.id === prod.id);
      const price = fullProd ? getUnitPrice(fullProd, channel, selectedTerm) : prod.unit_price;

      if (!price || price <= 0) {
        toast({ title: "Sin precio", description: `${prod.name} no tiene precio para este canal/término`, variant: "destructive" });
        return;
      }

      // Check stock
      if (prod.track_stock && prod.qty_on_hand < requiredQty) {
        toast({ title: "Stock insuficiente", description: `${prod.name}: necesitás ${requiredQty}, hay ${prod.qty_on_hand}`, variant: "destructive" });
        return;
      }

      // Add or adjust cart
      const existing = cart.find((c) => c.product_id === prod.id);
      if (existing) {
        // Ensure at least requiredQty
        if (existing.qty < requiredQty) {
          setCart((prev) => prev.map((c) =>
            c.id === existing.id ? { ...c, qty: requiredQty, unit_price: price } : c
          ));
        }
      } else {
        setCart((prev) => [...prev, {
          id: `cart-${++cartIdCounter}`, owner: "LOCAL", item_type: "PRODUCT",
          product_id: prod.id,
          name: prod.name + (prod.variant_label ? ` ${prod.variant_label}` : ""),
          variant: prod.variant_label, qty: requiredQty, unit_price: price,
          notes: "", track_stock: prod.track_stock,
        }]);
      }

      // Register applied offer for this product
      newAppliedOffers[prod.id] = promo.id;
    }

    setAppliedOffers(newAppliedOffers);
    setAppliedPromos((prev) => ({ ...prev, [promo.id]: promo }));
    toast({ title: "Oferta aplicada", description: promo.name });
  };

  const handleRemoveOffer = (promoId: string) => {
    const promo = appliedPromos[promoId];
    if (promo) {
      // Remove appliedOffers entries for this promo's products
      setAppliedOffers((prev) => {
        const next = { ...prev };
        for (const prod of promo.products) {
          if (next[prod.id] === promoId) delete next[prod.id];
        }
        return next;
      });
      // Remove products that were added by this promo (only if they have exact promo qty)
      setCart((prev) => {
        const promoProductIds = new Set(promo.products.map((p) => p.id));
        return prev.filter((c) => {
          if (!c.product_id || !promoProductIds.has(c.product_id)) return true;
          // Keep the item — user might have added it manually too
          return true;
        });
      });
    }
    setAppliedPromos((prev) => {
      const { [promoId]: _, ...rest } = prev;
      return rest;
    });
    toast({ title: "Oferta quitada" });
  };

  const updateQty = (cartId: string, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.id !== cartId) return c;
      const newQty = c.qty + delta;
      if (newQty <= 0) return null;
      if (c.track_stock && c.product_id) {
        const prod = products.find((p) => p.id === c.product_id);
        if (prod && newQty > prod.qty_on_hand) {
          toast({ title: "Stock insuficiente", variant: "destructive" });
          return c;
        }
      }
      return { ...c, qty: newQty };
    }).filter(Boolean) as CartItem[]);
  };

  const removeItem = (cartId: string) => {
    const item = cart.find((c) => c.id === cartId);
    if (item?.product_id && appliedOffers[item.product_id]) {
      const promoId = appliedOffers[item.product_id];
      // Remove the whole promo if one of its products is removed
      handleRemoveOffer(promoId);
    }
    setCart((prev) => prev.filter((c) => c.id !== cartId));
  };

  // Fetch promos for current cart products (for discount computation)
  const cartProductIds = cart.filter((c) => c.product_id).map((c) => c.product_id!);
  const { data: promosByProduct = {} } = useQuery({
    queryKey: ["promos-active-for-products", cartProductIds.sort().join(",")],
    queryFn: () => fetchActivePromotionsForProducts(cartProductIds),
    enabled: cartProductIds.length > 0 && Object.keys(appliedOffers).length > 0,
  });

  // Compute discount lines
  const discountLines = useMemo(() => {
    if (Object.keys(appliedOffers).length === 0) return [];
    return computeDiscountLines(cart, appliedOffers, promosByProduct);
  }, [cart, appliedOffers, promosByProduct]);

  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.qty, 0);
  const discountTotal = discountLines.reduce((s, d) => s + d.line_total, 0);
  const total = subtotal + (channel === "ONLINE" ? deliveryFee : 0) + discountTotal;
  const appliedCount = Object.keys(appliedPromos).length;
  const appliedPromoIdSet = useMemo(() => new Set(Object.keys(appliedPromos)), [appliedPromos]);

  const handleConfirmSale = async (payments: PaymentLine[]) => {
    setSaving(true);
    try {
      // payments already have fund from CheckoutModal
      const enrichedPayments = payments.map((p) => {
        const term = activeTerms.find((t) => t.code === p.payment_method);
        return {
          ...p,
          fund: (p as any).fund || term?.fund || "EFECTIVO",
        };
      });
      await createSale(
        {
          channel, price_term: selectedTermCode,
          delivery_fee: channel === "ONLINE" ? deliveryFee : 0,
          customer_id: selectedCustomer?.id,
          customer_name_snapshot: selectedCustomer?.full_name,
          customer_email_snapshot: selectedCustomer?.email ?? undefined,
        },
        cart, enrichedPayments, user?.id, discountLines
      );
      toast({ title: "¡Venta registrada!" });
      setCart([]);
      setSelectedCustomer(null);
      setCheckoutOpen(false);
      setAppliedOffers({});
      setAppliedPromos({});
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLayaway = async (layawayData: any) => {
    setSaving(true);
    try {
      await createLayawaySale(
        {
          channel, price_term: selectedTermCode,
          delivery_fee: channel === "ONLINE" ? deliveryFee : 0,
          customer_id: selectedCustomer?.id,
          customer_name_snapshot: selectedCustomer?.full_name,
          customer_email_snapshot: selectedCustomer?.email ?? undefined,
        },
        cart, layawayData, user?.id
      );
      toast({ title: "¡Seña registrada!" });
      setCart([]);
      setSelectedCustomer(null);
      setCheckoutOpen(false);
      setAppliedOffers({});
      setAppliedPromos({});
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["layaways"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateCartPrices = (newChannel: Channel, newTermCode: string) => {
    const term = activeTerms.find((t) => t.code === newTermCode);
    setCart((prev) => prev.map((c) => {
      if (!c.product_id) return c;
      const prod = products.find((p) => p.id === c.product_id);
      if (!prod) return c;
      const newPrice = getUnitPrice(prod, newChannel, term);
      if (!newPrice || newPrice <= 0) return c;
      return { ...c, unit_price: newPrice };
    }));
  };

  const handleChannelChange = (ch: Channel) => {
    setChannel(ch);
    if (ch === "LOCAL") setDeliveryFee(0);
    updateCartPrices(ch, selectedTermCode);
  };

  const handleTermChange = (code: string) => {
    setSelectedTermCode(code);
    updateCartPrices(channel, code);
  };

  if (loadingP) {
    return <div className="p-6 text-muted-foreground">Cargando datos...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-background border-b p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium mr-1">Canal:</span>
          {(["LOCAL", "ONLINE"] as Channel[]).map((ch) => (
            <Button key={ch} size="sm" variant={channel === ch ? "default" : "outline"} onClick={() => handleChannelChange(ch)} disabled={cart.length > 0 && channel !== ch}>
              {ch === "LOCAL" ? "Local" : "Online"}
            </Button>
          ))}
          {channel === "ONLINE" && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-sm">Envío $</span>
              <Input type="number" className="w-20 h-8" value={deliveryFee || ""} onChange={(e) => setDeliveryFee(parseInt(e.target.value) || 0)} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium mr-1">Precio:</span>
          {activeTerms.map((t) => (
            <Button key={t.code} size="sm" variant={selectedTermCode === t.code ? "default" : "outline"} onClick={() => handleTermChange(t.code)}>
              {t.label}
              {t.surcharge_pct !== 0 && <span className="ml-1 text-xs opacity-70">({t.surcharge_pct > 0 ? "+" : ""}{t.surcharge_pct}%)</span>}
            </Button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">
        {/* PRODUCT LIST */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar producto..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="pl-8 h-9" />
            </div>
            <Select value={localCatFilter} onValueChange={setLocalCatFilter}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {localCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="stock-only" checked={localStockOnly} onCheckedChange={setLocalStockOnly} />
            <Label htmlFor="stock-only" className="text-xs cursor-pointer">Solo con stock</Label>
          </div>
          <div className="space-y-1">
            {filteredProducts.map((p) => {
              const price = getUnitPrice(p, channel, selectedTerm);
              const noPrice = !price || price <= 0;
              const noStock = p.track_stock && p.qty_on_hand <= 0;
              return (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/50 cursor-pointer" onClick={() => !noPrice && !noStock && addLocalProduct(p)}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {p.name}
                      {p.variant_label && <span className="text-muted-foreground ml-1">{p.variant_label}</span>}
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{p.category}</span>
                      {p.track_stock && <span>Stock: {p.qty_on_hand}</span>}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    {noPrice ? (
                      <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 mr-1" />Sin precio</Badge>
                    ) : noStock ? (
                      <Badge variant="secondary" className="text-xs">Sin stock</Badge>
                    ) : (
                      <span className="font-semibold text-sm">${price.toLocaleString("es-AR")}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay productos</p>
            )}
          </div>
        </div>

        {/* CART */}
        <div className="w-80 border-l flex flex-col bg-muted/30 max-md:hidden overflow-hidden">
          <div className="p-3 border-b font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Carrito ({cart.length})
          </div>
          <ScrollArea className="flex-1 p-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carrito vacío</p>
            ) : (
              <div className="space-y-2">
                {cart.map((c) => (
                  <div key={c.id} className="bg-background rounded-md p-2 border text-sm space-y-1">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0"><div className="font-medium truncate">{c.name}</div></div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeItem(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(c.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-6 text-center">{c.qty}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(c.id, 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">${c.unit_price.toLocaleString("es-AR")} c/u</div>
                        <div className="font-medium">${(c.unit_price * c.qty).toLocaleString("es-AR")}</div>
                      </div>
                    </div>
                    {c.product_id && appliedOffers[c.product_id] && (
                      <div className="text-xs text-primary flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Promo aplicada
                      </div>
                    )}
                  </div>
                ))}
                {/* Discount lines display */}
                {discountLines.map((d, i) => (
                  <div key={`disc-${i}`} className="bg-primary/5 rounded-md p-2 border border-primary/20 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-primary font-medium text-xs truncate">{d.name}</span>
                      <span className="text-primary font-bold">{d.line_total < 0 ? "-" : ""}${Math.abs(d.line_total).toLocaleString("es-AR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="border-t p-3 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <CustomerSelector selected={selectedCustomer} onSelect={setSelectedCustomer} />
            </div>
          </div>
          <div className="border-t p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toLocaleString("es-AR")}</span></div>
            {discountTotal < 0 && (
              <div className="flex justify-between text-primary font-medium">
                <span>Descuentos</span>
                <span>-${Math.abs(discountTotal).toLocaleString("es-AR")}</span>
              </div>
            )}
            {channel === "ONLINE" && deliveryFee > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground"><span>Envío</span><span>${deliveryFee.toLocaleString("es-AR")}</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>${total.toLocaleString("es-AR")}</span></div>
            
            {/* Offers button — always enabled */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setOffersOpen(true)}
            >
              <Tag className="h-4 w-4 mr-2" />
              Ofertas{appliedCount > 0 ? ` (${appliedCount})` : ""}
            </Button>

            <Button className="w-full" disabled={cart.length === 0 || !selectedCustomer} onClick={() => setCheckoutOpen(true)}>
              {!selectedCustomer && cart.length > 0 ? "Seleccioná un cliente" : `Cobrar $${total.toLocaleString("es-AR")}`}
            </Button>
          </div>
        </div>
      </div>

      {/* MOBILE FAB */}
      <div className="md:hidden fixed bottom-4 right-4 z-20">
        <Button size="lg" className="rounded-full shadow-lg" disabled={cart.length === 0 || !selectedCustomer} onClick={() => setCheckoutOpen(true)}>
          <ShoppingCart className="h-5 w-5 mr-2" />
          {cart.length > 0 && !selectedCustomer ? "Falta cliente" : cart.length > 0 ? `$${total.toLocaleString("es-AR")}` : "Carrito"}
        </Button>
      </div>

      <OffersSheet
        open={offersOpen}
        onOpenChange={setOffersOpen}
        appliedPromoIds={appliedPromoIdSet}
        onSelectOffer={handleSelectOffer}
        onRemoveOffer={handleRemoveOffer}
      />

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        total={total}
        subtotalLocal={subtotal + discountTotal}
        subtotalRestaurant={0}
        deliveryFee={channel === "ONLINE" ? deliveryFee : 0}
        priceTerm={selectedTermCode}
        onConfirm={handleConfirmSale}
        onLayaway={handleLayaway}
        loading={saving}
        customerName={selectedCustomer?.full_name}
        discountTotal={discountTotal}
      />
    </div>
  );
}
