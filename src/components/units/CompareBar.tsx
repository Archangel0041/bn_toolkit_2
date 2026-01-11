import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompare } from "@/contexts/CompareContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { X, GitCompare } from "lucide-react";
import { Link } from "react-router-dom";

export function CompareBar() {
  const { compareUnits, removeFromCompare, clearCompare } = useCompare();
  const { t } = useLanguage();

  if (compareUnits.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg p-4 z-50">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Compare:</span>
          {compareUnits.map((unit) => (
            <Badge key={unit.id} variant="secondary" className="gap-1">
              {t(unit.identity.name)}
              <button
                onClick={() => removeFromCompare(unit.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {compareUnits.length < 2 && (
            <span className="text-sm text-muted-foreground">
              Select {2 - compareUnits.length} more unit{compareUnits.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearCompare}>
            Clear
          </Button>
          <Button
            asChild
            size="sm"
            disabled={compareUnits.length !== 2}
            className="gap-2"
          >
            <Link to={`/compare/${compareUnits[0]?.id}/${compareUnits[1]?.id}`}>
              <GitCompare className="h-4 w-4" />
              Compare
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
