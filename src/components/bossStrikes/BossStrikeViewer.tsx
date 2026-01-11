import { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EncounterViewer } from "@/components/encounters/EncounterViewer";
import { getEncounterById, getEncounterWaves } from "@/lib/encounters";
import { formatRewards, getBossStrikeName } from "@/lib/bossStrikes";
import { getUnitById } from "@/lib/units";
import { getEventRewardIconUrl, getEncounterIconUrl } from "@/lib/resourceImages";
import { getBossStrikeBackgroundById, getBossStrikeNameById } from "@/lib/bossStrikeImages";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BossStrike, TierInfo } from "@/types/bossStrike";
import bsPointsIcon from "@/assets/bs_points_icon.png";

interface BossStrikeViewerProps {
  bossStrike: BossStrike;
  bossStrikeId: string | number;
}

export function BossStrikeViewer({ bossStrike, bossStrikeId }: BossStrikeViewerProps) {
  const { t } = useLanguage();
  const location = useLocation();
  const [selectedEncounterId, setSelectedEncounterId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("tiers");
  
  // Back navigation info
  const backPath = location.pathname;
  const backLabel = "Back to Boss Strike";

  const tierCount = bossStrike.tier_info?.length ?? 0;
  const selectedEncounter = selectedEncounterId ? getEncounterById(selectedEncounterId) : null;
  
  const mappedName = getBossStrikeNameById(bossStrikeId);
  const bossStrikeName = getBossStrikeName(bossStrike);
  const encounterDisplayName = bossStrikeName ? t(bossStrikeName) : null;
  
  // Use mapped name first, then encounter name if translated, otherwise generic
  const displayName = mappedName 
    || (encounterDisplayName && encounterDisplayName !== bossStrikeName ? encounterDisplayName : null)
    || `Boss Strike #${bossStrikeId}`;
  
  const backgroundUrl = getBossStrikeBackgroundById(bossStrikeId);

  return (
    <div className="space-y-6">
      {/* Header with background */}
      <Card className="overflow-hidden">
        {backgroundUrl && (
          <div 
            className="h-32 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          />
        )}
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{displayName}</CardTitle>
            <Badge variant="outline">#{bossStrikeId}</Badge>
            {tierCount > 0 && <Badge>{tierCount} Tiers</Badge>}
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tiers">Tier Rewards</TabsTrigger>
          <TabsTrigger value="encounters">Encounters</TabsTrigger>
          <TabsTrigger value="guild">Guild Weights</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="mt-4">
          <TierRewardsSection tierInfo={bossStrike.tier_info} backPath={backPath} backLabel={backLabel} />
        </TabsContent>

        <TabsContent value="encounters" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EncounterListSection 
              tierInfo={bossStrike.tier_info} 
              onSelectEncounter={setSelectedEncounterId}
              selectedEncounterId={selectedEncounterId}
              bossStrike={bossStrike}
            />
            <div>
              {selectedEncounter ? (
                <EncounterViewer 
                  encounter={selectedEncounter} 
                  encounterId={selectedEncounterId!}
                  bossStrike={bossStrike}
                  backPath={backPath}
                  backLabel={backLabel}
                />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Select an encounter to view its grid
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="guild" className="mt-4">
          <GuildWeightsSection guildWeights={bossStrike.guild_weights} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TierRewardsSection({ tierInfo, backPath, backLabel }: { tierInfo?: TierInfo[]; backPath: string; backLabel: string }) {
  const { t } = useLanguage();

  if (!tierInfo || tierInfo.length === 0) {
    return <p className="text-muted-foreground">No tier information available</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tierInfo.map((tier, index) => {
        const rewards = formatRewards(tier.rewards);
        return (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tier {index + 1}</CardTitle>
                <Badge variant="outline">{tier.required_completion_points.toLocaleString()} pts</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {tier.reward_image && (
                <img 
                  src={getEventRewardIconUrl(tier.reward_image)} 
                  alt="Reward"
                  className="w-12 h-12 object-contain mx-auto"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div className="space-y-1">
                {rewards.map((reward, i) => (
                  <RewardItem key={i} reward={reward} t={t} backPath={backPath} backLabel={backLabel} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RewardItem({ reward, t, backPath, backLabel }: { reward: { type: string; key: string; amount: number }; t: (key: string) => string; backPath: string; backLabel: string }) {
  if (reward.type === "unit") {
    const unit = getUnitById(parseInt(reward.key));
    const unitName = unit?.identity?.name ? t(unit.identity.name) : `Unit ${reward.key}`;
    const displayName = unitName !== unit?.identity?.name ? unitName : `Unit ${reward.key}`;
    
    return (
      <div className="flex justify-between text-sm">
        <Link 
          to={`/unit/${reward.key}`}
          state={{ from: backPath, fromLabel: backLabel }}
          className="text-primary hover:underline"
        >
          {displayName}
        </Link>
        <span className="font-medium">×{reward.amount.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between text-sm">
      <span className="capitalize">{reward.key}</span>
      <span className="font-medium">{reward.amount.toLocaleString()}</span>
    </div>
  );
}

function EncounterListSection({ 
  tierInfo, 
  onSelectEncounter,
  selectedEncounterId,
  bossStrike
}: { 
  tierInfo?: TierInfo[]; 
  onSelectEncounter: (id: number) => void;
  selectedEncounterId: number | null;
  bossStrike: BossStrike;
}) {
  const { t } = useLanguage();
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // Get unique level ranges from all tiers
  const levelRanges = useMemo(() => {
    if (!tierInfo || tierInfo.length === 0) return [];
    
    const ranges = new Set<string>();
    tierInfo.forEach(tier => {
      tier.encounters.forEach(enc => {
        const minLevel = enc.min_level ?? 1;
        const key = `${minLevel}-${enc.max_level}`;
        ranges.add(key);
      });
    });
    
    return Array.from(ranges).sort((a, b) => {
      const aMin = parseInt(a.split('-')[0]);
      const bMin = parseInt(b.split('-')[0]);
      return aMin - bMin;
    });
  }, [tierInfo]);

  // Default to level 46-50 if available, otherwise first available
  useMemo(() => {
    if (levelRanges.length > 0 && !selectedLevel) {
      const defaultLevel = levelRanges.find(r => r === "46-50") || levelRanges[levelRanges.length - 1];
      setSelectedLevel(defaultLevel);
    }
  }, [levelRanges, selectedLevel]);

  // Get encounters grouped by tier for selected level, collapsing identical tiers
  const collapsedTierGroups = useMemo(() => {
    if (!tierInfo || !selectedLevel) return [];
    
    // First, get encounters per tier
    const tierEncounters = tierInfo.map((tier, tierIndex) => {
      const encounters = tier.encounters
        .filter(enc => {
          const minLevel = enc.min_level ?? 1;
          const key = `${minLevel}-${enc.max_level}`;
          return key === selectedLevel;
        })
        .map(enc => enc.encounter_id)
        .sort((a, b) => a - b);
      
      return {
        tierIndex: tierIndex + 1,
        encounters,
        encounterKey: encounters.join(','), // Key for comparison
      };
    }).filter(tier => tier.encounters.length > 0);

    // Group consecutive tiers with same encounters
    const groups: { tierRange: string; encounters: number[] }[] = [];
    
    for (const tier of tierEncounters) {
      const lastGroup = groups[groups.length - 1];
      
      if (lastGroup && lastGroup.encounters.join(',') === tier.encounterKey) {
        // Same encounters as previous tier, extend the range
        const [startTier] = lastGroup.tierRange.split('-').map(Number);
        lastGroup.tierRange = `${startTier}-${tier.tierIndex}`;
      } else {
        // New group
        groups.push({
          tierRange: String(tier.tierIndex),
          encounters: tier.encounters,
        });
      }
    }
    
    // Reverse order to show higher tiers first (Tier 6-10 before Tier 1-5)
    return groups.reverse();
  }, [tierInfo, selectedLevel]);

  if (!tierInfo || tierInfo.length === 0) {
    return <p className="text-muted-foreground">No encounters available</p>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Encounters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level Selector */}
        <div className="flex flex-wrap gap-2">
          {levelRanges.map(range => (
            <Badge
              key={range}
              variant={selectedLevel === range ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setSelectedLevel(range)}
            >
              Lv. {range}
            </Badge>
          ))}
        </div>

        {/* Encounter List grouped by Tier */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {collapsedTierGroups.map(({ tierRange, encounters }) => (
              <div key={tierRange} className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                  Tier {tierRange.includes('-') ? tierRange : tierRange}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {encounters.map(encId => {
                    const encounter = getEncounterById(encId);
                    const isSelected = selectedEncounterId === encId;
                    const encounterName = encounter?.name ? t(encounter.name) : null;
                    const displayName = encounterName && encounterName !== encounter?.name ? encounterName : null;
                    const encounterIcon = encounter?.icon;
                    const waveCount = encounter ? getEncounterWaves(encounter).length : 0;

                    return (
                      <Card
                        key={encId}
                        className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${isSelected ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => onSelectEncounter(encId)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            {encounterIcon && (
                              <img 
                                src={getEncounterIconUrl(encounterIcon)}
                                alt=""
                                className="w-10 h-10 object-contain rounded"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            )}
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="font-medium text-sm truncate">
                                {displayName || `Encounter ${encId}`}
                              </p>
                              <div className="flex gap-1 flex-wrap">
                                <Badge variant="outline" className="text-xs">#{encId}</Badge>
                                {encounter?.level && (
                                  <Badge variant="secondary" className="text-xs">Lv. {encounter.level}</Badge>
                                )}
                                {waveCount > 1 && (
                                  <Badge className="text-xs">{waveCount} Waves</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
            {collapsedTierGroups.length === 0 && selectedLevel && (
              <p className="text-muted-foreground text-sm text-center py-4">
                No encounters at this level
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function GuildWeightsSection({ guildWeights }: { guildWeights?: BossStrike["guild_weights"] }) {
  if (!guildWeights || guildWeights.length === 0) {
    return <p className="text-muted-foreground">No guild weight information available</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Guild Size Point Multipliers</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guild Size</TableHead>
                <TableHead className="text-right">Multiplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guildWeights.map((weight, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {weight.min_guild_size === weight.max_guild_size 
                      ? weight.min_guild_size 
                      : `${weight.min_guild_size} - ${weight.max_guild_size}`}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {weight.percent}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export { bsPointsIcon };
