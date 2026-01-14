import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EncounterViewer } from "./EncounterViewer";
import { EncounterFilters, EncounterFilterState, defaultEncounterFilters } from "./EncounterFilters";
import { getEncounterById, getAllEncounterIds, getEncounterWaves } from "@/lib/encounters";
import { getEncounterIconUrl } from "@/lib/resourceImages";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Play, Plus } from "lucide-react";

const ITEMS_PER_PAGE = 50;

export function EncounterLookup() {
  const { t } = useLanguage();
  const { user, hasAccess } = useAuth();
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Calculate max values for filter ranges
  const { allEncounters, maxLevel, maxWaves } = useMemo(() => {
    const ids = getAllEncounterIds();
    let maxLvl = 0;
    let maxWv = 1;
    
    const encounters = ids.map(id => {
      const encounter = getEncounterById(id);
      const waveCount = encounter ? getEncounterWaves(encounter).length : 0;
      
      if (encounter?.level && encounter.level > maxLvl) maxLvl = encounter.level;
      if (waveCount > maxWv) maxWv = waveCount;
      
      return { id, encounter, waveCount };
    });
    
    return { allEncounters: encounters, maxLevel: maxLvl, maxWaves: maxWv };
  }, []);

  // Initialize filters with calculated max values
  const [filters, setFilters] = useState<EncounterFilterState>(() => ({
    ...defaultEncounterFilters,
    levelRange: [0, maxLevel],
    waveCountRange: [1, maxWaves],
  }));

  // Update filter ranges when data changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      levelRange: [prev.levelRange[0], Math.max(prev.levelRange[1], maxLevel)],
      waveCountRange: [prev.waveCountRange[0], Math.max(prev.waveCountRange[1], maxWaves)],
    }));
  }, [maxLevel, maxWaves]);
  
  const filteredEncounters = useMemo(() => {
    return allEncounters.filter(({ id, encounter, waveCount }) => {
      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const idMatch = id.includes(query);
        const nameMatch = encounter?.name && t(encounter.name).toLowerCase().includes(query);
        if (!idMatch && !nameMatch) return false;
      }
      
      // Level range filter
      const level = encounter?.level || 0;
      if (level < filters.levelRange[0] || level > filters.levelRange[1]) return false;
      
      // Wave count filter
      const waves = waveCount || 1;
      if (waves < filters.waveCountRange[0] || waves > filters.waveCountRange[1]) return false;
      
      // Multi-wave filter
      if (filters.hasMultipleWaves === true && waves <= 1) return false;
      if (filters.hasMultipleWaves === false && waves > 1) return false;
      
      // Unit filter - check if encounter contains any of the selected units
      if (filters.containsUnitIds.length > 0 && encounter) {
        const encounterUnitIds = new Set(
          (encounter.units || []).map(u => u.unit_id)
        );
        const hasAnyUnit = filters.containsUnitIds.some(id => encounterUnitIds.has(id));
        if (!hasAnyUnit) return false;
      }
      
      return true;
    });
  }, [filters, allEncounters, t]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [filters]);

  const visibleEncounters = useMemo(() => {
    return filteredEncounters.slice(0, visibleCount);
  }, [filteredEncounters, visibleCount]);

  const hasMore = visibleCount < filteredEncounters.length;

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredEncounters.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, filteredEncounters.length]);

  const selectedEncounter = selectedEncounterId ? getEncounterById(selectedEncounterId) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Find Encounter</CardTitle>
            {user && hasAccess && (
              <Link to="/custom-formation">
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Custom Formation
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <EncounterFilters
            filters={filters}
            onFiltersChange={setFilters}
            maxLevel={maxLevel}
            maxWaves={maxWaves}
          />
          
          <div className="text-xs text-muted-foreground">
            Showing {Math.min(visibleCount, filteredEncounters.length)} of {filteredEncounters.length} encounters
          </div>
          
          <ScrollArea className="h-[400px] border rounded-md" ref={scrollRef}>
            <div className="p-2 space-y-1">
              {visibleEncounters.map(({ id, encounter, waveCount }) => {
                const encounterName = encounter?.name ? t(encounter.name) : null;
                const displayName = encounterName && encounterName !== encounter?.name ? encounterName : null;
                const encounterIcon = encounter?.icon;
                
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                      selectedEncounterId === id ? "bg-secondary" : "hover:bg-muted"
                    )}
                    onClick={() => setSelectedEncounterId(id)}
                  >
                    {encounterIcon && (
                      <img 
                        src={getEncounterIconUrl(encounterIcon)}
                        alt=""
                        className="w-8 h-8 object-contain rounded shrink-0"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName || `Encounter ${id}`}</p>
                      <div className="flex gap-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">#{id}</Badge>
                        {encounter?.level && (
                          <Badge variant="secondary" className="text-xs">Lv. {encounter.level}</Badge>
                        )}
                        {waveCount > 1 && (
                          <Badge className="text-xs">{waveCount} Waves</Badge>
                        )}
                      </div>
                    </div>
                    {user && hasAccess && (
                      <Link
                        to={`/battle/${id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Play className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
              
              {/* Infinite scroll trigger */}
              {hasMore && (
                <div ref={loadMoreRef} className="py-4 text-center">
                  <span className="text-muted-foreground text-xs">
                    Loading more... ({visibleCount} of {filteredEncounters.length})
                  </span>
                </div>
              )}
              
              {visibleEncounters.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No encounters found</p>
              )}
              
              {!hasMore && filteredEncounters.length > ITEMS_PER_PAGE && (
                <p className="text-muted-foreground text-center text-xs py-2">
                  Showing all {filteredEncounters.length} encounters
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div>
        {selectedEncounter ? (
          <EncounterViewer encounter={selectedEncounter} encounterId={selectedEncounterId!} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select an encounter to view its grid layout
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}