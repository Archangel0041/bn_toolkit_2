import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "@/pages/NotFound";

// All paths and page modules referenced here ship inside this chunk —
// not the main bundle — so unauthenticated visitors never download them.
const Valkyries = lazy(() => import("@/pages/Valkyries"));
const Encounters = lazy(() => import("@/pages/Encounters"));
const BossStrikes = lazy(() => import("@/pages/BossStrikes"));
const BattleSimulator = lazy(() => import("@/pages/BattleSimulator"));
const LiveBattleSimulator = lazy(() => import("@/pages/LiveBattleSimulator"));
const CustomFormation = lazy(() => import("@/pages/CustomFormation"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

export default function ProtectedAppRoutes() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/valkyries" element={<Valkyries />} />
            <Route path="/encounters" element={<Encounters />} />
            <Route path="/boss-strikes" element={<BossStrikes />} />
          </Route>
          <Route path="/battle/:encounterId" element={<BattleSimulator />} />
          <Route path="/live-battle/:encounterId" element={<LiveBattleSimulator />} />
          <Route path="/custom-formation" element={<CustomFormation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ProtectedRoute>
  );
}
