import { useLocation, Link, type LinkProps } from "react-router-dom";
import { Crosshair, Trophy } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PROTECTED_HUB = "/valkyries";

// Route literals live inside this lazy chunk only — never in the main bundle.
const PROTECTED_NAV_ITEMS = [
  { to: "/encounters", label: "Encounters", icon: Crosshair },
  { to: "/boss-strikes", label: "Boss Strikes", icon: Trophy },
];

export function isProtectedTabPath(pathname: string): boolean {
  const seg = "/" + pathname.split("/")[1];
  return PROTECTED_NAV_ITEMS.some((i) => i.to === seg);
}

export function ProtectedNavSelectItems() {
  return (
    <>
      {PROTECTED_NAV_ITEMS.map((item) => {
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
    </>
  );
}

interface Props {
  /** Render only when current route is one of the protected tabs. */
  onlyOnProtectedTab?: boolean;
}

export default function ProtectedNavSlot({ onlyOnProtectedTab = true }: Props) {
  const location = useLocation();
  if (onlyOnProtectedTab && !isProtectedTabPath(location.pathname)) return null;

  return (
    <>
      {PROTECTED_NAV_ITEMS.map((item) => {
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
    </>
  );
}

/**
 * Link wrapper for the protected hub. Used by the Header logo so the
 * "/valkyries" literal lives only in this lazy chunk.
 */
export function ProtectedHomeLink(
  props: Omit<LinkProps, "to"> & { children: React.ReactNode },
) {
  return <Link to={PROTECTED_HUB} {...props} />;
}
