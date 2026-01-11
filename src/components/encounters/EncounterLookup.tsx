import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { EncounterViewer } from "./EncounterViewer";
import { getEncounterById, getAllEncounterIds, getEncounterWaves } from "@/lib/encounters";
import { getEncounterIconUrl } from "@/lib/resourceImages";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";

const ITEMS_PER_PAGE = 50;

export function EncounterLookup() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const allEncounters = useMemo(() => {
    const ids = getAllEncounterIds();
    return ids.map(id => {
      const encounter = getEncounterById(id);
      return { id, encounter };
    });
  }, []);
  
  const filteredEncounters = useMemo(() => {
    if (!searchQuery) return allEncounters;
    
    const query = searchQuery.toLowerCase();
    return allEncounters.filter(({ id, encounter }) => {
      const idMatch = id.includes(query);
      const nameMatch = encounter?.name && t(encounter.name).toLowerCase().includes(query);
      return idMatch || nameMatch;
    });
  }, [searchQuery, allEncounters, t]);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery]);

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

  const handleSearch = () => {
    if (searchQuery && getEncounterById(searchQuery)) {
      setSelectedEncounterId(searchQuery);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Find Encounter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="h-[400px] border rounded-md" ref={scrollRef}>
            <div className="p-2 space-y-1">
              {visibleEncounters.map(({ id, encounter }) => {
                const encounterName = encounter?.name ? t(encounter.name) : null;
                const displayName = encounterName && encounterName !== encounter?.name ? encounterName : null;
                const encounterIcon = encounter?.icon;
                const waveCount = encounter ? getEncounterWaves(encounter).length : 0;
                
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
