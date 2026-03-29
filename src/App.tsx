import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";
import Stock from "./pages/Stock";
import Products from "./pages/Products";
import Compras from "./pages/Compras";
import POS from "./pages/POS";
import Senas from "./pages/Senas";
import Ventas from "./pages/Ventas";
import CierreDelDia from "./pages/CierreDelDia";
import Finanzas from "./pages/Finanzas";
import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";
import MiCuenta from "./pages/MiCuenta";
import Configuracion from "./pages/Configuracion";
import Clientes from "./pages/Clientes";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/stock" replace />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/products" element={<Products />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/caja" element={<POS />} />
        <Route path="/senas" element={<Senas />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/cierre-del-dia" element={<CierreDelDia />} />
        <Route path="/finanzas" element={<Finanzas />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/mi-cuenta" element={<MiCuenta />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
