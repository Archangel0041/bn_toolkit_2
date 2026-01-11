import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Swords } from "lucide-react";
import { EncounterGrid } from "./EncounterGrid";
import { getEncounterWaves } from "@/lib/encounters";
import type { Encounter } from "@/types/encounters";
import type { BossStrike } from "@/types/bossStrike";
import { useLanguage } from "@/contexts/LanguageContext";
import bsPointsIcon from "@/assets/bs_points_icon.png";

interface EncounterViewerProps {
  encounter: Encounter;
  encounterId: string | number;
  bossStrike?: BossStrike;
  backPath?: string;
  backLabel?: string;
}

export function EncounterViewer({ encounter, encounterId, bossStrike, backPath, backLabel }: EncounterViewerProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const waves = getEncounterWaves(encounter);
  const [activeWave, setActiveWave] = useState("0");

  const encounterName = encounter.name ? t(encounter.name) : `Encounter ${encounterId}`;
  const displayName = encounterName !== encounter.name ? encounterName : `Encounter ${encounterId}`;

  // Calculate wave points based on boss strike progress cost
  const basePoints = bossStrike?.default_progress_cost?.awarded_points ?? 0;
  const pointsPerWave = basePoints > 0 ? Math.floor(basePoints / waves.length) : 0;

  const handleSimulate = () => {
    navigate(`/battle/${encounterId}`, { 
      state: { from: backPath || location.pathname } 
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">{displayName}</CardTitle>
          <Badge variant="outline">ID: {encounterId}</Badge>
          {encounter.level && <Badge variant="secondary">Lv. {encounter.level}</Badge>}
          {waves.length > 1 && <Badge>{waves.length} Waves</Badge>}
          <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={handleSimulate}>
            <Swords className="h-4 w-4" />
            Simulate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {waves.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No units in this encounter</p>
        ) : waves.length === 1 ? (
          <div className="space-y-3">
            <EncounterGrid 
              units={waves[0]} 
              showPlayerUnits={encounter.player_units}
              backPath={backPath}
              backLabel={backLabel}
            />
            {basePoints > 0 && (
              <WavePointsDisplay 
                waveIndex={0}
                totalWaves={1}
                pointsPerWave={basePoints}
              />
            )}
          </div>
        ) : (
          <Tabs value={activeWave} onValueChange={setActiveWave}>
            <TabsList className="mb-4">
              {waves.map((_, index) => (
                <TabsTrigger key={index} value={String(index)}>
                  Wave {index + 1}
                </TabsTrigger>
              ))}
            </TabsList>
            {waves.map((waveUnits, index) => (
              <TabsContent key={index} value={String(index)}>
                <div className="space-y-3">
                  <EncounterGrid 
                    units={waveUnits} 
                    showPlayerUnits={index === 0 ? encounter.player_units : undefined}
                    backPath={backPath}
                    backLabel={backLabel}
                  />
                  {basePoints > 0 && (
                    <WavePointsDisplay 
                      waveIndex={index}
                      totalWaves={waves.length}
                      pointsPerWave={pointsPerWave}
                    />
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function WavePointsDisplay({ 
  waveIndex, 
  totalWaves, 
  pointsPerWave 
}: { 
  waveIndex: number; 
  totalWaves: number; 
  pointsPerWave: number; 
}) {
  const wavePoints = pointsPerWave;
  const cumulativePoints = (waveIndex + 1) * pointsPerWave;

  return (
    <div className="flex items-center justify-center gap-4 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <img src={bsPointsIcon} alt="BS Points" className="w-6 h-6" />
        <div className="text-sm">
          <span className="text-muted-foreground">Wave {waveIndex + 1}: </span>
          <span className="font-semibold">{wavePoints.toLocaleString()}</span>
        </div>
      </div>
      {totalWaves > 1 && (
        <div className="flex items-center gap-2 border-l pl-4">
          <img src={bsPointsIcon} alt="BS Points" className="w-6 h-6" />
          <div className="text-sm">
            <span className="text-muted-foreground">Total (W1→{waveIndex + 1}): </span>
            <span className="font-semibold text-primary">{cumulativePoints.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
