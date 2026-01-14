import { useState, useMemo, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, X, Filter, Search, Heart, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllUnits, getUnitById } from "@/lib/units";
import { UnitImage } from "@/components/units/UnitImage";
import { useLanguage } from "@/contexts/LanguageContext";
import { UnitSide, UnitSideLabels, UnitClassLabels } from "@/data/gameEnums";
import type { ParsedUnit } from "@/types/units";

export interface EncounterFilterState {
  searchQuery: string;
  levelRange: [number, number];
  waveCountRange: [number, number];
  containsUnitIds: number[];
  hasMultipleWaves: boolean | null;
}

interface EncounterFiltersProps {
  filters: EncounterFilterState;
  onFiltersChange: (filters: EncounterFilterState) => void;
  maxLevel: number;
  maxWaves: number;
}

export const defaultEncounterFilters: EncounterFilterState = {
  searchQuery: "",
  levelRange: [0, 100],
  waveCountRange: [1, 10],
  containsUnitIds: [],
  hasMultipleWaves: null,
};

export const EncounterFilters = forwardRef<HTMLDivElement, EncounterFiltersProps>(function EncounterFilters({
  filters,
  onFiltersChange,
  maxLevel,
  maxWaves,
}, ref) {
  const { t } = useLanguage();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState("");

  // Get all hostile units for unit filter
  const hostileUnits = useMemo(() => {
    return getAllUnits().filter(u => u.identity.side === UnitSide.Hostile);
  }, []);

  const filteredHostileUnits = useMemo(() => {
    if (!unitSearchQuery) return hostileUnits.slice(0, 50);
    const query = unitSearchQuery.toLowerCase();
    return hostileUnits
      .filter(u => {
        const name = t(u.identity.name).toLowerCase();
        const id = u.id.toString();
        return name.includes(query) || id.includes(query);
      })
      .slice(0, 50);
  }, [hostileUnits, unitSearchQuery, t]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.levelRange[0] > 0 || filters.levelRange[1] < maxLevel) count++;
    if (filters.waveCountRange[0] > 1 || filters.waveCountRange[1] < maxWaves) count++;
    if (filters.containsUnitIds.length > 0) count++;
    if (filters.hasMultipleWaves !== null) count++;
    return count;
  }, [filters, maxLevel, maxWaves]);

  const handleAddUnit = (unitId: number) => {
    if (!filters.containsUnitIds.includes(unitId)) {
      onFiltersChange({
        ...filters,
        containsUnitIds: [...filters.containsUnitIds, unitId],
      });
    }
  };

  const handleRemoveUnit = (unitId: number) => {
    onFiltersChange({
      ...filters,
      containsUnitIds: filters.containsUnitIds.filter(id => id !== unitId),
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      ...defaultEncounterFilters,
      levelRange: [0, maxLevel],
      waveCountRange: [1, maxWaves],
    });
  };

  return (
    <div ref={ref} className="space-y-3">
      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or name..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      {/* Advanced filters */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isAdvancedOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear all
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-3 space-y-4">
          {/* Level Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Level Range</Label>
              <span className="text-xs text-muted-foreground">
                {filters.levelRange[0]} - {filters.levelRange[1]}
              </span>
            </div>
            <Slider
              value={filters.levelRange}
              onValueChange={(value) => onFiltersChange({ 
                ...filters, 
                levelRange: value as [number, number] 
              })}
              min={0}
              max={maxLevel}
              step={1}
              className="w-full"
            />
          </div>

          {/* Wave Count Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Wave Count</Label>
              <span className="text-xs text-muted-foreground">
                {filters.waveCountRange[0]} - {filters.waveCountRange[1]}
              </span>
            </div>
            <Slider
              value={filters.waveCountRange}
              onValueChange={(value) => onFiltersChange({ 
                ...filters, 
                waveCountRange: value as [number, number] 
              })}
              min={1}
              max={maxWaves}
              step={1}
              className="w-full"
            />
          </div>

          {/* Multi-wave filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="multiwave"
                checked={filters.hasMultipleWaves === true}
                onCheckedChange={(checked) => {
                  onFiltersChange({
                    ...filters,
                    hasMultipleWaves: checked ? true : null,
                  });
                }}
              />
              <Label htmlFor="multiwave" className="text-sm cursor-pointer">
                Multi-wave only
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="singlewave"
                checked={filters.hasMultipleWaves === false}
                onCheckedChange={(checked) => {
                  onFiltersChange({
                    ...filters,
                    hasMultipleWaves: checked ? false : null,
                  });
                }}
              />
              <Label htmlFor="singlewave" className="text-sm cursor-pointer">
                Single-wave only
              </Label>
            </div>
          </div>

          {/* Unit filter */}
          <div className="space-y-2">
            <Label className="text-sm">Contains Units</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Search className="h-4 w-4" />
                  Add unit filter...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search units..."
                    value={unitSearchQuery}
                    onChange={(e) => setUnitSearchQuery(e.target.value)}
                    className="h-8"
                  />
                </div>
                <ScrollArea className="h-72">
                  <div className="p-2 space-y-1">
                    {filteredHostileUnits.map(unit => {
                      const stats = unit.statsConfig?.stats;
                      const ranks = stats?.length ?? 0;
                      const maxStats = stats?.[stats.length - 1];
                      const minStats = stats?.[0];
                      const className = UnitClassLabels[unit.identity.class_name] ?? "Unknown";
                      const sideName = UnitSideLabels[unit.identity.side] ?? "Unknown";
                      
                      return (
                        <button
                          key={unit.id}
                          onClick={() => handleAddUnit(unit.id)}
                          disabled={filters.containsUnitIds.includes(unit.id)}
                          className={cn(
                            "flex items-center gap-3 w-full p-2 rounded-md text-left transition-colors",
                            filters.containsUnitIds.includes(unit.id)
                              ? "bg-secondary opacity-50"
                              : "hover:bg-muted"
                          )}
                        >
                          <UnitImage
                            iconName={unit.identity.icon}
                            alt={t(unit.identity.name)}
                            className="w-10 h-10 rounded shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">
                                {t(unit.identity.name)}
                              </p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {className}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="opacity-60">#{unit.id}</span>
                              <span className="opacity-60">•</span>
                              <span>{sideName}</span>
                              {ranks > 1 && (
                                <>
                                  <span className="opacity-60">•</span>
                                  <span>R1-R{ranks}</span>
                                </>
                              )}
                            </div>
                            {maxStats && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="flex items-center gap-0.5 text-red-500">
                                  <Heart className="h-3 w-3" />
                                  {minStats?.hp !== maxStats.hp 
                                    ? `${minStats?.hp ?? maxStats.hp}-${maxStats.hp}`
                                    : maxStats.hp}
                                </span>
                                {maxStats.armor_hp && maxStats.armor_hp > 0 && (
                                  <span className="flex items-center gap-0.5 text-blue-500">
                                    <Shield className="h-3 w-3" />
                                    {maxStats.armor_hp}
                                  </span>
                                )}
                                <span className="flex items-center gap-0.5 text-yellow-500">
                                  <Zap className="h-3 w-3" />
                                  {maxStats.power}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Selected units */}
            {filters.containsUnitIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.containsUnitIds.map(unitId => {
                  const unit = getUnitById(unitId);
                  if (!unit) return null;
                  return (
                    <Badge key={unitId} variant="secondary" className="gap-1 pl-1">
                      <UnitImage
                        iconName={unit.identity.icon}
                        alt=""
                        className="w-4 h-4 rounded"
                      />
                      {t(unit.identity.name)}
                      <button
                        onClick={() => handleRemoveUnit(unitId)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});

EncounterFilters.displayName = "EncounterFilters";