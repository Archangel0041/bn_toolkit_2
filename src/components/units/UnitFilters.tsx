import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, X, Target, Zap, Flame, Shield } from "lucide-react";
import { TargetCategories, TargetCategoryLabels } from "@/lib/unitAbilityFilters";
import { DamageType, DamageTypeLabels, UnitTagLabels } from "@/data/gameEnums";

interface UnitFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTags: number[];
  setSelectedTags: (tags: number[]) => void;
  allTags: number[];
  nanopodFilter: "all" | "nanopod" | "non-nanopod";
  setNanopodFilter: (filter: "all" | "nanopod" | "non-nanopod") => void;
  // Advanced filters
  targetCategories: number[];
  setTargetCategories: (categories: number[]) => void;
  damageTypes: number[];
  setDamageTypes: (types: number[]) => void;
  hasStatusEffects: boolean;
  setHasStatusEffects: (has: boolean) => void;
  vulnerableTo: number[];
  setVulnerableTo: (types: number[]) => void;
}

const availableDamageTypes = [
  DamageType.Piercing,
  DamageType.Cold,
  DamageType.Crushing,
  DamageType.Explosive,
  DamageType.Fire,
  DamageType.Melee,
  DamageType.Projectile,
  DamageType.Shell,
];

export function UnitFilters({
  searchQuery,
  setSearchQuery,
  selectedTags,
  setSelectedTags,
  allTags,
  nanopodFilter,
  setNanopodFilter,
  targetCategories,
  setTargetCategories,
  damageTypes,
  setDamageTypes,
  hasStatusEffects,
  setHasStatusEffects,
  vulnerableTo,
  setVulnerableTo,
}: UnitFiltersProps) {
  const toggleTag = (tag: number) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const toggleTargetCategory = (category: number) => {
    if (targetCategories.includes(category)) {
      setTargetCategories(targetCategories.filter((c) => c !== category));
    } else {
      setTargetCategories([...targetCategories, category]);
    }
  };

  const toggleDamageType = (dt: number) => {
    if (damageTypes.includes(dt)) {
      setDamageTypes(damageTypes.filter((d) => d !== dt));
    } else {
      setDamageTypes([...damageTypes, dt]);
    }
  };

  const toggleVulnerability = (dt: number) => {
    if (vulnerableTo.includes(dt)) {
      setVulnerableTo(vulnerableTo.filter((d) => d !== dt));
    } else {
      setVulnerableTo([...vulnerableTo, dt]);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setNanopodFilter("all");
    setTargetCategories([]);
    setDamageTypes([]);
    setHasStatusEffects(false);
    setVulnerableTo([]);
  };

  const hasFilters =
    searchQuery ||
    selectedTags.length > 0 ||
    nanopodFilter !== "all" ||
    targetCategories.length > 0 ||
    damageTypes.length > 0 ||
    hasStatusEffects ||
    vulnerableTo.length > 0;

  const advancedFilterCount =
    targetCategories.length +
    damageTypes.length +
    (hasStatusEffects ? 1 : 0) +
    vulnerableTo.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={nanopodFilter} onValueChange={(v) => setNanopodFilter(v as typeof nanopodFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Unit type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            <SelectItem value="nanopod">Nanopod</SelectItem>
            <SelectItem value="non-nanopod">Non-Nanopod</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Tags
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedTags.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-80 overflow-auto" align="end">
            <div className="space-y-2">
              <h4 className="font-medium">Filter by Tags</h4>
              <div className="grid grid-cols-2 gap-2">
                {allTags.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    />
                    {UnitTagLabels[tag] || `Tag ${tag}`}
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Target Categories Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Target className="h-4 w-4" />
              Targets
              {targetCategories.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {targetCategories.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-2">
              <h4 className="font-medium">Can Target</h4>
              <p className="text-xs text-muted-foreground">Units that can attack these types</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TargetCategories).map(([, tagId]) => (
                  <label
                    key={tagId}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={targetCategories.includes(tagId)}
                      onCheckedChange={() => toggleTargetCategory(tagId)}
                    />
                    {TargetCategoryLabels[tagId]}
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Damage Types Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Zap className="h-4 w-4" />
              Damage
              {damageTypes.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {damageTypes.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-2">
              <h4 className="font-medium">Deals Damage Type</h4>
              <p className="text-xs text-muted-foreground">Units with attacks of this type</p>
              <div className="grid grid-cols-2 gap-2">
                {availableDamageTypes.map((dt) => (
                  <label
                    key={dt}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={damageTypes.includes(dt)}
                      onCheckedChange={() => toggleDamageType(dt)}
                    />
                    {DamageTypeLabels[dt]}
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Effects Filter */}
        <Button
          variant={hasStatusEffects ? "default" : "outline"}
          className="gap-2"
          onClick={() => setHasStatusEffects(!hasStatusEffects)}
        >
          <Flame className="h-4 w-4" />
          Has DoT
        </Button>

        {/* Vulnerabilities Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Shield className="h-4 w-4" />
              Weak To
              {vulnerableTo.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {vulnerableTo.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-2">
              <h4 className="font-medium">Vulnerable To</h4>
              <p className="text-xs text-muted-foreground">Units with &lt;100% resistance</p>
              <div className="grid grid-cols-2 gap-2">
                {availableDamageTypes.map((dt) => (
                  <label
                    key={dt}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={vulnerableTo.includes(dt)}
                      onCheckedChange={() => toggleVulnerability(dt)}
                    />
                    {DamageTypeLabels[dt]}
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {(selectedTags.length > 0 || advancedFilterCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge
              key={`tag-${tag}`}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleTag(tag)}
            >
              {UnitTagLabels[tag] || `Tag ${tag}`}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {targetCategories.map((cat) => (
            <Badge
              key={`target-${cat}`}
              variant="outline"
              className="cursor-pointer border-primary/50"
              onClick={() => toggleTargetCategory(cat)}
            >
              Targets: {TargetCategoryLabels[cat]}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {damageTypes.map((dt) => (
            <Badge
              key={`damage-${dt}`}
              variant="outline"
              className="cursor-pointer border-destructive/50"
              onClick={() => toggleDamageType(dt)}
            >
              Deals: {DamageTypeLabels[dt]}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {hasStatusEffects && (
            <Badge
              variant="outline"
              className="cursor-pointer border-orange-500/50"
              onClick={() => setHasStatusEffects(false)}
            >
              Has DoT
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {vulnerableTo.map((dt) => (
            <Badge
              key={`vuln-${dt}`}
              variant="outline"
              className="cursor-pointer border-yellow-500/50"
              onClick={() => toggleVulnerability(dt)}
            >
              Weak: {DamageTypeLabels[dt]}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
