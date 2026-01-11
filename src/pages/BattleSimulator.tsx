import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Save, Upload, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { BattleGrid } from "@/components/battle/BattleGrid";
import { AbilitySelector } from "@/components/battle/AbilitySelector";
import { UnitSelector } from "@/components/battle/UnitSelector";
import { PartyManager } from "@/components/battle/PartyManager";
import { TargetingPatternDiagram } from "@/components/battle/TargetingPatternDiagram";
import { UnitInfoPanel } from "@/components/battle/UnitInfoPanel";
import { useParties } from "@/hooks/useParties";
import { useTempFormation } from "@/hooks/useTempFormation";
import { useLanguage } from "@/contexts/LanguageContext";
import { getEncounterById, getEncounterWaves } from "@/lib/encounters";
import { getUnitById } from "@/lib/units";
import { getUnitAbilities, calculateAoeDamagePreviewsForEnemy, calculateAoeDamagePreviewsForFriendly, calculateFixedDamagePreviewsForEnemy, calculateFixedDamagePreviewsForFriendly, calculateDamagePreviewsForEnemy, calculateDamagePreviewsForFriendly } from "@/lib/battleCalculations";
import { getFixedAttackPositions } from "@/types/battleSimulator";
import { getBlockingUnits, findFrontmostUnblockedPosition, getTargetingInfo } from "@/lib/battleTargeting";
import { getStatusEffect, getStatusEffectDisplayName, getStatusEffectColor, getStatusEffectIconUrl } from "@/lib/statusEffects";
import { UnitImage } from "@/components/units/UnitImage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import type { SelectedUnit, AbilityInfo, DamagePreview } from "@/types/battleSimulator";
import { DAMAGE_TYPE_MAP } from "@/types/battleSimulator";

const DAMAGE_TYPE_NAMES: Record<number, string> = {
  1: "Piercing",
  2: "Cold",
  3: "Crushing",
  4: "Explosive",
  5: "Fire",
  6: "Torpedo",
  7: "Depth Charge",
  8: "Melee",
  9: "Projectile",
  10: "Shell",
};

const getDamageTypeName = (type: number): string => {
  return DAMAGE_TYPE_NAMES[type] || `Type ${type}`;
};

