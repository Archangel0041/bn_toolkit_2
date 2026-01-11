import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CompareProvider } from "@/contexts/CompareContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import UnitDetail from "./pages/UnitDetail";
import Compare from "./pages/Compare";
import BattleSimulator from "./pages/BattleSimulator";
import LiveBattleSimulator from "./pages/LiveBattleSimulator";
import UploadImages from "./pages/UploadImages";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
                  <Route path="/battle/:encounterId" element={<BattleSimulator />} />
                  <Route path="/live-battle/:encounterId" element={<LiveBattleSimulator />} />
                  <Route path="/upload" element={<UploadImages />} />
                  <Route path="/auth" element={<Auth />} />
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
