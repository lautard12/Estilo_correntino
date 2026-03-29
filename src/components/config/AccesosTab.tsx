import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

export default function AccesosTab() {
  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Roles del sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge>encargado</Badge>
              <span className="text-muted-foreground">Acceso total: Finanzas, Stock, Ventas, Precios, Usuarios y Configuración.</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">vendedor</Badge>
              <span className="text-muted-foreground">Acceso restringido: solo Caja y Señas.</span>
            </div>
          </div>
          <p className="text-muted-foreground border-t pt-3">
            Solo los usuarios con rol <strong>encargado</strong> pueden ver y editar la Configuración del sistema.
            Para gestionar usuarios y asignar roles, usá la sección <strong>Usuarios</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
