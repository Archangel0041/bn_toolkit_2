import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ChevronDown, Archive, Sparkles } from "lucide-react";
import { BossStrikeViewer } from "./BossStrikeViewer";
import { getBossStrikeById, getAllCurrentBossStrikeIds, getAllArchivedBossStrikeIds, getBossStrikeName } from "@/lib/bossStrikes";
import { getBossStrikeBackgroundById, getBossStrikeNameById } from "@/lib/bossStrikeImages";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export function BossStrikeLookup() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBossStrikeId, setSelectedBossStrikeId] = useState<string | null>(null);
  const [selectedIsArchived, setSelectedIsArchived] = useState(false);
  const [isGridOpen, setIsGridOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");

  const currentBossStrikes = useMemo(() => {
    const ids = getAllCurrentBossStrikeIds();
    return ids.map(id => {
      const data = getBossStrikeById(id, false)!;
      const encounterName = getBossStrikeName(data);
      return { id, data, encounterName, archived: false };
    });
  }, []);

  const archivedBossStrikes = useMemo(() => {
    const ids = getAllArchivedBossStrikeIds();
    return ids.map(id => {
      const data = getBossStrikeById(id, true)!;
      const encounterName = getBossStrikeName(data);
      return { id, data, encounterName, archived: true };
    });
  }, []);
  
  const filteredCurrentBossStrikes = useMemo(() => {
    if (!searchQuery) return currentBossStrikes;
    const query = searchQuery.toLowerCase();
    return currentBossStrikes.filter(bs => {
      const idMatch = bs.id.includes(query);
      const nameMatch = bs.encounterName && t(bs.encounterName).toLowerCase().includes(query);
      const mappedName = getBossStrikeNameById(bs.id);
      const mappedMatch = mappedName && mappedName.toLowerCase().includes(query);
      return idMatch || nameMatch || mappedMatch;
    });
  }, [searchQuery, currentBossStrikes, t]);

  const filteredArchivedBossStrikes = useMemo(() => {
    if (!searchQuery) return archivedBossStrikes;
    const query = searchQuery.toLowerCase();
    return archivedBossStrikes.filter(bs => {
      const idMatch = bs.id.includes(query);
      const nameMatch = bs.encounterName && t(bs.encounterName).toLowerCase().includes(query);
      const mappedName = getBossStrikeNameById(bs.id);
      const mappedMatch = mappedName && mappedName.toLowerCase().includes(query);
      return idMatch || nameMatch || mappedMatch;
    });
  }, [searchQuery, archivedBossStrikes, t]);

  const selectedBossStrike = selectedBossStrikeId 
    ? getBossStrikeById(selectedBossStrikeId, selectedIsArchived) 
    : null;

  const handleSelectBossStrike = (id: string, archived: boolean) => {
    setSelectedBossStrikeId(id);
    setSelectedIsArchived(archived);
    setIsGridOpen(false);
  };

  const getBackgroundImage = (id: string, archived: boolean): string | undefined => {
    return getBossStrikeBackgroundById(id, archived) || undefined;
  };

  const getDisplayName = (encounterName: string | undefined, id: string, archived: boolean): string => {
    const mappedName = getBossStrikeNameById(id, archived);
    if (mappedName) return mappedName;
    
    if (encounterName) {
      const translated = t(encounterName);
      if (translated !== encounterName) return translated;
    }
    
    return `Boss Strike #${id}`;
  };

  const renderBossStrikeGrid = (bossStrikes: typeof currentBossStrikes) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {bossStrikes.map(({ id, data, encounterName, archived }) => {
        const isSelected = selectedBossStrikeId === id && selectedIsArchived === archived;
        const displayName = getDisplayName(encounterName, id, archived);
        const backgroundUrl = getBackgroundImage(id, archived);
        
        return (
          <Card 
            key={`${archived ? 'archived' : 'current'}-${id}`}
            className={cn(
              "cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary/50",
              isSelected && "ring-2 ring-primary"
            )}
            onClick={() => handleSelectBossStrike(id, archived)}
          >
            <div 
              className="h-28 bg-cover bg-center bg-muted relative"
              style={backgroundUrl ? { 
                backgroundImage: `url(${backgroundUrl})` 
              } : undefined}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <Badge 
                variant="secondary" 
                className="absolute top-2 left-2 text-xs"
              >
                #{id}
              </Badge>
              {data.tier_info && (
                <Badge 
                  variant="outline" 
                  className="absolute top-2 right-2 text-xs bg-background/80"
                >
                  {data.tier_info.length} Tiers
                </Badge>
              )}
            </div>
            <CardContent className="p-3">
              <p className="text-sm font-medium truncate">
                {displayName}
              </p>
            </CardContent>
          </Card>
        );
      })}
      {bossStrikes.length === 0 && (
        <p className="text-muted-foreground text-center py-4 col-span-full">
          No boss strikes found
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Collapsible open={isGridOpen} onOpenChange={setIsGridOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
          <ChevronDown className={cn("h-4 w-4 transition-transform", isGridOpen && "rotate-180")} />
          {isGridOpen ? "Hide" : "Show"} Boss Strikes
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "current" | "archived")}>
            <TabsList className="mb-4">
              <TabsTrigger value="current" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Current ({filteredCurrentBossStrikes.length})
              </TabsTrigger>
              <TabsTrigger value="archived" className="gap-2">
                <Archive className="h-4 w-4" />
                Archived ({filteredArchivedBossStrikes.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="current">
              {renderBossStrikeGrid(filteredCurrentBossStrikes)}
            </TabsContent>
            <TabsContent value="archived">
              {renderBossStrikeGrid(filteredArchivedBossStrikes)}
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>

      {selectedBossStrike && (
        <BossStrikeViewer bossStrike={selectedBossStrike} bossStrikeId={selectedBossStrikeId!} />
      )}
    </div>
  );
}
