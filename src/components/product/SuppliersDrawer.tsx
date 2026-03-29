import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier, type Supplier } from "@/lib/supplier-store";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SuppliersDrawer({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
    enabled: open,
  });

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLeadTime, setNewLeadTime] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLeadTime, setEditLeadTime] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const lt = newLeadTime ? parseInt(newLeadTime, 10) : null;
      await createSupplier(newName.trim(), newPhone.trim(), lt);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setNewName(""); setNewPhone(""); setNewLeadTime("");
      setAdding(false);
      toast({ title: "Proveedor creado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const lt = editLeadTime ? parseInt(editLeadTime, 10) : null;
      await updateSupplier(id, { name: editName.trim(), phone: editPhone.trim(), lead_time_days: lt });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setEditingId(null);
      toast({ title: "Proveedor actualizado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`¿Eliminar proveedor "${s.name}"?`)) return;
    try {
      await deleteSupplier(s.id);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor eliminado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const startEdit = (s: Supplier) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditPhone(s.phone || "");
    setEditLeadTime(s.lead_time_days != null ? String(s.lead_time_days) : "");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Proveedores</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {!adding && (
            <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo proveedor
            </Button>
          )}

          {adding && (
            <div className="border rounded-lg p-3 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre del proveedor"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Teléfono / WhatsApp"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tiempo de reposición (días)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newLeadTime}
                  onChange={(e) => setNewLeadTime(e.target.value)}
                  placeholder="Ej: 7"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate}><Check className="mr-1 h-3 w-3" /> Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); setNewPhone(""); setNewLeadTime(""); }}>
                  <X className="mr-1 h-3 w-3" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

          <div className="space-y-2">
            {suppliers.map((s) => (
              <div key={s.id} className="border rounded-lg p-3">
                {editingId === s.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nombre"
                    />
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Teléfono"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={editLeadTime}
                      onChange={(e) => setEditLeadTime(e.target.value)}
                      placeholder="Tiempo reposición (días)"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleUpdate(s.id)}>
                        <Check className="mr-1 h-3 w-3" /> Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="mr-1 h-3 w-3" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                      {s.lead_time_days != null && <p className="text-xs text-muted-foreground">Reposición: {s.lead_time_days} días</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => startEdit(s)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!isLoading && suppliers.length === 0 && !adding && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay proveedores registrados</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
