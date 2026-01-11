import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { UnitFilters } from "@/components/units/UnitFilters";
import { UnitGrid } from "@/components/units/UnitGrid";
import { CompareBar } from "@/components/units/CompareBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allUnits, getAllTags, filterUnits } from "@/lib/units";
import { useLanguage } from "@/contexts/LanguageContext";
import { EncounterLookup } from "@/components/encounters/EncounterLookup";
import { BossStrikeLookup } from "@/components/bossStrikes/BossStrikeLookup";
import { Users, Crosshair, Trophy } from "lucide-react";
import { UnitSide } from "@/data/gameEnums";
import { filterUnitsByAdvancedCriteria } from "@/lib/unitAbilityFilters";

const Index = () => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [nanopodFilter, setNanopodFilter] = useState<"all" | "nanopod" | "non-nanopod">("all");
  const [mainTab, setMainTab] = useState("units");
  
  // Advanced filters
  const [targetCategories, setTargetCategories] = useState<number[]>([]);
  const [damageTypes, setDamageTypes] = useState<number[]>([]);
  const [hasStatusEffects, setHasStatusEffects] = useState(false);
  const [vulnerableTo, setVulnerableTo] = useState<number[]>([]);

  const allTags = useMemo(() => getAllTags(), []);

  const filteredUnits = useMemo(() => {
    // Basic filters
    let units = filterUnits(allUnits, searchQuery, selectedTags, null, t);
    
    // Nanopod filter
    if (nanopodFilter === "nanopod") {
      units = units.filter(u => u.requirements?.cost?.nanopods && u.requirements.cost.nanopods > 0);
    } else if (nanopodFilter === "non-nanopod") {
      units = units.filter(u => !u.requirements?.cost?.nanopods || u.requirements.cost.nanopods === 0);
    }
    
    // Advanced ability-based filters
    units = filterUnitsByAdvancedCriteria(units, {
      targetCategories,
      damageTypes,
      hasStatusEffects: hasStatusEffects || undefined,
      vulnerableTo,
    });
    
    return units;
  }, [searchQuery, selectedTags, nanopodFilter, targetCategories, damageTypes, hasStatusEffects, vulnerableTo, t]);

  const unitsBySide = useMemo(() => ({
    player: filteredUnits.filter(u => u.identity.side === UnitSide.Player),
    hostile: filteredUnits.filter(u => u.identity.side === UnitSide.Hostile),
    neutral: filteredUnits.filter(u => u.identity.side === UnitSide.Neutral),
    hero: filteredUnits.filter(u => u.identity.side === UnitSide.Hero),
    villain: filteredUnits.filter(u => u.identity.side === UnitSide.Villain),
    test: filteredUnits.filter(u => u.identity.side === UnitSide.Test),
  }), [filteredUnits]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="units" className="gap-2">
              <Users className="h-4 w-4" />
              Units
            </TabsTrigger>
            <TabsTrigger value="encounters" className="gap-2">
              <Crosshair className="h-4 w-4" />
              Encounters
            </TabsTrigger>
            <TabsTrigger value="boss-strikes" className="gap-2">
              <Trophy className="h-4 w-4" />
              Boss Strikes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Battle Unit Database</h1>
              <p className="text-muted-foreground">
                Browse and explore {allUnits.length} battle units. Click any card to view details.
              </p>
            </div>

            <UnitFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
              allTags={allTags}
              nanopodFilter={nanopodFilter}
              setNanopodFilter={setNanopodFilter}
              targetCategories={targetCategories}
              setTargetCategories={setTargetCategories}
              damageTypes={damageTypes}
              setDamageTypes={setDamageTypes}
              hasStatusEffects={hasStatusEffects}
              setHasStatusEffects={setHasStatusEffects}
              vulnerableTo={vulnerableTo}
              setVulnerableTo={setVulnerableTo}
            />

            <div className="text-sm text-muted-foreground">
              Showing {filteredUnits.length} of {allUnits.length} units
            </div>

            <Tabs defaultValue="player" className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="player">
                  Player ({unitsBySide.player.length})
                </TabsTrigger>
                <TabsTrigger value="hostile">
                  Hostile ({unitsBySide.hostile.length})
                </TabsTrigger>
                {unitsBySide.villain.length > 0 && (
                  <TabsTrigger value="villain">
                    Villain ({unitsBySide.villain.length})
                  </TabsTrigger>
                )}
                {unitsBySide.hero.length > 0 && (
                  <TabsTrigger value="hero">
                    Hero ({unitsBySide.hero.length})
                  </TabsTrigger>
                )}
                {unitsBySide.neutral.length > 0 && (
                  <TabsTrigger value="neutral">
                    Neutral ({unitsBySide.neutral.length})
                  </TabsTrigger>
                )}
                {unitsBySide.test.length > 0 && (
                  <TabsTrigger value="test">
                    Test ({unitsBySide.test.length})
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="player" className="mt-6">
                <UnitGrid units={unitsBySide.player} />
              </TabsContent>
              <TabsContent value="hostile" className="mt-6">
                <UnitGrid units={unitsBySide.hostile} />
              </TabsContent>
              <TabsContent value="villain" className="mt-6">
                <UnitGrid units={unitsBySide.villain} />
              </TabsContent>
              <TabsContent value="hero" className="mt-6">
                <UnitGrid units={unitsBySide.hero} />
              </TabsContent>
              <TabsContent value="neutral" className="mt-6">
                <UnitGrid units={unitsBySide.neutral} />
              </TabsContent>
              <TabsContent value="test" className="mt-6">
                <UnitGrid units={unitsBySide.test} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="encounters" className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Encounter Viewer</h1>
              <p className="text-muted-foreground">
                Search and visualize battle encounters with their unit grids.
              </p>
            </div>
            <EncounterLookup />
          </TabsContent>

          <TabsContent value="boss-strikes" className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Boss Strike Events</h1>
              <p className="text-muted-foreground">
                View boss strike tiers, rewards, encounters, and guild weight scaling.
              </p>
            </div>
            <BossStrikeLookup />
          </TabsContent>
        </Tabs>
      </main>
      <CompareBar />
    </div>
  );
};

export default Index;
