import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CompareProvider } from "@/contexts/CompareContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import UnitDetail from "./pages/UnitDetail";
import Compare from "./pages/Compare";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

// Lazy-load simulator pages - only for authenticated users
const BattleSimulator = lazy(() => import("./pages/BattleSimulator"));
const LiveBattleSimulator = lazy(() => import("./pages/LiveBattleSimulator"));

const queryClient = new QueryClient();

function SimulatorLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <CompareProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/unit/:id" element={<UnitDetail />} />
                  <Route path="/compare/:id1/:id2" element={<Compare />} />
                  <Route 
                    path="/battle/:encounterId" 
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<SimulatorLoader />}>
                          <BattleSimulator />
                        </Suspense>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/live-battle/:encounterId" 
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<SimulatorLoader />}>
                          <LiveBattleSimulator />
                        </Suspense>
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/admin" element={<Admin />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </CompareProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
