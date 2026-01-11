import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getUnitById } from "@/lib/units";
import { useLanguage } from "@/contexts/LanguageContext";
import { UnitImage } from "@/components/units/UnitImage";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skull, Zap, Crosshair, Shuffle, ShieldOff } from "lucide-react";
import { getStatusEffectDisplayName, getStatusEffectColor, getEffectIconUrl } from "@/lib/statusEffects";
import { DamageBreakdown } from "@/components/battle/DamageBreakdown";
import type { LiveBattleUnit } from "@/types/liveBattle";
import type { DamagePreview, TargetArea, DamageAreaPosition, StatusEffectPreview } from "@/types/battleSimulator";
import { ENEMY_GRID_LAYOUT, FRIENDLY_GRID_LAYOUT, GRID_ID_TO_COORDS, COORDS_TO_GRID_ID, getAffectedGridPositions } from "@/types/battleSimulator";

interface LiveBattleGridProps {
  isEnemy: boolean;
  units: LiveBattleUnit[];
  selectedUnitGridId: number | null;
  onUnitClick?: (unit: LiveBattleUnit) => void;
  highlightedGridIds?: Set<number>;
  lastActionGridIds?: { attacker?: number; targets?: number[] };
  // Damage preview support (like BattleGrid)
  damagePreviews?: DamagePreview[];
  // Targeting reticle props
  targetArea?: TargetArea;
  damageArea?: DamageAreaPosition[];
  reticleGridId?: number;
  onReticleMove?: (gridId: number) => void;
  onReticleConfirm?: () => void; // Called when clicking on reticle center to execute attack
  showReticle?: boolean;
  // Fixed attack pattern positions
  fixedAttackPositions?: { gridId: number; damagePercent: number }[];
  // Valid reticle positions based on range/line of fire
  validReticlePositions?: Set<number>;
  // Is this a random attack (all tiles are potential targets)
  isRandomAttack?: boolean;
  // Animation trigger - increments when a new attack happens
  attackAnimationTrigger?: number;
  // Recently dead unit grid IDs for death animation
  recentlyDeadGridIds?: Set<number>;
  // Collapsed rows (rows with no alive units that should be visually hidden)
  collapsedRows?: Set<number>;
}

