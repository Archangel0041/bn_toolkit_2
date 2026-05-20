import { EncounterLookup } from "@/components/encounters/EncounterLookup";

export default function Encounters() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Encounter Viewer</h1>
        <p className="text-muted-foreground">
          Search and visualize battle encounters with their unit grids.
        </p>
      </div>
      <EncounterLookup />
    </div>
  );
}
