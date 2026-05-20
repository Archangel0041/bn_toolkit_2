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
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GameDataProvider, useGameData } from "@/contexts/GameDataContext";
import { isLovableEnvironment } from "@/components/ProtectedRoute";
import { LoadingScreen } from "@/components/LoadingScreen";
import Layout from "@/components/Layout";
import Landing from "./pages/Landing";
import Units from "./pages/Units";
import UnitDetail from "./pages/UnitDetail";
import Compare from "./pages/Compare";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Public lazy pages
const Missions = lazy(() => import("./pages/Missions"));
const Levels = lazy(() => import("./pages/Levels"));

// Protected lazy bundle — only fetched for users who pass the auth gate.
// All protected route paths/components live inside this chunk, NOT in the
// main bundle, so unauthenticated visitors can't discover them by reading
// the downloaded JS.
const ProtectedAppRoutes = lazy(
  () => import("./protected/ProtectedAppRoutes"),
);

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function AppRoutes() {
  const { user, hasAccess } = useAuth();
  const canSeeProtected = isLovableEnvironment() || (!!user && hasAccess);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/units" element={<Units />} />
        <Route
          path="/missions"
          element={
            <Suspense fallback={<PageLoader />}>
              <Missions />
            </Suspense>
          }
        />
        <Route
          path="/levels"
          element={
            <Suspense fallback={<PageLoader />}>
              <Levels />
            </Suspense>
          }
        />
      </Route>

      <Route path="/unit/:id" element={<UnitDetail />} />
      <Route path="/compare/:id1/:id2" element={<Compare />} />
      <Route path="/settings" element={<Settings />} />

      {/* Catch-all: authenticated users get the protected route bundle;
          everyone else gets 404. The literal protected paths never appear
          in the main bundle. */}
      <Route
        path="*"
        element={
          canSeeProtected ? (
            <Suspense fallback={<PageLoader />}>
              <ProtectedAppRoutes />
            </Suspense>
          ) : (
            <NotFound />
          )
        }
      />
    </Routes>
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
              <AppRoutes />
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
