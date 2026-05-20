import { lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Users, Map as MapIcon, TrendingUp } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { isLovableEnvironment } from "@/components/ProtectedRoute";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Lazy-loaded so its literal route paths don't ship in the main bundle.
const ProtectedNavSlot = lazy(
  () => import("@/protected/ProtectedNavSlot"),
);
const ProtectedNavSelectItemsLazy = lazy(async () => {
  const mod = await import("@/protected/ProtectedNavSlot");
  return { default: mod.ProtectedNavSelectItems };
});

const NAV_ITEMS = [
  { to: "/units", label: "Units", icon: Users },
  { to: "/missions", label: "Missions", icon: MapIcon },
  { to: "/levels", label: "Levels", icon: TrendingUp },
];

export function MainNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasAccess } = useAuth();
  const canSeeProtected = isLovableEnvironment() || (!!user && hasAccess);

  const firstSeg = "/" + location.pathname.split("/")[1];

  const current =
    NAV_ITEMS.find((item) => item.to === firstSeg)?.to ?? "/units";

  return (
    <>
      {/* Mobile: select picker */}
      <div className="sm:hidden">
        <Select value={current} onValueChange={(value) => navigate(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <SelectItem key={item.to} value={item.to}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </SelectItem>
              );
            })}
            {canSeeProtected && (
              <Suspense fallback={null}>
                <ProtectedNavSelectItemsLazy />
              </Suspense>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: tabs */}
      <nav
        className="hidden sm:inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground flex-wrap gap-1"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all hover:text-foreground",
              )}
              activeClassName="bg-background text-foreground shadow-sm"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
        {canSeeProtected && (
          <Suspense fallback={null}>
            <ProtectedNavSlot />
          </Suspense>
        )}
      </nav>
    </>
  );
}
