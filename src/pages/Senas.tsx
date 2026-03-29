import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  BookmarkCheck, Phone, User, Calendar, DollarSign, Plus, X, RotateCcw,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  fetchLayaways, addLayawayPayment, cancelLayaway, type Layaway,
} from "@/lib/layaway-store";

const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  PENDING: { label: "Pendiente", variant: "default" },
  COMPLETED: { label: "Completada", variant: "secondary" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
};

const PAYMENT_METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "DEBITO", label: "Débito" },
  { value: "QR", label: "QR" },
  { value: "MERCADOPAGO", label: "MercadoPago" },
];

export default function Senas() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("PENDING");
  const [payModal, setPayModal] = useState<Layaway | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<Layaway | null>(null);
  const [detailModal, setDetailModal] = useState<Layaway | null>(null);

  const { data: layaways = [], isLoading } = useQuery({
    queryKey: ["layaways", filter],
    queryFn: () => fetchLayaways(filter),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["layaways"] });

  const handleCancel = async () => {
    if (!cancelConfirm) return;
    try {
      await cancelLayaway(cancelConfirm.id);
      toast.success("Seña cancelada y stock restaurado");
      invalidate();
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setCancelConfirm(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Señas</h1>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="PENDING">Pendientes</SelectItem>
            <SelectItem value="COMPLETED">Completadas</SelectItem>
            <SelectItem value="CANCELLED">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : layaways.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay señas.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {layaways.map((l) => {
            const st = STATUS_LABELS[l.status] ?? STATUS_LABELS.PENDING;
            return (
              <Card
                key={l.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setDetailModal(l)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate">
                      {l.customer_name || "Sin nombre"}
                    </CardTitle>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {l.customer_phone && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{l.customer_phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{fmt(l.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pagado</span>
                    <span className="text-green-600 font-medium">{fmt(l.paid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resta</span>
                    <span className="text-destructive font-medium">{fmt(l.balance)}</span>
                  </div>
                  {l.due_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Vence: {format(new Date(l.due_date + "T12:00:00"), "dd/MM/yyyy")}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                  </p>

                  {l.status === "PENDING" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => { e.stopPropagation(); setPayModal(l); }}
                      >
                        <DollarSign className="h-3 w-3 mr-1" /> Pagar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => { e.stopPropagation(); setCancelConfirm(l); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <Dialog open={!!detailModal} onOpenChange={() => setDetailModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Detalle de seña</DialogTitle>
              <DialogDescription>
                {detailModal.customer_name || "Sin nombre"} — {fmt(detailModal.total)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold">{fmt(detailModal.total)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pagado</p>
                  <p className="font-bold text-green-600">{fmt(detailModal.paid)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Resta</p>
                  <p className="font-bold text-destructive">{fmt(detailModal.balance)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <Badge variant={STATUS_LABELS[detailModal.status]?.variant ?? "default"}>
                    {STATUS_LABELS[detailModal.status]?.label ?? detailModal.status}
                  </Badge>
                </div>
              </div>

              {detailModal.items && detailModal.items.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Productos</p>
                  <div className="space-y-1">
                    {detailModal.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs border-b pb-1">
                        <span>
                          {item.name_snapshot}
                          {item.variant_snapshot && ` ${item.variant_snapshot}`}
                          {" × "}{item.qty}
                        </span>
                        <span>{fmt(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailModal.notes && (
                <div>
                  <p className="text-muted-foreground">Notas</p>
                  <p>{detailModal.notes}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Pay Modal */}
      <PaymentModal
        layaway={payModal}
        onClose={() => setPayModal(null)}
        onPaid={() => {
          invalidate();
          setPayModal(null);
        }}
      />

      {/* Cancel Confirm */}
      <AlertDialog open={!!cancelConfirm} onOpenChange={() => setCancelConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta seña?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelará la venta y el stock se restaurará. Los pagos ya realizados no se devuelven automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Sí, cancelar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PaymentModal({
  layaway, onClose, onPaid,
}: { layaway: Layaway | null; onClose: () => void; onPaid: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [saving, setSaving] = useState(false);

  if (!layaway) return null;

  const handlePay = async () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    setSaving(true);
    try {
      await addLayawayPayment(layaway.id, amt, method);
      toast.success(amt >= layaway.balance ? "¡Seña completada!" : "Pago registrado");
      setAmount("");
      onPaid();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!layaway} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {layaway.customer_name} — Resta: {fmt(layaway.balance)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Monto</Label>
            <Input
              type="number"
              placeholder={String(layaway.balance)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label>Medio de pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handlePay} disabled={saving}>
            {saving ? "Procesando…" : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
