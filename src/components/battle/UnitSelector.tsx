import { useState } from "react";
import { getUnitById } from "@/lib/units";
import { UnitImage } from "@/components/units/UnitImage";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { allUnits } from "@/lib/units";
import { UnitSide } from "@/data/gameEnums";
import type { PartyUnit } from "@/types/battleSimulator";
import type { Encounter } from "@/types/encounters";
import { getNextAvailablePosition } from "@/lib/battleCalculations";
import { getEncounterUnitLimit, getRestrictionMessages } from "@/lib/unitRestrictions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UnitSelectorProps {
  partyUnits: PartyUnit[];
  onAddUnit: (unit: PartyUnit) => { success: boolean; error?: string } | void;
  onRemoveUnit: (gridId: number) => void;
  onUpdateRank: (gridId: number, rank: number) => void;
  encounter?: Encounter | null;
}

export function UnitSelector({
  partyUnits,
  onAddUnit,
  onRemoveUnit,
  onUpdateRank,
  encounter,
}: UnitSelectorProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Filter to only show Player units (side 1)
  const playerUnits = allUnits.filter(u => u.identity.side === UnitSide.Player);
  
  const filteredUnits = playerUnits.filter(unit => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = t(unit.identity.name).toLowerCase();
    const id = unit.id.toString();
    return name.includes(query) || id.includes(query);
  });

  // Get unit limit and restriction messages
  const unitLimit = encounter ? getEncounterUnitLimit(encounter) : 13;
  const restrictionMessages = getRestrictionMessages(encounter, partyUnits, t);

  const handleAddUnit = (unitId: number) => {
    const unit = getUnitById(unitId);
    if (!unit) return;

    const preferredRow = unit.statsConfig?.preferred_row || 1;
    const occupiedPositions = partyUnits.map(u => u.gridId);
    const position = getNextAvailablePosition(preferredRow, occupiedPositions);

    if (position === null) {
      toast.error("Grid is full");
      return;
    }

    const maxRank = unit.statsConfig?.stats?.length || 1;

    const result = onAddUnit({
      unitId,
      gridId: position,
      rank: maxRank,
    });

    // Handle error if the hook returns a result object
    if (result && !result.success && result.error) {
      toast.error(result.error);
      return;
    }

    setIsOpen(false);
    setSearchQuery("");
  };

  // Drag handlers for dragging units from the party list to add to formation
  const handleDragStartFromList = (e: React.DragEvent, unitId: number) => {
    e.dataTransfer.setData("application/x-selector-unit", JSON.stringify({ unitId }));
  };

  // Drop handler for removing units from formation
  const handleDropToRemove = (e: React.DragEvent) => {
    e.preventDefault();
    const formationData = e.dataTransfer.getData("application/x-formation-unit");
    if (formationData) {
      const { gridId } = JSON.parse(formationData);
      onRemoveUnit(gridId);
    }
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Only accept formation units being dragged
    if (e.dataTransfer.types.includes("application/x-formation-unit")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div 
      className={cn(
        "space-y-4 p-4 rounded-lg border-2 border-dashed transition-colors",
        isDragOver ? "border-destructive bg-destructive/10" : "border-transparent"
      )}
      onDrop={handleDropToRemove}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-medium">Party Units</h3>
        <Badge variant="outline" className="text-xs">
          {partyUnits.length}/{unitLimit}
        </Badge>
        {restrictionMessages.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            <span>{restrictionMessages[0]}</span>
          </div>
        )}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Add Unit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Unit to Party</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Search units..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-4"
            />
            <div className="overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredUnits.slice(0, 50).map(unit => (
                <button
                  key={unit.id}
                  onClick={() => handleAddUnit(unit.id)}
                  draggable
                  onDragStart={(e) => handleDragStartFromList(e, unit.id)}
                  className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent transition-colors text-left cursor-grab active:cursor-grabbing"
                >
                  <UnitImage
                    iconName={unit.identity.icon}
                    alt={t(unit.identity.name)}
                    className="w-10 h-10 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">
                      {t(unit.identity.name)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      ID: {unit.id}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {partyUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No units in party. Add units to start simulating battles.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {partyUnits.map(partyUnit => {
            const unit = getUnitById(partyUnit.unitId);
            const maxRank = unit?.statsConfig?.stats?.length || 1;
            const unitName = unit ? t(unit.identity.name) : `Unit ${partyUnit.unitId}`;

            return (
              <div
                key={partyUnit.gridId}
                className="flex items-center gap-2 p-2 rounded-lg border bg-card cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={(e) => handleDragStartFromList(e, partyUnit.unitId)}
              >
                {unit && (
                  <UnitImage
                    iconName={unit.identity.icon}
                    alt={unitName}
                    className="w-10 h-10 rounded"
                  />
                )}
                <div className="text-xs">
                  <p className="font-medium truncate max-w-20">{unitName}</p>
                  <p className="text-muted-foreground">Pos: {partyUnit.gridId}</p>
                </div>
                <Select
                  value={partyUnit.rank.toString()}
                  onValueChange={(val) => onUpdateRank(partyUnit.gridId, parseInt(val))}
                >
                  <SelectTrigger className="w-16 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxRank }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        R{i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRemoveUnit(partyUnit.gridId)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
