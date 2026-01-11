import { UnitCard } from "./UnitCard";
import type { ParsedUnit } from "@/types/units";

interface UnitGridProps {
  units: ParsedUnit[];
}

export function UnitGrid({ units }: UnitGridProps) {
  if (units.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No units found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {units.map((unit) => (
        <UnitCard key={unit.id} unit={unit} />
      ))}
    </div>
  );
}
