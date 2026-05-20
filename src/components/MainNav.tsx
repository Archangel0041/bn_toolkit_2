import { useLocation, useNavigate } from "react-router-dom";
import { Users, Crosshair, Trophy, Map as MapIcon, TrendingUp } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/units", label: "Units", icon: Users },
  { to: "/encounters", label: "Encounters", icon: Crosshair },
  { to: "/boss-strikes", label: "Boss Strikes", icon: Trophy },
  { to: "/missions", label: "Missions", icon: MapIcon },
  { to: "/levels", label: "Levels", icon: TrendingUp },
];

export function MainNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const current =
    NAV_ITEMS.find(
      (item) => item.to === "/" + location.pathname.split("/")[1],
    )?.to ?? "/units";

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
      </nav>
    </>
  );
}
