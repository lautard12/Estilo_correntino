import { Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import CatalogoTab from "@/components/config/CatalogoTab";
import PreciosTab from "@/components/config/PreciosTab";
import AccesosTab from "@/components/config/AccesosTab";
import OfertasTab from "@/components/config/OfertasTab";

export default function Configuracion() {
  const { isEncargado } = useAuth();

  if (!isEncargado) {
    return <div className="p-6 text-muted-foreground">No tenés permisos para acceder a esta sección.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Configuración</h1>
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="precios">Precios y Cobros</TabsTrigger>
          <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
          <TabsTrigger value="accesos">Accesos</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo">
          <CatalogoTab />
        </TabsContent>

        <TabsContent value="precios">
          <PreciosTab />
        </TabsContent>

        <TabsContent value="ofertas">
          <OfertasTab />
        </TabsContent>

        <TabsContent value="accesos">
          <AccesosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
