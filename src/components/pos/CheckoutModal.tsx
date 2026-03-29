import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { PaymentLine } from "@/lib/pos-store";
import { fetchPriceTerms, type PriceTerm } from "@/lib/config-store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  subtotalLocal: number;
  subtotalRestaurant: number;
  deliveryFee: number;
  priceTerm: string;
  onConfirm: (payments: PaymentLine[]) => void;
  onLayaway?: (data: {
    customerName: string;
    customerPhone: string;
    depositAmount: number;
    depositMethod: string;
    dueDate: string;
    notes: string;
  }) => void;
  loading: boolean;
  customerName?: string;
  discountTotal?: number;
}

interface PaymentLineState {
  id: number;
  termCode: string;
  amount: string;
}

let lineIdCounter = 0;

export function CheckoutModal({
  open, onOpenChange, total, subtotalLocal, subtotalRestaurant, deliveryFee, priceTerm, onConfirm, onLayaway, loading, customerName, discountTotal = 0,
}: Props) {
  const [mode, setMode] = useState<"sale" | "layaway">("sale");
  const [layName, setLayName] = useState("");
  const [layPhone, setLayPhone] = useState("");
  const [layDeposit, setLayDeposit] = useState("");
  const [layMethod, setLayMethod] = useState("");
  const [layDue, setLayDue] = useState("");
  const [layNotes, setLayNotes] = useState("");
  const [cashReceived, setCashReceived] = useState("");

  // Multi-payment lines
  const [paymentLines, setPaymentLines] = useState<PaymentLineState[]>([]);

  const { data: priceTerms = [] } = useQuery({ queryKey: ["cfg-price-terms"], queryFn: fetchPriceTerms });
  const activeTerms = priceTerms.filter((t) => t.is_active);

  const getTermByCode = (code: string) => activeTerms.find((t) => t.code === code);

  // Compute totals per line
  const lineDetails = useMemo(() => {
    return paymentLines.map((line) => {
      const term = getTermByCode(line.termCode);
      const amount = parseInt(line.amount) || 0;
      const commPct = term?.surcharge_pct ?? 0;
      const baseAmount = commPct > 0 ? Math.round(amount / (1 + commPct / 100)) : amount;
      const commAmount = amount - baseAmount;
      return { ...line, term, amount, commPct, commAmount, fund: term?.fund ?? "EFECTIVO" };
    });
  }, [paymentLines, activeTerms]);

  const totalAssigned = lineDetails.reduce((s, l) => s + l.amount, 0);
  const remaining = total - totalAssigned;
  const totalCommissions = lineDetails.reduce((s, l) => s + l.commAmount, 0);
  const isValid = remaining === 0 && paymentLines.length > 0 && paymentLines.every((l) => (parseInt(l.amount) || 0) > 0);

  // Cash handling
  const cashLines = lineDetails.filter((l) => l.fund === "EFECTIVO");
  const totalCash = cashLines.reduce((s, l) => s + l.amount, 0);
  const hasCashPayment = totalCash > 0;
  const parsedCashReceived = parseInt(cashReceived) || 0;
  const cashChange = hasCashPayment ? parsedCashReceived - totalCash : 0;

  const addLine = () => {
    const defaultTerm = activeTerms.find((t) => t.code === priceTerm) ?? activeTerms[0];
    const amt = remaining > 0 ? String(remaining) : "";
    setPaymentLines((prev) => [...prev, {
      id: ++lineIdCounter,
      termCode: defaultTerm?.code ?? "EFECTIVO",
      amount: amt,
    }]);
  };

  const updateLine = (id: number, field: keyof PaymentLineState, value: string) => {
    setPaymentLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLine = (id: number) => {
    setPaymentLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleConfirm = () => {
    const payments: PaymentLine[] = lineDetails.map((l) => ({
      payment_method: l.termCode,
      amount: l.amount,
      installments: l.term?.default_installments ?? 1,
      commission_pct: l.commPct,
      commission_amount: l.commAmount,
      fund: l.fund,
    }));
    onConfirm(payments);
  };

  const handleLayawayConfirm = () => {
    const deposit = parseInt(layDeposit) || 0;
    if (!layName.trim()) return;
    onLayaway?.({
      customerName: layName,
      customerPhone: layPhone,
      depositAmount: deposit,
      depositMethod: layMethod || (activeTerms.find((t) => t.fund === "EFECTIVO")?.code ?? "EFECTIVO"),
      dueDate: layDue,
      notes: layNotes,
    });
  };

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setMode("sale");
      setCashReceived("");
      setLayName(""); setLayPhone(""); setLayDeposit("");
      setLayMethod((activeTerms.find((t) => t.fund === "EFECTIVO")?.code) ?? (activeTerms[0]?.code) ?? "");
      setLayDue(""); setLayNotes("");
      // Initialize with a single payment line for the full total
      const defaultTerm = activeTerms.find((t) => t.code === priceTerm) ?? activeTerms[0];
      lineIdCounter = 0;
      setPaymentLines([{
        id: ++lineIdCounter,
        termCode: defaultTerm?.code ?? "EFECTIVO",
        amount: String(total),
      }]);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "sale" ? "Cobrar venta" : "Registrar seña"}</DialogTitle>
          <DialogDescription>Total: ${total.toLocaleString("es-AR")}</DialogDescription>
        </DialogHeader>

        {onLayaway && (
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "sale" ? "default" : "outline"} onClick={() => setMode("sale")} className="flex-1">Venta completa</Button>
            <Button size="sm" variant={mode === "layaway" ? "default" : "outline"} onClick={() => setMode("layaway")} className="flex-1">Seña</Button>
          </div>
        )}

        {mode === "sale" ? (
          <SaleMode
            total={total}
            subtotalLocal={subtotalLocal}
            discountTotal={discountTotal}
            deliveryFee={deliveryFee}
            customerName={customerName}
            paymentLines={paymentLines}
            lineDetails={lineDetails}
            activeTerms={activeTerms}
            totalAssigned={totalAssigned}
            remaining={remaining}
            totalCommissions={totalCommissions}
            hasCashPayment={hasCashPayment}
            totalCash={totalCash}
            cashReceived={cashReceived}
            cashChange={cashChange}
            isValid={isValid}
            loading={loading}
            onAddLine={addLine}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
            onCashReceivedChange={setCashReceived}
            onConfirm={handleConfirm}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <LayawayMode
            total={total}
            layName={layName} layPhone={layPhone} layDeposit={layDeposit}
            layMethod={layMethod} layDue={layDue} layNotes={layNotes}
            activeTerms={activeTerms}
            loading={loading}
            onLayNameChange={setLayName}
            onLayPhoneChange={setLayPhone}
            onLayDepositChange={setLayDeposit}
            onLayMethodChange={setLayMethod}
            onLayDueChange={setLayDue}
            onLayNotesChange={setLayNotes}
            onConfirm={handleLayawayConfirm}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sale Mode Component ────────────────────────────────────────────

function SaleMode({
  total, subtotalLocal, discountTotal, deliveryFee, customerName,
  paymentLines, lineDetails, activeTerms, totalAssigned, remaining,
  totalCommissions, hasCashPayment, totalCash, cashReceived, cashChange,
  isValid, loading,
  onAddLine, onUpdateLine, onRemoveLine, onCashReceivedChange, onConfirm, onCancel,
}: any) {
  return (
    <>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal productos</span>
          <span>${(subtotalLocal - discountTotal).toLocaleString("es-AR")}</span>
        </div>
        {discountTotal < 0 && (
          <div className="flex justify-between text-primary font-medium">
            <span>Descuentos</span>
            <span>-${Math.abs(discountTotal).toLocaleString("es-AR")}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Envío</span>
            <span>${deliveryFee.toLocaleString("es-AR")}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-lg border-t pt-2">
          <span>Total</span>
          <span>${total.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {customerName && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Cliente</span>
          <span className="font-medium">{customerName}</span>
        </div>
      )}

      {/* Payment Lines */}
      <div className="space-y-3 mt-2">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">Formas de pago</Label>
          <Button size="sm" variant="outline" onClick={onAddLine} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Agregar
          </Button>
        </div>

        {paymentLines.map((line: PaymentLineState, idx: number) => {
          const detail = lineDetails[idx];
          return (
            <div key={line.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={line.termCode} onValueChange={(v) => onUpdateLine(line.id, "termCode", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {activeTerms.map((t: PriceTerm) => (
                        <SelectItem key={t.code} value={t.code}>
                          {t.label}
                          {t.surcharge_pct > 0 && ` (+${t.surcharge_pct}%)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  className="w-28 h-8 text-sm"
                  value={line.amount}
                  onChange={(e) => onUpdateLine(line.id, "amount", e.target.value)}
                  placeholder="$0"
                />
                {paymentLines.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemoveLine(line.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Fondo: {detail?.fund ?? "—"}</span>
                {detail?.commAmount > 0 && (
                  <span className="text-destructive">Comisión: ${detail.commAmount.toLocaleString("es-AR")}</span>
                )}
              </div>
            </div>
          );
        })}

        {remaining !== 0 && (
          <div className={`text-sm font-medium ${remaining > 0 ? "text-destructive" : "text-orange-500"}`}>
            {remaining > 0
              ? `Falta asignar: $${remaining.toLocaleString("es-AR")}`
              : `Excedente: $${Math.abs(remaining).toLocaleString("es-AR")}`}
          </div>
        )}
      </div>

      {totalCommissions > 0 && (
        <div className="bg-muted rounded-md p-3 text-sm">
          <span className="text-muted-foreground">Comisiones totales: </span>
          <span className="font-medium text-destructive">${totalCommissions.toLocaleString("es-AR")}</span>
          <span className="text-muted-foreground"> → Neto: </span>
          <span className="font-medium">${(total - totalCommissions).toLocaleString("es-AR")}</span>
        </div>
      )}

      {hasCashPayment && (
        <div className="space-y-2">
          <Label className="text-sm">Monto recibido (efectivo)</Label>
          <Input
            type="number"
            value={cashReceived}
            onChange={(e) => onCashReceivedChange(e.target.value)}
            placeholder={String(totalCash)}
          />
          {cashChange > 0 && (
            <div className="bg-muted rounded-md p-3 text-sm font-medium">
              Vuelto: ${cashChange.toLocaleString("es-AR")}
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button
          onClick={onConfirm}
          disabled={!isValid || loading || (hasCashPayment && cashReceived !== "" && parseInt(cashReceived) < totalCash)}
        >
          {loading ? "Procesando..." : "Confirmar venta"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Layaway Mode Component ─────────────────────────────────────────

function LayawayMode({
  total, layName, layPhone, layDeposit, layMethod, layDue, layNotes,
  activeTerms, loading,
  onLayNameChange, onLayPhoneChange, onLayDepositChange, onLayMethodChange, onLayDueChange, onLayNotesChange,
  onConfirm, onCancel,
}: any) {
  return (
    <>
      <div className="space-y-3">
        <div><Label>Nombre del cliente *</Label><Input value={layName} onChange={(e: any) => onLayNameChange(e.target.value)} placeholder="Nombre" autoFocus /></div>
        <div><Label>Teléfono</Label><Input value={layPhone} onChange={(e: any) => onLayPhoneChange(e.target.value)} placeholder="Teléfono" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Seña (depósito)</Label><Input type="number" value={layDeposit} onChange={(e: any) => onLayDepositChange(e.target.value)} placeholder="0" /></div>
          <div>
            <Label>Medio</Label>
            <Select value={layMethod} onValueChange={onLayMethodChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {activeTerms.map((t: PriceTerm) => (
                  <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Fecha límite</Label><Input type="date" value={layDue} onChange={(e: any) => onLayDueChange(e.target.value)} /></div>
        <div><Label>Notas</Label><Input value={layNotes} onChange={(e: any) => onLayNotesChange(e.target.value)} placeholder="Opcional..." /></div>
        <div className="bg-muted rounded-md p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Total</span><span className="font-semibold">${total.toLocaleString("es-AR")}</span></div>
          <div className="flex justify-between"><span>Seña</span><span className="font-semibold">${(parseInt(layDeposit) || 0).toLocaleString("es-AR")}</span></div>
          <div className="flex justify-between border-t pt-1"><span>Resta</span><span className="font-bold text-destructive">${(total - (parseInt(layDeposit) || 0)).toLocaleString("es-AR")}</span></div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button onClick={onConfirm} disabled={!layName.trim() || loading}>
          {loading ? "Procesando..." : "Registrar seña"}
        </Button>
      </DialogFooter>
    </>
  );
}
