import { lazy, Suspense, useEffect } from "react";
import { prewarmStaticIcons } from "@/lib/assetCache";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CompareProvider } from "@/contexts/CompareContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { GameDataProvider, useGameData } from "@/contexts/GameDataContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoadingScreen } from "@/components/LoadingScreen";
import Layout from "@/components/Layout";
import Units from "./pages/Units";
import UnitDetail from "./pages/UnitDetail";
import Compare from "./pages/Compare";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Lazy-load tab pages
const Encounters = lazy(() => import("./pages/Encounters"));
const BossStrikes = lazy(() => import("./pages/BossStrikes"));
const Missions = lazy(() => import("./pages/Missions"));
const Levels = lazy(() => import("./pages/Levels"));

// Lazy-load custom formation page
const CustomFormation = lazy(() => import("./pages/CustomFormation"));

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

// Inner app that requires game data to be loaded
function AppContent() {
  const { isLoading, loadProgress, error } = useGameData();

  useEffect(() => {
    if (!isLoading && !error) prewarmStaticIcons();
  }, [isLoading, error]);

  if (isLoading) {
    return <LoadingScreen progress={loadProgress} message="Loading game data..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-destructive">Failed to load game data</h2>
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
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
                <Route path="/settings" element={<Settings />} />
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
                <Route 
                  path="/custom-formation" 
                  element={
                    <Suspense fallback={<SimulatorLoader />}>
                      <CustomFormation />
                    </Suspense>
                  } 
                />
                

                {/* <Route path="/timeline-preview" element={<Suspense fallback={<SimulatorLoader />}><TimelinePreview /></Suspense>} /> */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </CompareProvider>
    </LanguageProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <GameDataProvider>
        <AppContent />
      </GameDataProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