const BattleSimulator = () => {
  const { encounterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const {
    parties,
    selectedParty,
    selectedPartyId,
    setSelectedPartyId,
    createParty,
    updateParty,
    removeParty,
    renameParty,
  } = useParties();

  const [currentWave, setCurrentWave] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState<SelectedUnit | null>(null);
  const [selectedAbilityId, setSelectedAbilityId] = useState<number | null>(null);
  const [enemyRankOverrides, setEnemyRankOverrides] = useState<Record<number, number>>({});
  const [enemyReticleGridId, setEnemyReticleGridId] = useState<number>(7);
  const [friendlyReticleGridId, setFriendlyReticleGridId] = useState<number>(7);

  const encounter = encounterId ? getEncounterById(parseInt(encounterId)) : null;
  const waves = encounter ? getEncounterWaves(encounter) : [];
  const currentWaveUnits = waves[currentWave] || [];

  const tempFormation = useTempFormation({ encounter });

  const backPath = (location.state as any)?.from || "/";

  // Get abilities for selected unit
  const selectedUnitAbilities = useMemo<AbilityInfo[]>(() => {
    if (!selectedUnit) return [];
    return getUnitAbilities(selectedUnit.unitId, selectedUnit.rank);
  }, [selectedUnit]);

  // Reset ability selection when unit changes
  useEffect(() => {
    setSelectedAbilityId(null);
  }, [selectedUnit?.unitId, selectedUnit?.gridId]);

  // Get the selected ability with targeting data
  const selectedAbility = useMemo(() => {
    if (!selectedAbilityId) return null;
    return selectedUnitAbilities.find(a => a.abilityId === selectedAbilityId) || null;
  }, [selectedAbilityId, selectedUnitAbilities]);

  // Update default reticle position ONLY when ability or selected unit changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedAbility || !selectedUnit || selectedAbility.isSingleTarget || selectedAbility.isFixed) return;
    
    const blockingUnits = selectedUnit.isEnemy 
      ? getBlockingUnits(tempFormation.units, false)
      : getBlockingUnits(currentWaveUnits, true);
    
    const frontmostPosition = findFrontmostUnblockedPosition(
      selectedUnit.gridId,
      selectedAbility.minRange,
      selectedAbility.maxRange,
      selectedAbility.lineOfFire,
      selectedUnit.isEnemy,
      blockingUnits
    );
    
    if (frontmostPosition !== null) {
      if (selectedUnit.isEnemy) {
        setFriendlyReticleGridId(frontmostPosition);
      } else {
        setEnemyReticleGridId(frontmostPosition);
      }
    }
  }, [selectedAbility?.abilityId, selectedUnit?.gridId, selectedUnit?.isEnemy]);

  // Calculate fixed attack positions based on attacker's grid position
  const fixedAttackPositions = useMemo(() => {
    if (!selectedUnit || !selectedAbility?.isFixed || !selectedAbility.targetArea) {
      return { enemyGrid: [], friendlyGrid: [] };
    }

    const positions = getFixedAttackPositions(
      selectedUnit.gridId,
      selectedAbility.targetArea,
      !selectedUnit.isEnemy, // isAttackerFriendly
      undefined, // No collapsed rows in static simulator
      undefined  // No collapsed rows in static simulator
    );

    // Separate positions by which grid they're on
    const enemyGrid = positions.filter(p => p.isOnEnemyGrid);
    const friendlyGrid = positions.filter(p => !p.isOnEnemyGrid);

    return { enemyGrid, friendlyGrid };
  }, [selectedUnit, selectedAbility]);

  // Get environmental damage modifiers from encounter status effect
  const environmentalDamageMods = useMemo(() => {
    if (!encounter?.environmental_status_effect) return undefined;
    const envEffect = getStatusEffect(encounter.environmental_status_effect);
    return envEffect?.stun_damage_mods;
  }, [encounter?.environmental_status_effect]);

  // Calculate valid reticle positions based on range and line of fire
  const validReticlePositions = useMemo(() => {
    if (!selectedUnit || !selectedAbility || selectedAbility.isSingleTarget || selectedAbility.isFixed) {
      return undefined;
    }
    
    const targetUnits = selectedUnit.isEnemy 
      ? getBlockingUnits(tempFormation.units, false)
      : getBlockingUnits(currentWaveUnits, true);
    
    const targetingInfo = getTargetingInfo(
      selectedUnit.gridId,
      selectedAbility.minRange,
      selectedAbility.maxRange,
      selectedAbility.lineOfFire,
      selectedUnit.isEnemy,
      targetUnits
    );
    
    // Return set of valid grid IDs (in range and not blocked)
    return new Set(
      targetingInfo
        .filter(t => t.inRange && !t.isBlocked)
        .map(t => t.gridId)
    );
  }, [selectedUnit, selectedAbility, tempFormation.units, currentWaveUnits]);

  // Calculate damage previews
  // - Single target: show all valid targets with damage (blocking applies)
  // - Fixed pattern: show damage for all units in pattern
  // - AOE: show damage for units in reticle area
  const damagePreviews = useMemo<DamagePreview[]>(() => {
    if (!selectedUnit || !selectedAbility) return [];

    if (selectedUnit.isEnemy) {
      // Enemy attacking friendly units
      if (selectedAbility.isSingleTarget) {
        // Single target: calculate for ALL friendly units (blocking will filter display)
        return calculateDamagePreviewsForFriendly(selectedAbility, selectedUnit.gridId, tempFormation.units, environmentalDamageMods, true);
      }
      if (selectedAbility.isFixed && fixedAttackPositions.friendlyGrid.length > 0) {
        return calculateFixedDamagePreviewsForFriendly(selectedAbility, selectedUnit.gridId, tempFormation.units, fixedAttackPositions.friendlyGrid, environmentalDamageMods, true);
      }
      return calculateAoeDamagePreviewsForFriendly(selectedAbility, selectedUnit.gridId, tempFormation.units, friendlyReticleGridId, environmentalDamageMods, true);
    } else {
      // Friendly attacking enemy units
      if (selectedAbility.isSingleTarget) {
        // Single target: calculate for ALL enemy units (blocking will filter display)
        return calculateDamagePreviewsForEnemy(selectedAbility, selectedUnit.gridId, currentWaveUnits, enemyRankOverrides, environmentalDamageMods, true);
      }
      if (selectedAbility.isFixed && fixedAttackPositions.enemyGrid.length > 0) {
        return calculateFixedDamagePreviewsForEnemy(selectedAbility, selectedUnit.gridId, currentWaveUnits, fixedAttackPositions.enemyGrid, enemyRankOverrides, environmentalDamageMods, true);
      }
      return calculateAoeDamagePreviewsForEnemy(selectedAbility, selectedUnit.gridId, currentWaveUnits, enemyReticleGridId, enemyRankOverrides, environmentalDamageMods, true);
    }
  }, [selectedUnit, selectedAbility, tempFormation.units, currentWaveUnits, enemyRankOverrides, enemyReticleGridId, friendlyReticleGridId, fixedAttackPositions, environmentalDamageMods]);

  // Handle moving the reticle on enemy grid (only for movable AOE reticles)
  const handleEnemyReticleMove = (gridId: number) => {
    if (selectedAbility && !selectedAbility.isFixed && !selectedAbility.isSingleTarget && !selectedUnit?.isEnemy) {
      setEnemyReticleGridId(gridId);
    }
  };

  // Handle moving the reticle on friendly grid (only for movable AOE reticles)
  const handleFriendlyReticleMove = (gridId: number) => {
    if (selectedAbility && !selectedAbility.isFixed && !selectedAbility.isSingleTarget && selectedUnit?.isEnemy) {
      setFriendlyReticleGridId(gridId);
    }
  };

  const handleUnitClick = (unit: SelectedUnit) => {
    if (selectedUnit?.unitId === unit.unitId && selectedUnit?.gridId === unit.gridId && selectedUnit?.isEnemy === unit.isEnemy) {
      setSelectedUnit(null);
    } else {
      setSelectedUnit(unit);
    }
  };

  const handleEnemyRankChange = (gridId: number, rank: number) => {
    setEnemyRankOverrides(prev => ({ ...prev, [gridId]: rank }));
    if (selectedUnit?.gridId === gridId && selectedUnit?.isEnemy) {
      setSelectedUnit(prev => prev ? { ...prev, rank } : null);
    }
  };

  const handleLoadParty = () => {
    if (selectedParty) {
      tempFormation.loadFromParty(selectedParty.units);
      toast.success(`Loaded party: ${selectedParty.name}`);
    }
  };

  const handleSaveAsParty = () => {
    if (tempFormation.units.length === 0) {
      toast.error("No units to save");
      return;
    }
    const name = prompt("Enter party name:");
    if (name) {
      createParty(name).then((newParty) => {
        // Update the party with temp formation units
        updateParty({
          ...newParty,
          units: [...tempFormation.units],
        });
        toast.success(`Saved party: ${name}`);
      });
    }
  };

  const selectedUnitData = selectedUnit ? getUnitById(selectedUnit.unitId) : null;
  const selectedUnitName = selectedUnitData ? t(selectedUnitData.identity.name) : "";
  const selectedUnitMaxRank = selectedUnitData?.statsConfig?.stats?.length || 1;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Back navigation and title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Battle Simulator</h1>
              {encounter && (
                <p className="text-muted-foreground">
                  {t(encounter.name || `Encounter ${encounterId}`)}
                  <Badge variant="outline" className="ml-2">ID: {encounterId}</Badge>
                  {encounter.level && <Badge variant="secondary" className="ml-2">Lv. {encounter.level}</Badge>}
                </p>
              )}
            </div>
          </div>
          <Button 
            onClick={() => navigate(`/live-battle/${encounterId}`, { 
              state: { 
                from: location.pathname,
                formation: tempFormation.units,
              } 
            })}
            className="gap-2"
          >
            <Swords className="h-4 w-4" />
            Play Battle
          </Button>
        </div>

        {/* Wave selector */}
        {waves.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentWave === 0}
              onClick={() => setCurrentWave(prev => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Wave {currentWave + 1} of {waves.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentWave === waves.length - 1}
              onClick={() => setCurrentWave(prev => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Environmental Status Effect Warning */}
        {encounter?.environmental_status_effect && (() => {
          const envEffect = getStatusEffect(encounter.environmental_status_effect);
          const effectName = getStatusEffectDisplayName(envEffect?.family || 0);
          const effectColor = getStatusEffectColor(envEffect?.family || 0);
          const damageMods = envEffect?.stun_damage_mods || {};
          
          return (
            <div 
              className="flex items-center gap-3 p-3 rounded-lg border"
              style={{ borderColor: effectColor, backgroundColor: `${effectColor}20` }}
            >
              <Flame className="h-5 w-5" style={{ color: effectColor }} />
              <div className="flex-1">
                <span className="font-medium" style={{ color: effectColor }}>
                  Environmental Effect: {effectName}
                </span>
                <div className="text-sm text-muted-foreground">
                  {Object.entries(damageMods).map(([type, mult]) => (
                    <span key={type} className="mr-3">
                      {getDamageTypeName(parseInt(type))}: {Math.round((mult as number) * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Battle grids */}
        <div className="grid gap-4">
          {/* Enemy grid at top - show reticle when FRIENDLY unit is attacking with movable AOE (not single-target or fixed) */}
          <BattleGrid
            isEnemy={true}
            units={currentWaveUnits}
            selectedUnit={selectedUnit}
            onUnitClick={handleUnitClick}
            damagePreviews={!selectedUnit?.isEnemy ? damagePreviews : []}
            rankOverrides={enemyRankOverrides}
            targetArea={selectedAbility?.targetArea}
            damageArea={selectedAbility?.damageArea}
            reticleGridId={enemyReticleGridId}
            onReticleMove={handleEnemyReticleMove}
            showReticle={!!selectedAbility && !selectedAbility.isFixed && !selectedAbility.isSingleTarget && !selectedUnit?.isEnemy}
            fixedAttackPositions={!selectedUnit?.isEnemy ? fixedAttackPositions.enemyGrid : fixedAttackPositions.friendlyGrid}
            validReticlePositions={!selectedUnit?.isEnemy ? validReticlePositions : undefined}
          />

          {/* Divider with selected unit info */}
          <div className="border-y py-4">
            {selectedUnit && selectedUnitData ? (
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Unit Info Panel */}
                <UnitInfoPanel
                  unitId={selectedUnit.unitId}
                  rank={selectedUnit.rank}
                  gridId={selectedUnit.gridId}
                  isEnemy={selectedUnit.isEnemy}
                />
                
                {/* Ability selector */}
                <div className="lg:col-span-2 flex items-center gap-4">
                  <AbilitySelector
                    abilities={selectedUnitAbilities}
                    selectedAbilityId={selectedAbilityId}
                    onSelectAbility={setSelectedAbilityId}
                    className="flex-1"
                  />
                  
                  {/* Pattern diagram for abilities */}
                  {selectedAbility && (
                    <TargetingPatternDiagram 
                      targetArea={selectedAbility.targetArea}
                      lineOfFire={selectedAbility.lineOfFire}
                      attackDirection={selectedAbility.attackDirection}
                      minRange={selectedAbility.minRange}
                      maxRange={selectedAbility.maxRange}
                      isFixed={selectedAbility.isFixed}
                      className="ml-4"
                    />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">
                Click on a unit to see its abilities and damage calculations
              </p>
            )}
          </div>

          {/* Friendly grid at bottom - show reticle when ENEMY unit is attacking with movable AOE (not single-target or fixed) */}
          <BattleGrid
            isEnemy={false}
            units={tempFormation.units}
            selectedUnit={selectedUnit}
            onUnitClick={handleUnitClick}
            damagePreviews={selectedUnit?.isEnemy ? damagePreviews : []}
            onMoveUnit={tempFormation.moveUnit}
            onRemoveUnit={tempFormation.removeUnit}
            onAddUnit={tempFormation.addUnit}
            targetArea={selectedAbility?.targetArea}
            damageArea={selectedAbility?.damageArea}
            reticleGridId={friendlyReticleGridId}
            onReticleMove={handleFriendlyReticleMove}
            showReticle={!!selectedAbility && !selectedAbility.isFixed && !selectedAbility.isSingleTarget && selectedUnit?.isEnemy}
            fixedAttackPositions={selectedUnit?.isEnemy ? fixedAttackPositions.friendlyGrid : []}
            validReticlePositions={selectedUnit?.isEnemy ? validReticlePositions : undefined}
          />
        </div>

        {/* Formation management */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h3 className="text-sm font-medium">Formation</h3>
            
            {/* Party selection and load */}
            <div className="flex items-center gap-2">
              <PartyManager
                parties={parties}
                selectedPartyId={selectedPartyId}
                onSelectParty={setSelectedPartyId}
                onCreateParty={createParty}
                onDeleteParty={removeParty}
                onRenameParty={renameParty}
              />
              {selectedParty && (
                <Button variant="outline" size="sm" onClick={handleLoadParty} className="gap-1">
                  <Upload className="h-3 w-3" />
                  Load
                </Button>
              )}
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSaveAsParty}
              disabled={tempFormation.units.length === 0}
              className="gap-1"
            >
              <Save className="h-3 w-3" />
              Save as Party
            </Button>

            {selectedParty && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  updateParty({
                    ...selectedParty,
                    units: [...tempFormation.units],
                  });
                  toast.success(`Updated party: ${selectedParty.name}`);
                }}
                disabled={tempFormation.units.length === 0}
                className="gap-1"
              >
                <Save className="h-3 w-3" />
                Update Party
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => tempFormation.clearFormation()}
              disabled={tempFormation.units.length === 0}
            >
              Clear
            </Button>
          </div>

          <UnitSelector
            partyUnits={tempFormation.units}
            onAddUnit={(unit) => tempFormation.addUnit(unit.unitId, unit.gridId)}
            onRemoveUnit={tempFormation.removeUnit}
            onUpdateRank={tempFormation.setUnitRank}
            encounter={encounter}
          />
        </div>
      </main>
    </div>
  );
};

export default BattleSimulator;