export function LiveBattleGrid({
  isEnemy,
  units,
  selectedUnitGridId,
  onUnitClick,
  highlightedGridIds,
  lastActionGridIds,
  damagePreviews = [],
  targetArea,
  damageArea,
  reticleGridId,
  onReticleMove,
  onReticleConfirm,
  showReticle = false,
  fixedAttackPositions = [],
  validReticlePositions,
  isRandomAttack = false,
  attackAnimationTrigger = 0,
  recentlyDeadGridIds = new Set(),
  collapsedRows = new Set(),
}: LiveBattleGridProps) {
  const { t } = useLanguage();
  const layout = isEnemy ? ENEMY_GRID_LAYOUT : FRIENDLY_GRID_LAYOUT;
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDraggingReticle, setIsDraggingReticle] = useState(false);
  const [dragOverGridId, setDragOverGridId] = useState<number | null>(null);
  const [animatingTargets, setAnimatingTargets] = useState<Set<number>>(new Set());

  // Trigger attack animation when lastActionGridIds changes
  useEffect(() => {
    if (lastActionGridIds?.targets && lastActionGridIds.targets.length > 0) {
      setAnimatingTargets(new Set(lastActionGridIds.targets));
      // Clear animation after it completes
      const timer = setTimeout(() => {
        setAnimatingTargets(new Set());
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [attackAnimationTrigger]);

  // For movable reticles, calculate affected positions. For fixed attacks, use fixedAttackPositions
  const affectedPositions = fixedAttackPositions.length > 0
    ? fixedAttackPositions
    : (showReticle && reticleGridId !== undefined && targetArea
        ? getAffectedGridPositions(reticleGridId, targetArea, isEnemy, damageArea)
        : []);
  
  const hasTargetingPattern = affectedPositions.length > 0;

  // Keyboard controls for reticle movement
  useEffect(() => {
    if (!showReticle || reticleGridId === undefined || !onReticleMove) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement && document.activeElement !== document.body && 
          !gridRef.current?.contains(document.activeElement)) return;

      const coords = GRID_ID_TO_COORDS[reticleGridId];
      if (!coords) return;

      let newX = coords.x;
      let newY = coords.y;

      switch (e.key) {
        case "ArrowLeft":
          newX = Math.max(0, coords.x - 1);
          break;
        case "ArrowRight":
          newX = Math.min(4, coords.x + 1);
          break;
        case "ArrowUp":
          newY = Math.min(2, coords.y + 1);
          break;
        case "ArrowDown":
          newY = Math.max(0, coords.y - 1);
          break;
        default:
          return;
      }

      const newGridId = COORDS_TO_GRID_ID[`${newX},${newY}`];
      if (newGridId !== undefined && newGridId !== reticleGridId) {
        e.preventDefault();
        onReticleMove(newGridId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showReticle, reticleGridId, onReticleMove]);

  // Reticle drag handlers
  const handleReticleDragStart = (e: React.DragEvent, gridId: number) => {
    if (!showReticle || reticleGridId !== gridId) return;
    e.dataTransfer.setData("application/x-reticle", gridId.toString());
    e.dataTransfer.effectAllowed = "move";
    setIsDraggingReticle(true);
  };

  const handleDragOver = (e: React.DragEvent, gridId: number) => {
    if (!showReticle) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverGridId(gridId);
  };

  const handleDragLeave = () => {
    setDragOverGridId(null);
  };

  const handleDrop = (e: React.DragEvent, targetGridId: number) => {
    if (!showReticle || !onReticleMove) return;
    e.preventDefault();
    onReticleMove(targetGridId);
    setIsDraggingReticle(false);
    setDragOverGridId(null);
  };

  const handleDragEnd = () => {
    setIsDraggingReticle(false);
    setDragOverGridId(null);
  };

  const getDamagePreview = (gridId: number) => {
    return damagePreviews.find(dp => dp.targetGridId === gridId);
  };

  // Calculate remaining HP/Armor range after attack
  const getRemainingRange = (preview: DamagePreview) => {
    const minHpRemaining = Math.max(0, preview.targetHp - preview.maxTotalDamage.hpDamage);
    const maxHpRemaining = Math.max(0, preview.targetHp - preview.minTotalDamage.hpDamage);
    
    let minArmorRemaining = 0;
    let maxArmorRemaining = 0;
    if (preview.targetHasArmor) {
      minArmorRemaining = Math.max(0, preview.targetArmorHp - preview.maxTotalDamage.armorDamage);
      maxArmorRemaining = Math.max(0, preview.targetArmorHp - preview.minTotalDamage.armorDamage);
    }
    
    return { minHpRemaining, maxHpRemaining, minArmorRemaining, maxArmorRemaining };
  };

  const renderSlot = (gridId: number) => {
    const unit = units.find(u => u.gridId === gridId);
    const unitData = unit ? getUnitById(unit.unitId) : null;
    const unitName = unitData ? t(unitData.identity.name) : "";
    const damagePreview = getDamagePreview(gridId);

    const isSelected = selectedUnitGridId === gridId;
    const isHighlighted = highlightedGridIds?.has(gridId);
    const isAttacker = lastActionGridIds?.attacker === gridId;
    const isTarget = lastActionGridIds?.targets?.includes(gridId);
    const isDragOver = dragOverGridId === gridId;
    const isAnimatingAttack = animatingTargets.has(gridId);
    
    // Targeting pattern state
    const affectedPos = affectedPositions.find(p => p.gridId === gridId);
    const isAffectedByPattern = affectedPos !== undefined;
    const isReticleCenter = showReticle && reticleGridId === gridId;
    const isFixedPatternTile = fixedAttackPositions.length > 0 && affectedPos !== undefined;
    const isValidReticleTarget = showReticle && validReticlePositions?.has(gridId) && !isReticleCenter;
    const isInvalidReticleTarget = showReticle && validReticlePositions && !validReticlePositions.has(gridId) && !isReticleCenter;

    const slotSize = "w-16 h-16 sm:w-18 sm:h-18";

    const getDamageLabel = () => {
      if (!affectedPos) return null;
      const hitCount = (affectedPos as any).hitCount;
      if (hitCount && hitCount > 1) {
        return `${affectedPos.damagePercent}% (${hitCount}x)`;
      }
      if (affectedPos.damagePercent === 100) return "Target";
      return `${affectedPos.damagePercent}%`;
    };

    // Check if this unit just died (show death animation)
    const isRecentlyDead = unit?.isDead && recentlyDeadGridIds.has(gridId);

    // Empty slot (or dead unit that finished animating - treat as empty)
    if (!unit || (unit.isDead && !isRecentlyDead)) {
      const handleEmptySlotClick = () => {
        // If clicking on reticle center, execute the attack
        if (isReticleCenter && onReticleConfirm) {
          onReticleConfirm();
          return;
        }
        if (showReticle && onReticleMove) {
          onReticleMove(gridId);
        }
      };

      return (
        <div
          key={gridId}
          draggable={isReticleCenter}
          onClick={handleEmptySlotClick}
          onDragStart={(e) => isReticleCenter && handleReticleDragStart(e, gridId)}
          onDragOver={(e) => handleDragOver(e, gridId)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, gridId)}
          onDragEnd={handleDragEnd}
          className={cn(
            slotSize,
            "border border-dashed border-muted-foreground/20 rounded-md transition-all flex flex-col items-center justify-center relative",
            showReticle && "cursor-pointer hover:bg-yellow-500/10",
            isDragOver && showReticle && "border-yellow-400 bg-yellow-500/20 border-solid",
            isValidReticleTarget && !isAffectedByPattern && "border-green-500/50 border-solid bg-green-500/10",
            isInvalidReticleTarget && "opacity-30",
            isReticleCenter && "border-yellow-500 border-solid border-2 bg-yellow-500/20 cursor-grab",
            showReticle && isAffectedByPattern && !isReticleCenter && "border-orange-500 border-solid bg-orange-500/10",
            isFixedPatternTile && affectedPos?.damagePercent === 100 && "border-red-500 border-solid border-2 bg-red-500/20",
            isFixedPatternTile && affectedPos?.damagePercent !== 100 && "border-orange-500 border-solid bg-orange-500/15",
            isDraggingReticle && isReticleCenter && "opacity-50"
          )}
        >
          {isReticleCenter && (
            <Crosshair className="w-6 h-6 text-yellow-500" />
          )}
          {isAffectedByPattern && (
            <span className={cn(
              "text-[8px] font-bold px-1 rounded-sm",
              affectedPos?.damagePercent === 100 ? "text-red-400" : "text-orange-400"
            )}>
              {getDamageLabel()}
            </span>
          )}
        </div>
      );
    }

    // Recently dead unit - show death animation
    if (isRecentlyDead && unitData) {
      const unitName = t(unitData.identity.name);
      return (
        <div
          key={gridId}
          className={cn(
            slotSize,
            "relative border rounded-md flex items-center justify-center overflow-hidden",
            "bg-muted/20 animate-death-fade"
          )}
        >
          <UnitImage
            iconName={unitData.identity.icon}
            alt={unitName}
            className="w-full h-full object-cover rounded-md grayscale"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 rounded-md">
            <Skull className="h-8 w-8 text-red-400" />
          </div>
        </div>
      );
    }

    // Occupied slot
    const hpPercent = (unit.currentHp / unit.maxHp) * 100;
    const armorPercent = unit.maxArmor > 0 ? (unit.currentArmor / unit.maxArmor) * 100 : 0;

    const handleClick = () => {
      // If clicking on reticle center, execute the attack
      if (isReticleCenter && onReticleConfirm) {
        onReticleConfirm();
        return;
      }
      if (showReticle && onReticleMove) {
        onReticleMove(gridId);
        return;
      }
      if (!unit.isDead && onUnitClick) {
        onUnitClick(unit);
      }
    };

    // Check if we have a valid damage preview for this unit
    const hasValidDamagePreview = damagePreview && damagePreview.canTarget && damagePreview.inRange && !damagePreview.isBlocked;

    const slotContent = (
      <div
        onClick={handleClick}
        draggable={isReticleCenter}
        onDragStart={(e) => isReticleCenter && handleReticleDragStart(e, gridId)}
        onDragOver={(e) => handleDragOver(e, gridId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, gridId)}
        onDragEnd={handleDragEnd}
        className={cn(
          slotSize,
          "relative border rounded-md flex items-center justify-center cursor-pointer transition-all overflow-hidden",
          "bg-muted/20 hover:bg-muted/40",
          isSelected && "ring-2 ring-primary",
          isHighlighted && "ring-2 ring-yellow-500",
          isAttacker && "ring-2 ring-orange-500 animate-pulse",
          isTarget && "ring-2 ring-red-500",
          isAnimatingAttack && "animate-shake animate-flash-red",
          unit.isDead && "opacity-50",
          isReticleCenter && "ring-2 ring-yellow-500 ring-offset-1 cursor-grab",
          showReticle && isAffectedByPattern && !isReticleCenter && "ring-2 ring-orange-500/70",
          isFixedPatternTile && affectedPos?.damagePercent === 100 && "ring-2 ring-red-500 ring-offset-1",
          isFixedPatternTile && affectedPos?.damagePercent !== 100 && "ring-2 ring-orange-500/70",
          isDraggingReticle && isReticleCenter && "opacity-50"
        )}
      >
        {/* Attack flash overlay */}
        {isAnimatingAttack && (
          <div className="absolute inset-0 bg-red-500/40 animate-flash-red pointer-events-none z-20 rounded-md" />
        )}
        
        {/* Crosshair overlay for reticle center */}
        {isReticleCenter && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <Crosshair className="w-8 h-8 text-yellow-500 drop-shadow-lg" />
          </div>
        )}

        <UnitImage
          iconName={unitData.identity.icon}
          alt={unitName}
          className={cn(
            "w-full h-full object-cover rounded-md",
            unit.isDead && "grayscale"
          )}
        />

        {/* Dead overlay */}
        {unit.isDead && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
            <Skull className="h-8 w-8 text-red-500" />
          </div>
        )}

        {/* Targeting pattern label */}
        {isAffectedByPattern && (
          <div className={cn(
            "absolute top-0.5 right-0.5 text-[7px] font-bold bg-black/70 px-1 rounded-sm",
            affectedPos?.damagePercent === 100 ? "text-red-400" : "text-orange-400"
          )}>
            {getDamageLabel()}
          </div>
        )}

        {/* HP/Armor bars - show basic bars when no damage preview or blocked */}
        {!unit.isDead && (!hasValidDamagePreview) && (
          <div className="absolute bottom-0 left-0 right-0 p-0.5 space-y-0.5">
            {unit.maxArmor > 0 && (
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${armorPercent}%` }}
                />
              </div>
            )}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Damage preview bars (like BattleGrid) */}
        {!unit.isDead && hasValidDamagePreview && (() => {
          const { minHpRemaining, maxHpRemaining, minArmorRemaining, maxArmorRemaining } = getRemainingRange(damagePreview);
          
          // Calculate percentages relative to MAX HP/Armor so we can show "already lost" as empty/black
          // Already lost HP (before this attack) = maxHp - currentHp
          const alreadyLostHpPercent = ((unit.maxHp - unit.currentHp) / unit.maxHp) * 100;
          // HP remaining after max damage (green)
          const minHpPercent = (minHpRemaining / unit.maxHp) * 100;
          // HP remaining after min damage (determines orange range)
          const maxHpPercent = (maxHpRemaining / unit.maxHp) * 100;
          // Min guaranteed damage this turn (red) = currentHp after attack if max damage dealt
          const minDamageHpPercent = (Math.max(0, unit.currentHp - damagePreview.maxTotalDamage.hpDamage) / unit.maxHp) * 100;
          // Range between min and max damage (orange) = difference between min damage remaining and after-attack remaining
          const guaranteedDamagePercent = ((unit.currentHp - maxHpRemaining) / unit.maxHp) * 100;
          const rangeDamagePercent = ((maxHpRemaining - minHpRemaining) / unit.maxHp) * 100;
          
          // Same for armor
          let alreadyLostArmorPercent = 0;
          let minArmorRemainingPercent = 0;
          let guaranteedArmorDamagePercent = 0;
          let rangeArmorDamagePercent = 0;
          if (unit.maxArmor > 0) {
            alreadyLostArmorPercent = ((unit.maxArmor - unit.currentArmor) / unit.maxArmor) * 100;
            minArmorRemainingPercent = (minArmorRemaining / unit.maxArmor) * 100;
            guaranteedArmorDamagePercent = ((unit.currentArmor - maxArmorRemaining) / unit.maxArmor) * 100;
            rangeArmorDamagePercent = ((maxArmorRemaining - minArmorRemaining) / unit.maxArmor) * 100;
          }
          
          return (
            <>
              {/* Dodge chance indicator */}
              {damagePreview.dodgeChance > 0 && (
                <div className="absolute top-0.5 left-0.5 text-[8px] font-bold text-yellow-400 bg-black/60 px-1 rounded-sm">
                  {damagePreview.dodgeChance}%
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 p-0.5">
                <div className="space-y-0.5">
                  {/* Armor Bar with damage visualization - order: green (remaining), orange (range), red (guaranteed), black (already lost) */}
                  {unit.maxArmor > 0 && (
                    <div className="h-1.5 w-full bg-black/80 overflow-hidden flex">
                      <div className="h-full bg-sky-500 transition-all" style={{ width: `${minArmorRemainingPercent}%` }} />
                      {rangeArmorDamagePercent > 0 && (
                        <div className="h-full bg-orange-500 transition-all" style={{ width: `${rangeArmorDamagePercent}%` }} />
                      )}
                      {guaranteedArmorDamagePercent > 0 && (
                        <div className="h-full bg-red-500 transition-all" style={{ width: `${guaranteedArmorDamagePercent}%` }} />
                      )}
                      {/* Already lost armor is the remaining space - shown as black background */}
                    </div>
                  )}
                  
                  {/* HP Bar with damage visualization - order: green (remaining), orange (range), red (guaranteed), black (already lost) */}
                  <div className="h-1.5 w-full bg-black/80 overflow-hidden flex">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${minHpPercent}%` }} />
                    {rangeDamagePercent > 0 && (
                      <div className="h-full bg-orange-500 transition-all" style={{ width: `${rangeDamagePercent}%` }} />
                    )}
                    {guaranteedDamagePercent > 0 && (
                      <div className="h-full bg-red-500 transition-all" style={{ width: `${guaranteedDamagePercent}%` }} />
                    )}
                    {/* Already lost HP is the remaining space - shown as black background */}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Status effect indicators */}
        {!unit.isDead && unit.activeStatusEffects.length > 0 && !isAffectedByPattern && (
          <div className="absolute top-0 right-0 flex gap-0.5 p-0.5">
            {unit.activeStatusEffects.slice(0, 3).map((effect, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border border-background"
                style={{ backgroundColor: getStatusEffectColor(effect.effectId) }}
                title={getStatusEffectDisplayName(effect.effectId)}
              />
            ))}
          </div>
        )}

        {/* Stun indicator */}
        {!unit.isDead && unit.activeStatusEffects.some(e => e.isStun) && (
          <div className="absolute top-0 left-0 p-0.5">
            <Zap className="h-4 w-4 text-yellow-400" />
          </div>
        )}

        {/* Cannot target overlay */}
        {damagePreview && (!damagePreview.canTarget || !damagePreview.inRange || damagePreview.isBlocked) && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-xs">
              {!damagePreview.canTarget && "✕"}
              {damagePreview.canTarget && !damagePreview.inRange && "Out of Range"}
              {damagePreview.canTarget && damagePreview.inRange && damagePreview.isBlocked && "Blocked"}
            </span>
          </div>
        )}
      </div>
    );

    // Wrap with tooltip for detailed info
    return (
      <TooltipProvider key={gridId}>
        <Tooltip>
          <TooltipTrigger asChild>
            {slotContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <div className="space-y-1.5">
              <p className="font-semibold">{unitName}</p>
              
              {/* Current HP/Armor */}
              <div className="text-sm">
                <span>HP: {unit.currentHp}/{unit.maxHp}</span>
                {unit.maxArmor > 0 && <span> | Armor: {unit.currentArmor}/{unit.maxArmor}</span>}
              </div>
              
              {/* Active Status Effects */}
              {unit.activeStatusEffects.length > 0 && (
                <div className="border-t pt-1.5 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Active Effects:</span>
                  {unit.activeStatusEffects.map((effect, i) => {
                    const iconUrl = getEffectIconUrl(effect.effectId);
                    const effectColor = getStatusEffectColor(effect.effectId);
                    const effectName = getStatusEffectDisplayName(effect.effectId);
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {iconUrl && <img src={iconUrl} alt="" className="w-3 h-3" />}
                        <span 
                          className="font-medium"
                          style={{ color: effectColor }}
                        >
                          {effectName}
                        </span>
                        <span className="text-muted-foreground">
                          {effect.remainingDuration}t left
                          {effect.dotDamage > 0 && ` | ${effect.dotDamage} dmg/t`}
                        </span>
                        {effect.isStun && (
                          <Zap className="h-3 w-3 text-yellow-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Damage preview with detailed info */}
              {hasValidDamagePreview && (
                <div className="text-sm border-t pt-1.5 space-y-1">
                  {/* HP After Attack */}
                  <div className="grid grid-cols-2 gap-x-4 text-xs">
                    <span className="text-muted-foreground">Initial HP:</span>
                    <span>{unit.currentHp}</span>
                    <span className="text-muted-foreground">After Attack:</span>
                    <span className="text-emerald-500">
                      {Math.max(0, unit.currentHp - damagePreview.maxTotalDamage.hpDamage)}-
                      {Math.max(0, unit.currentHp - damagePreview.minTotalDamage.hpDamage)}
                    </span>
                  </div>
                  
                  {/* Armor After Attack (if applicable) */}
                  {damagePreview.targetHasArmor && (
                    <div className="grid grid-cols-2 gap-x-4 text-xs">
                      <span className="text-muted-foreground">Initial Armor:</span>
                      <span>{unit.currentArmor}</span>
                      <span className="text-muted-foreground">After Attack:</span>
                      <span className="text-sky-400">
                        {Math.max(0, unit.currentArmor - damagePreview.maxTotalDamage.armorDamage)}-
                        {Math.max(0, unit.currentArmor - damagePreview.minTotalDamage.armorDamage)}
                      </span>
                    </div>
                  )}
                  
                  {/* Damage breakdown */}
                  <div className="grid grid-cols-2 gap-x-4 text-xs">
                    <span className="text-muted-foreground">
                      Damage{damagePreview.isRandomAttack 
                        ? ` (~${damagePreview.expectedHits?.toFixed(1)} hits)` 
                        : damagePreview.totalShots > 1 
                          ? ` (${damagePreview.totalShots} hits)` 
                          : ''}:
                    </span>
                    <span className="text-destructive font-medium">
                      {damagePreview.minTotalDamage.hpDamage}-{damagePreview.maxTotalDamage.hpDamage} HP
                    </span>
                    {damagePreview.targetHasArmor && (
                      <>
                        <span className="text-muted-foreground">Armor Damage:</span>
                        <span className="text-sky-400">
                          {damagePreview.minTotalDamage.armorDamage}-{damagePreview.maxTotalDamage.armorDamage}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Dodge/Crit */}
                  <div className="flex gap-4 text-xs">
                    <span>Dodge: <span className={cn(damagePreview.dodgeChance > 0 && "text-yellow-500")}>{damagePreview.dodgeChance}%</span></span>
                    <span>Crit: <span className={cn(damagePreview.critChance > 0 && "text-orange-500")}>{damagePreview.critChance}%</span></span>
                  </div>
                  
                  {/* Status Effects */}
                  {damagePreview.statusEffects && damagePreview.statusEffects.length > 0 && (
                    <div className="border-t pt-1 space-y-0.5">
                      <span className="text-xs text-muted-foreground font-medium">Status Effects:</span>
                      {damagePreview.statusEffects.map((effect, i) => {
                        const iconUrl = getEffectIconUrl(effect.effectId);
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {iconUrl && <img src={iconUrl} alt="" className="w-3 h-3" />}
                            <span
                              className="font-medium"
                              style={{ color: effect.color }}
                            >
                              {effect.name}
                            </span>
                            <span className="text-muted-foreground">
                              {effect.chance}% | {effect.duration}t
                              {effect.dotDamage > 0 && ` | ${effect.dotDamage} dmg/t`}
                            </span>
                            {effect.isImmune && (
                              <span className="flex items-center gap-0.5 text-red-400">
                                <ShieldOff className="h-3 w-3" /> Immune
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Damage Breakdown - Show for max damage with breakdown */}
                  {damagePreview.maxDamage.breakdown && (
                    <DamageBreakdown
                      damageResult={damagePreview.maxDamage}
                      damageType={damagePreview.damageType}
                      label="Max Damage Breakdown"
                    />
                  )}
                </div>
              )}
              
              {/* Active Status Effects */}
              {unit.activeStatusEffects.length > 0 && (
                <div className="text-sm border-t pt-1">
                  <span className="text-xs text-muted-foreground">Active Effects:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {unit.activeStatusEffects.map((effect, i) => (
                      <span 
                        key={i} 
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ 
                          backgroundColor: `${getStatusEffectColor(effect.effectId)}20`,
                          color: getStatusEffectColor(effect.effectId)
                        }}
                      >
                        {getStatusEffectDisplayName(effect.effectId)} ({effect.remainingDuration}t)
                        {effect.dotDamage > 0 && ` - ${effect.dotDamage} dmg`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Status Effect Immunities */}
              {unitData && unitData.statsConfig?.status_effect_immunities && unitData.statsConfig.status_effect_immunities.length > 0 && (
                <div className="text-sm border-t pt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldOff className="h-3 w-3" /> Immunities:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {unitData.statsConfig.status_effect_immunities.map((immunity, i) => (
                      <span 
                        key={i} 
                        className="text-xs px-1.5 py-0.5 rounded bg-muted"
                        style={{ color: getStatusEffectColor(immunity) }}
                      >
                        {getStatusEffectDisplayName(immunity)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Weapon Cooldowns */}
              {Object.entries(unit.weaponGlobalCooldown).some(([_, cd]) => cd > 0) && (
                <p className="text-xs text-muted-foreground">
                  Weapon Cooldowns: {Object.entries(unit.weaponGlobalCooldown).filter(([_, cd]) => cd > 0).map(([name, cd]) => `${name}: ${cd}`).join(', ')}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <TooltipProvider>
      <div 
        ref={gridRef}
        tabIndex={showReticle ? 0 : undefined}
        className={cn(
          "flex flex-col items-center gap-2 p-4 rounded-lg outline-none",
          isEnemy ? "bg-destructive/5" : "bg-primary/5",
          showReticle && "focus:ring-2 focus:ring-yellow-500/50",
          isRandomAttack && isEnemy && "ring-2 ring-purple-500/50 ring-inset"
        )}
      >
        <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          {isEnemy ? "Enemy Formation" : "Your Formation"}
          {isRandomAttack && isEnemy && (
            <span className="flex items-center gap-1 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
              <Shuffle className="h-3 w-3" />
              Random Target
            </span>
          )}
        </div>
        
        {isEnemy ? (
          <>
            {/* Row 3 (back row for enemies, displayed at top) - hide if collapsed */}
            {!collapsedRows.has(2) && (
              <div className="flex gap-1 justify-center">
                {layout.ROW_3.map(gridId => renderSlot(gridId))}
              </div>
            )}
            {/* Row 2 (middle row) - hide if collapsed */}
            {!collapsedRows.has(1) && (
              <div className="flex gap-1">
                {layout.ROW_2.map(gridId => renderSlot(gridId))}
              </div>
            )}
            {/* Row 1 (front row for enemies, displayed at bottom) - hide if collapsed */}
            {!collapsedRows.has(0) && (
              <div className="flex gap-1">
                {layout.ROW_1.map(gridId => renderSlot(gridId))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Row 1 (front row for friendlies, displayed at top) - hide if collapsed */}
            {!collapsedRows.has(0) && (
              <div className="flex gap-1">
                {layout.ROW_1.map(gridId => renderSlot(gridId))}
              </div>
            )}
            {/* Row 2 (middle row) - hide if collapsed */}
            {!collapsedRows.has(1) && (
              <div className="flex gap-1">
                {layout.ROW_2.map(gridId => renderSlot(gridId))}
              </div>
            )}
            {/* Row 3 (back row for friendlies, displayed at bottom) - hide if collapsed */}
            {!collapsedRows.has(2) && (
              <div className="flex gap-1 justify-center">
                {layout.ROW_3.map(gridId => renderSlot(gridId))}
              </div>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
