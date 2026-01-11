import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { getUnitById } from "@/lib/units";
import { UnitImage } from "@/components/units/UnitImage";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Crosshair } from "lucide-react";
import type { EncounterUnit } from "@/types/encounters";
import type { PartyUnit, DamagePreview, SelectedUnit, TargetArea, DamageAreaPosition } from "@/types/battleSimulator";
import { ENEMY_GRID_LAYOUT, FRIENDLY_GRID_LAYOUT, GRID_ID_TO_COORDS, COORDS_TO_GRID_ID, getAffectedGridPositions } from "@/types/battleSimulator";
import { DamageBreakdown } from "@/components/battle/DamageBreakdown";

interface BattleGridProps {
  isEnemy: boolean;
  units: EncounterUnit[] | PartyUnit[];
  selectedUnit: SelectedUnit | null;
  onUnitClick: (unit: SelectedUnit) => void;
  damagePreviews?: DamagePreview[];
  rankOverrides?: Record<number, number>;
  onMoveUnit?: (fromGridId: number, toGridId: number) => void;
  onRemoveUnit?: (gridId: number) => void;
  onAddUnit?: (unitId: number, gridId: number) => void;
  // Targeting reticle props - only shows when this grid is the TARGET side
  targetArea?: TargetArea;
  damageArea?: DamageAreaPosition[]; // Splash damage pattern for overlapping calculation
  reticleGridId?: number;
  onReticleMove?: (gridId: number) => void;
  showReticle?: boolean; // Whether to show the movable reticle on this grid
  // Fixed attack pattern positions (pre-calculated based on attacker position)
  fixedAttackPositions?: { gridId: number; damagePercent: number }[];
  // Valid reticle positions based on range/line of fire
  validReticlePositions?: Set<number>;
}

const DAMAGE_TYPE_NAMES: Record<number, string> = {
  1: "Piercing",
  2: "Explosive",
  3: "Fire",
  4: "Cold",
  5: "Crushing",
  6: "Poison",
};

