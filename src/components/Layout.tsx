import { Outlet, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { MainNav } from "@/components/MainNav";
import { CompareBar } from "@/components/units/CompareBar";
import { cn } from "@/lib/utils";

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main
        className={cn(
          "space-y-6",
          isLanding ? "" : "container mx-auto px-4 py-6",
        )}
      >
        {!isLanding && <MainNav />}
        <Outlet />
      </main>
      {!isLanding && <CompareBar />}
    </div>
  );
}