export function BattleGrid({
  isEnemy,
  units,
  selectedUnit,
  onUnitClick,
  damagePreviews = [],
  rankOverrides = {},
  onMoveUnit,
  onRemoveUnit,
  onAddUnit,
  targetArea,
  damageArea,
  reticleGridId,
  onReticleMove,
  showReticle = false,
  fixedAttackPositions = [],
  validReticlePositions,
}: BattleGridProps) {
  const { t } = useLanguage();
  const layout = isEnemy ? ENEMY_GRID_LAYOUT : FRIENDLY_GRID_LAYOUT;
  const gridRef = useRef<HTMLDivElement>(null);
  const [draggedGridId, setDraggedGridId] = useState<number | null>(null);
  const [dragOverGridId, setDragOverGridId] = useState<number | null>(null);
  const [isDraggingReticle, setIsDraggingReticle] = useState(false);

  // For movable reticles, calculate affected positions. For fixed attacks, use fixedAttackPositions
  const affectedPositions = fixedAttackPositions.length > 0
    ? fixedAttackPositions
    : (showReticle && reticleGridId !== undefined && targetArea
        ? getAffectedGridPositions(reticleGridId, targetArea, isEnemy, damageArea)
        : []);
  
  // Whether we're showing any targeting pattern (movable or fixed)
  const hasTargetingPattern = affectedPositions.length > 0;

  // Keyboard controls for reticle movement
  useEffect(() => {
    if (!showReticle || reticleGridId === undefined || !onReticleMove) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this grid is focused or no specific element is focused
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
          // Up moves toward back row (higher y)
          newY = Math.min(2, coords.y + 1);
          break;
        case "ArrowDown":
          // Down moves toward front row (lower y)
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

  // Drag handlers for reticle
  const handleReticleDragStart = (e: React.DragEvent, gridId: number) => {
    if (!showReticle || reticleGridId !== gridId) return;
    e.dataTransfer.setData("application/x-reticle", gridId.toString());
    e.dataTransfer.effectAllowed = "move";
    setIsDraggingReticle(true);
  };

  const handleReticleDragOver = (e: React.DragEvent, gridId: number) => {
    if (!showReticle) return;
    // Check if we're dragging a reticle
    if (e.dataTransfer.types.includes("application/x-reticle")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverGridId(gridId);
    }
  };

  const handleReticleDrop = (e: React.DragEvent, targetGridId: number) => {
    if (!showReticle) return;
    const reticleData = e.dataTransfer.getData("application/x-reticle");
    if (reticleData && onReticleMove) {
      e.preventDefault();
      e.stopPropagation();
      onReticleMove(targetGridId);
      setIsDraggingReticle(false);
      setDragOverGridId(null);
      return true;
    }
    return false;
  };

  const handleReticleDragEnd = () => {
    setIsDraggingReticle(false);
    setDragOverGridId(null);
  };
  const getUnitAtPosition = (gridId: number) => {
    if (isEnemy) {
      return (units as EncounterUnit[]).find(u => u.grid_id === gridId);
    }
    return (units as PartyUnit[]).find(u => u.gridId === gridId);
  };

  const getDamagePreview = (gridId: number) => {
    return damagePreviews.find(dp => dp.targetGridId === gridId);
  };

  const handleDragStart = (e: React.DragEvent, gridId: number, unitId: number) => {
    // If reticle is showing, don't allow unit drag
    if (showReticle) return;
    if (isEnemy) return;
    e.dataTransfer.setData("text/plain", gridId.toString());
    e.dataTransfer.setData("application/x-formation-unit", JSON.stringify({ gridId, unitId }));
    setDraggedGridId(gridId);
  };

  const handleDragOver = (e: React.DragEvent, gridId: number) => {
    // Handle reticle drag over - always allow if showReticle is true
    if (showReticle) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverGridId(gridId);
      return;
    }
    if (isEnemy) return;
    e.preventDefault();
    setDragOverGridId(gridId);
  };

  const handleDragLeave = () => {
    setDragOverGridId(null);
  };

  const handleDrop = (e: React.DragEvent, targetGridId: number) => {
    e.preventDefault();
    
    // Handle reticle drop when showReticle is active
    if (showReticle && onReticleMove) {
      onReticleMove(targetGridId);
      setIsDraggingReticle(false);
      setDragOverGridId(null);
      return;
    }
    
    if (isEnemy) return;
    
    // Check if it's a unit being dragged from the party selector
    const selectorData = e.dataTransfer.getData("application/x-selector-unit");
    if (selectorData && onAddUnit) {
      const { unitId } = JSON.parse(selectorData);
      onAddUnit(unitId, targetGridId);
      setDraggedGridId(null);
      setDragOverGridId(null);
      return;
    }
    
    // Otherwise handle internal grid move
    const fromGridId = parseInt(e.dataTransfer.getData("text/plain"));
    if (fromGridId !== targetGridId && onMoveUnit) {
      onMoveUnit(fromGridId, targetGridId);
    }
    setDraggedGridId(null);
    setDragOverGridId(null);
  };

  const handleDragEnd = () => {
    setDraggedGridId(null);
    setDragOverGridId(null);
    handleReticleDragEnd();
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
    const encounterUnit = getUnitAtPosition(gridId);
    const damagePreview = getDamagePreview(gridId);
    const isDragging = draggedGridId === gridId;
    const isDragOver = dragOverGridId === gridId;
    
    // Check if this grid is affected by targeting pattern
    const affectedPos = affectedPositions.find(p => p.gridId === gridId);
    const isAffectedByPattern = affectedPos !== undefined;
    // Reticle center only for movable reticles, not fixed patterns
    const isReticleCenter = showReticle && reticleGridId === gridId;
    // For fixed patterns, highlight all affected tiles (no special "center")
    const isFixedPatternTile = fixedAttackPositions.length > 0 && affectedPos !== undefined;
    // Valid reticle position highlighting (when dragging/placing reticle)
    const isValidReticleTarget = showReticle && validReticlePositions?.has(gridId) && !isReticleCenter;
    const isInvalidReticleTarget = showReticle && validReticlePositions && !validReticlePositions.has(gridId) && !isReticleCenter;
    
    const slotSize = "w-16 h-16 sm:w-18 sm:h-18";
    
    // Get the label for this slot based on damage percent and hit count
    const getDamageLabel = () => {
      if (!affectedPos) return null;
      const hitCount = (affectedPos as any).hitCount;
      if (hitCount && hitCount > 1) {
        return `${affectedPos.damagePercent}% (${hitCount}x)`;
      }
      if (affectedPos.damagePercent === 100) return "Target";
      return `${affectedPos.damagePercent}%`;
    };
    
    if (!encounterUnit) {
      const handleEmptySlotClick = () => {
        // Allow clicking empty slots to move reticle
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
            isDragOver && !showReticle && "border-primary bg-primary/20 border-solid",
            // Valid/invalid reticle position highlighting
            isValidReticleTarget && !isAffectedByPattern && "border-green-500/50 border-solid bg-green-500/10",
            isInvalidReticleTarget && "opacity-30",
            // Movable reticle highlighting
            isReticleCenter && "border-yellow-500 border-solid border-2 bg-yellow-500/20 cursor-grab",
            showReticle && isAffectedByPattern && !isReticleCenter && "border-orange-500 border-solid bg-orange-500/10",
            // Fixed pattern highlighting (use red/orange gradient for cone effect)
            isFixedPatternTile && affectedPos?.damagePercent === 100 && "border-red-500 border-solid border-2 bg-red-500/20",
            isFixedPatternTile && affectedPos?.damagePercent !== 100 && "border-orange-500 border-solid bg-orange-500/15",
            isDraggingReticle && isReticleCenter && "opacity-50"
          )}
        >
          {/* Crosshair icon for movable reticle center */}
          {isReticleCenter && (
            <Crosshair className="w-6 h-6 text-yellow-500" />
          )}
          {/* Label for affected tiles */}
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

    const unitId = isEnemy 
      ? (encounterUnit as EncounterUnit).unit_id 
      : (encounterUnit as PartyUnit).unitId;
    const unitGridId = isEnemy 
      ? (encounterUnit as EncounterUnit).grid_id! 
      : (encounterUnit as PartyUnit).gridId;

    const unitData = getUnitById(unitId);
    const unitName = unitData ? t(unitData.identity.name) : `Unit ${unitId}`;
    
    const maxRank = unitData?.statsConfig?.stats?.length || 1;
    const currentRank = isEnemy 
      ? (rankOverrides[unitGridId] || maxRank)
      : (encounterUnit as PartyUnit).rank;

    // Get unit stats for HP/Armor display
    const unitStats = unitData?.statsConfig?.stats?.[currentRank - 1];
    const unitHp = unitStats?.hp || 0;
    const unitArmor = unitStats?.armor_hp || 0;

    const isSelected = selectedUnit?.gridId === unitGridId && selectedUnit?.isEnemy === isEnemy;

    const handleClick = () => {
      // If showing reticle, clicking on a slot moves the reticle there
      if (showReticle && onReticleMove) {
        onReticleMove(unitGridId);
        return;
      }
      // If this is the reticle center, don't handle unit click
      if (isReticleCenter) return;
      onUnitClick({
        unitId,
        gridId: unitGridId,
        rank: currentRank,
        isEnemy,
      });
    };


    const slotContent = (
      <div
        onClick={handleClick}
        draggable={isReticleCenter || (!isEnemy && !showReticle)}
        onDragStart={(e) => {
          if (isReticleCenter) {
            handleReticleDragStart(e, gridId);
          } else {
            handleDragStart(e, gridId, unitId);
          }
        }}
        onDragOver={(e) => handleDragOver(e, gridId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, gridId)}
        onDragEnd={handleDragEnd}
        className={cn(
          slotSize,
          "border rounded-md flex flex-col items-center justify-center overflow-hidden transition-all cursor-pointer relative",
          isEnemy 
            ? "border-destructive/50 bg-destructive/10 hover:bg-destructive/20" 
            : "border-primary bg-primary/10 hover:bg-primary/20",
          isSelected && "ring-2 ring-offset-2 ring-yellow-500",
          isDragging && "opacity-50",
          isDragOver && showReticle && "ring-2 ring-yellow-400",
          isDragOver && !showReticle && "ring-2 ring-primary",
          // Movable reticle highlighting for occupied slots
          isReticleCenter && "ring-2 ring-yellow-500 ring-offset-1 cursor-grab",
          showReticle && isAffectedByPattern && !isReticleCenter && "ring-2 ring-orange-500/70",
          // Fixed pattern highlighting for occupied slots
          isFixedPatternTile && affectedPos?.damagePercent === 100 && "ring-2 ring-red-500 ring-offset-1",
          isFixedPatternTile && affectedPos?.damagePercent !== 100 && "ring-2 ring-orange-500/70",
          isDraggingReticle && isReticleCenter && "opacity-50"
        )}
      >
        {/* Crosshair overlay for movable reticle center */}
        {isReticleCenter && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <Crosshair className="w-8 h-8 text-yellow-500 drop-shadow-lg" />
          </div>
        )}
        
        {unitData && (
          <UnitImage
            iconName={unitData.identity.icon}
            alt={unitName}
            className="w-full h-full"
          />
        )}

        {/* Targeting pattern label indicator - top right */}
        {isAffectedByPattern && (
          <div className={cn(
            "absolute top-0.5 right-0.5 text-[7px] font-bold bg-black/70 px-1 rounded-sm",
            affectedPos?.damagePercent === 100 ? "text-red-400" : "text-orange-400"
          )}>
            {getDamageLabel()}
          </div>
        )}

        {/* HP/Armor bars at bottom when no damage preview, or when target is out of range/blocked */}
        {(!damagePreview || !damagePreview.canTarget || !damagePreview.inRange || damagePreview.isBlocked) && (unitHp > 0 || unitArmor > 0) && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-0.5 space-y-0.5">
            {/* Armor Bar (above HP) */}
            {unitArmor > 0 && (
              <div className="h-1.5 w-full bg-gray-700 overflow-hidden">
                <div className="h-full bg-sky-500" style={{ width: '100%' }} />
              </div>
            )}
            {/* HP Bar (at bottom) */}
            <div className="h-1.5 w-full bg-gray-700 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: '100%' }} />
            </div>
          </div>
        )}
        
        {/* Damage preview bars */}
        {damagePreview && damagePreview.canTarget && damagePreview.inRange && !damagePreview.isBlocked && (() => {
          const { minHpRemaining, maxHpRemaining, minArmorRemaining, maxArmorRemaining } = getRemainingRange(damagePreview);
          
          // Calculate percentages for HP bar
          const minHpPercent = (minHpRemaining / damagePreview.targetHp) * 100;
          const maxHpPercent = (maxHpRemaining / damagePreview.targetHp) * 100;
          const minDamageHpPercent = 100 - maxHpPercent; // Guaranteed damage (red)
          const rangeDamageHpPercent = maxHpPercent - minHpPercent; // Range damage (orange)
          
          // Calculate percentages for Armor bar
          let minArmorPercent = 0;
          let maxArmorPercent = 0;
          let minDamageArmorPercent = 0;
          let rangeDamageArmorPercent = 0;
          if (damagePreview.targetHasArmor && damagePreview.targetArmorHp > 0) {
            minArmorPercent = (minArmorRemaining / damagePreview.targetArmorHp) * 100;
            maxArmorPercent = (maxArmorRemaining / damagePreview.targetArmorHp) * 100;
            minDamageArmorPercent = 100 - maxArmorPercent;
            rangeDamageArmorPercent = maxArmorPercent - minArmorPercent;
          }
          
          return (
            <>
              {/* Dodge chance indicator - top left */}
              {damagePreview.dodgeChance > 0 && (
                <div className="absolute top-0.5 left-0.5 text-[8px] font-bold text-yellow-400 bg-black/60 px-1 rounded-sm">
                  {damagePreview.dodgeChance}%
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 p-0.5">
                <div className="space-y-0.5">
                  {/* Armor Bar with damage visualization (above HP) */}
                  {damagePreview.targetHasArmor && (
                    <div className="h-1.5 w-full bg-gray-700/80 overflow-hidden flex">
                      {/* Blue: Remaining Armor (minimum case) */}
                      <div 
                        className="h-full bg-sky-500 transition-all" 
                        style={{ width: `${minArmorPercent}%` }} 
                      />
                      {/* Orange: Damage range */}
                      {rangeDamageArmorPercent > 0 && (
                        <div 
                          className="h-full bg-orange-500 transition-all" 
                          style={{ width: `${rangeDamageArmorPercent}%` }} 
                        />
                      )}
                      {/* Red: Guaranteed damage */}
                      {minDamageArmorPercent > 0 && (
                        <div 
                          className="h-full bg-red-500 transition-all" 
                          style={{ width: `${minDamageArmorPercent}%` }} 
                        />
                      )}
                    </div>
                  )}
                  
                  {/* HP Bar with damage visualization (at bottom) */}
                  <div className="h-1.5 w-full bg-gray-700/80 overflow-hidden flex">
                    {/* Green: Remaining HP (minimum case) */}
                    <div 
                      className="h-full bg-emerald-500 transition-all" 
                      style={{ width: `${minHpPercent}%` }} 
                    />
                    {/* Orange: Damage range (potential additional damage) */}
                    {rangeDamageHpPercent > 0 && (
                      <div 
                        className="h-full bg-orange-500 transition-all" 
                        style={{ width: `${rangeDamageHpPercent}%` }} 
                      />
                    )}
                    {/* Red: Guaranteed damage */}
                    {minDamageHpPercent > 0 && (
                      <div 
                        className="h-full bg-red-500 transition-all" 
                        style={{ width: `${minDamageHpPercent}%` }} 
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          );
        })()}
        
        {/* Cannot target overlay - now includes out-of-range and blocked */}
        {damagePreview && (!damagePreview.canTarget || !damagePreview.inRange || damagePreview.isBlocked) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center cursor-help">
                <span className="text-muted-foreground text-xs">
                  {!damagePreview.canTarget && "✕"}
                  {damagePreview.canTarget && !damagePreview.inRange && "Out of Range"}
                  {damagePreview.canTarget && damagePreview.inRange && damagePreview.isBlocked && "Blocked"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs p-2">
              <div className="text-xs space-y-1">
                <p className="font-semibold">{unitName}</p>
                {!damagePreview.canTarget && <p className="text-muted-foreground">Cannot target this unit type</p>}
                {damagePreview.canTarget && !damagePreview.inRange && (
                  <p className="text-muted-foreground">Target is out of range (Range: {damagePreview.range})</p>
                )}
                {damagePreview.canTarget && damagePreview.inRange && damagePreview.isBlocked && (
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Blocked by:</p>
                    <p className="text-amber-500">
                      {t(damagePreview.blockedByUnitName || "Unknown")} 
                      <span className="text-muted-foreground ml-1">
                        ({damagePreview.blockedByBlockingLevel !== undefined 
                          ? ["None", "Partial", "Full", "God"][damagePreview.blockedByBlockingLevel] 
                          : "?"} blocking)
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );

    // Wrap with tooltip for detailed info
    if (damagePreview && damagePreview.canTarget && damagePreview.inRange && !damagePreview.isBlocked) {
      const { minHpRemaining, maxHpRemaining, minArmorRemaining, maxArmorRemaining } = getRemainingRange(damagePreview);
      
      return (
        <Tooltip key={gridId}>
          <TooltipTrigger asChild>
            {slotContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm p-2">
            <div className="text-xs space-y-1.5">
              <p className="font-semibold">{unitName}</p>
              
              {/* Current -> After */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">HP:</span>
                  <span className="text-emerald-500 dark:text-emerald-400">{damagePreview.targetHp}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-emerald-500 dark:text-emerald-400 font-medium">
                    {minHpRemaining === maxHpRemaining ? minHpRemaining : `${minHpRemaining}-${maxHpRemaining}`}
                  </span>
                </div>
                {damagePreview.targetHasArmor && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Armor:</span>
                    <span className="text-sky-500 dark:text-sky-400">{damagePreview.targetArmorHp}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sky-500 dark:text-sky-400 font-medium">
                      {minArmorRemaining === maxArmorRemaining ? minArmorRemaining : `${minArmorRemaining}-${maxArmorRemaining}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Damage dealt */}
              <div className="border-t pt-1.5 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Damage{damagePreview.totalShots > 1 && ` (${damagePreview.totalShots} hits)`}:
                  </span>
                  <span className="text-destructive font-medium">
                    {damagePreview.minTotalDamage.hpDamage}-{damagePreview.maxTotalDamage.hpDamage} HP
                    {damagePreview.targetHasArmor && (
                      <span className="text-sky-500 dark:text-sky-400 ml-1">
                        +{damagePreview.minTotalDamage.armorDamage}-{damagePreview.maxTotalDamage.armorDamage} Arm
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Chances */}
              <div className="border-t pt-1.5 flex gap-4">
                <span className="text-muted-foreground">
                  Dodge: <span className={cn("font-medium", damagePreview.dodgeChance > 0 && "text-yellow-500 dark:text-yellow-400")}>{damagePreview.dodgeChance}%</span>
                </span>
                <span className="text-muted-foreground">
                  Crit: <span className={cn("font-medium", damagePreview.critChance > 0 && "text-orange-500 dark:text-orange-400")}>{damagePreview.critChance}%</span>
                </span>
              </div>

              {/* Status Effects */}
              {damagePreview.statusEffects.length > 0 && (
                <div className="border-t pt-1.5 space-y-0.5">
                  {damagePreview.statusEffects.map(se => (
                    <div
                      key={se.effectId}
                      className={cn("flex justify-between text-[10px]", se.isImmune && "opacity-50")}
                    >
                      <span style={{ color: se.color }}>
                        {se.name}{se.isImmune && " (IMMUNE)"}
                      </span>
                      <span className="text-muted-foreground">
                        {se.chance}% • {se.duration}t
                        {se.dotDamage > 0 && <span className="text-destructive ml-1">{se.dotDamage}/t</span>}
                        {se.isStun && <span className="text-purple-400 ml-1">Stun</span>}
                      </span>
                    </div>
                  ))}
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
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={gridId}>{slotContent}</div>;
  };

  return (
    <TooltipProvider>
      <div 
        ref={gridRef}
        tabIndex={showReticle ? 0 : undefined}
        className={cn(
          "flex flex-col items-center gap-2 p-4 rounded-lg outline-none",
          isEnemy ? "bg-destructive/5" : "bg-primary/5",
          showReticle && "focus:ring-2 focus:ring-yellow-500/50"
        )}
      >
        <div className="text-sm font-medium text-muted-foreground mb-2">
          {isEnemy ? "Enemy Formation" : "Your Formation"}
        </div>
        
        {isEnemy ? (
          <>
            <div className="flex gap-1 justify-center">
              {layout.ROW_3.map(gridId => renderSlot(gridId))}
            </div>
            <div className="flex gap-1">
              {layout.ROW_2.map(gridId => renderSlot(gridId))}
            </div>
            <div className="flex gap-1">
              {layout.ROW_1.map(gridId => renderSlot(gridId))}
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-1">
              {layout.ROW_1.map(gridId => renderSlot(gridId))}
            </div>
            <div className="flex gap-1">
              {layout.ROW_2.map(gridId => renderSlot(gridId))}
            </div>
            <div className="flex gap-1 justify-center">
              {layout.ROW_3.map(gridId => renderSlot(gridId))}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
