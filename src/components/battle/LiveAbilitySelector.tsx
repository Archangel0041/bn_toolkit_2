import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAbilityById } from "@/lib/abilities";
import { getAbilityImageUrl } from "@/lib/abilityImages";
import { getDamageTypeIconUrl, getDamageTypeName } from "@/lib/damageImages";
import { expandTargetTags } from "@/lib/tagHierarchy";
import { getEffectDisplayNameTranslated, getEffectColor, getEffectIconUrl, getEffectDuration } from "@/lib/statusEffects";
import type { AbilityInfo } from "@/types/battleSimulator";
import { LineOfFireLabels } from "@/types/battleSimulator";
import { AttackDirection, UnitTag } from "@/data/gameEnums";
import { Check, X, Crosshair, Target } from "lucide-react";

// Targeting categories with colors
const TARGETING_CATEGORIES = {
  air: { tag: 39, label: "Air", color: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/50" },
  ground: { tag: 24, label: "Ground", color: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50" },
  sea: { tag: 15, label: "Sea", color: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/50" },
};

function getTargetingCategories(targets: number[]): { canTarget: string[]; cannotTarget: string[] } {
  if (targets.length === 0) {
    return { canTarget: ["Air", "Ground", "Sea"], cannotTarget: [] };
  }
  
  const expandedTargets = expandTargetTags(targets);
  const canTarget: string[] = [];
  const cannotTarget: string[] = [];
  
  if (targets.includes(51) || expandedTargets.includes(51)) {
    return { canTarget: ["Air", "Ground", "Sea"], cannotTarget: [] };
  }
  
  for (const [key, { tag, label }] of Object.entries(TARGETING_CATEGORIES)) {
    if (targets.includes(tag) || expandedTargets.includes(tag)) {
      canTarget.push(label);
    } else {
      cannotTarget.push(label);
    }
  }
  
  return { canTarget, cannotTarget };
}

// Detailed targeting types for tooltip
const TARGETING_TYPES = [
  { tag: UnitTag.Air, label: "Air", key: "air" },
  { tag: UnitTag.Lta, label: "LTA", key: "lta" },
  { tag: UnitTag.Soldier, label: "Soldier", key: "soldier" },
  { tag: UnitTag.Sniper, label: "Sniper", key: "sniper" },
  { tag: UnitTag.Vehicle, label: "Vehicle", key: "vehicle" },
  { tag: UnitTag.Tank, label: "Tank", key: "tank" },
  { tag: UnitTag.Metal, label: "Metal", key: "metal" },
  { tag: UnitTag.Critter, label: "Critter", key: "critter" },
  { tag: UnitTag.Civilian, label: "Civilian", key: "civilian" },
  { tag: UnitTag.Sea, label: "Sea", key: "sea" },
  { tag: UnitTag.Ship, label: "Ship", key: "ship" },
] as const;

function canTargetTag(abilityTargets: number[], tagToCheck: number, expandedTargets: Set<number>): boolean {
  if (abilityTargets.length === 0) return true;
  if (abilityTargets.includes(UnitTag.Unit) || expandedTargets.has(UnitTag.Unit)) return true;
  if (abilityTargets.includes(tagToCheck) || expandedTargets.has(tagToCheck)) return true;
  return false;
}

function getTargetingDetails(targets: number[]): { tag: number; label: string; canHit: boolean }[] {
  if (targets.length === 0) {
    return TARGETING_TYPES.map(t => ({ tag: t.tag, label: t.label, canHit: true }));
  }
  
  const expandedTargets = new Set(expandTargetTags(targets));
  targets.forEach(t => expandedTargets.add(t));
  
  return TARGETING_TYPES.map(t => ({
    tag: t.tag,
    label: t.label,
    canHit: canTargetTag(targets, t.tag, expandedTargets),
  }));
}

interface LiveAbilitySelectorProps {
  abilities: AbilityInfo[];
  selectedAbilityId: number | null;
  onSelectAbility: (abilityId: number) => void;
  cooldowns: Record<number, number>;
  weaponGlobalCooldowns: Record<string, number>;
  weaponAmmo?: Record<string, number>;
  weaponReloadCooldown?: Record<string, number>;
  abilityChargeProgress?: Record<number, number>;
  disabled?: boolean;
  className?: string;
}

export function LiveAbilitySelector({
  abilities,
  selectedAbilityId,
  onSelectAbility,
  cooldowns,
  weaponGlobalCooldowns,
  weaponAmmo,
  weaponReloadCooldown,
  abilityChargeProgress,
  disabled,
  className,
}: LiveAbilitySelectorProps) {
  const { t } = useLanguage();

  return (
    <TooltipProvider>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {abilities.map(ability => {
          const abilityData = getAbilityById(ability.abilityId);
          const abilityName = abilityData ? t(abilityData.name) : `Ability ${ability.abilityId}`;
          const iconUrl = abilityData ? getAbilityImageUrl(abilityData.icon) : undefined;
          const dmgTypeIcon = getDamageTypeIconUrl(ability.damageType);
          const dmgTypeName = getDamageTypeName(ability.damageType);
          
          const abilityCooldown = cooldowns[ability.abilityId] || 0;
          const weaponCooldown = weaponGlobalCooldowns[ability.weaponName] || 0;
          const isOnCooldown = abilityCooldown > 0 || weaponCooldown > 0;
          const isSelected = selectedAbilityId === ability.abilityId;
          
          // Charge/prep time check
          const chargeProgress = abilityChargeProgress?.[ability.abilityId] ?? 0;
          const isCharging = ability.chargeTime > 0 && chargeProgress < ability.chargeTime;
          const chargeTurnsLeft = ability.chargeTime > 0 ? Math.max(0, ability.chargeTime - chargeProgress) : 0;
          
          // Ammo check
          const currentAmmo = weaponAmmo?.[ability.weaponName] ?? ability.weaponMaxAmmo;
          const isInfiniteAmmo = ability.weaponMaxAmmo === -1;
          const hasEnoughAmmo = isInfiniteAmmo || currentAmmo >= ability.ammoRequired;
          const isReloading = (weaponReloadCooldown?.[ability.weaponName] ?? 0) > 0;
          const reloadTurns = weaponReloadCooldown?.[ability.weaponName] ?? 0;
          
          const isDisabled = disabled || isOnCooldown || !hasEnoughAmmo || isReloading || isCharging;
          const totalShots = ability.shotsPerAttack * ability.attacksPerUse;
          
          // Get targeting categories
          const { canTarget, cannotTarget } = getTargetingCategories(ability.targets);
          
          // Get status effects
          const statusEffects = abilityData?.stats?.status_effects || ability.statusEffects || {};

          return (
            <Tooltip key={ability.abilityId}>
              <TooltipTrigger asChild>
                <Button
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  disabled={isDisabled}
                  onClick={() => onSelectAbility(ability.abilityId)}
                  className={cn(
                    "relative flex flex-col items-start gap-1 h-auto py-2 px-3 min-w-[180px]",
                    isDisabled && "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    {iconUrl && (
                      <img
                        src={iconUrl}
                        alt=""
                        className="w-8 h-8 rounded"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 text-left">
                      <span className="truncate max-w-[120px] block text-sm font-medium">{abilityName}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {dmgTypeIcon && <img src={dmgTypeIcon} alt="" className="w-3.5 h-3.5" />}
                        <span>{dmgTypeName}</span>
                      </div>
                    </div>
                    {/* Ammo indicator */}
                    {!isInfiniteAmmo && ability.ammoRequired > 0 && (
                      <Badge
                        variant={hasEnoughAmmo ? "outline" : "destructive"}
                        className="h-5 px-1.5 text-xs"
                      >
                        {currentAmmo}/{ability.weaponMaxAmmo}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Damage and stats row */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                    <span className="font-medium text-foreground">
                      {ability.minDamage}-{ability.maxDamage}
                      {totalShots > 1 && <span className="text-primary ml-0.5">x{totalShots}</span>}
                    </span>
                    <span className="text-muted-foreground/70">|</span>
                    <span>Off: {ability.offense}</span>
                    <span className="text-muted-foreground/70">|</span>
                    <span>{ability.minRange}-{ability.maxRange}</span>
                  </div>
                  
                  {/* Target badges */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {canTarget.map(cat => (
                      <Badge 
                        key={cat} 
                        variant="outline" 
                        className={cn(
                          "text-[10px] h-4 px-1",
                          cat === "Air" && TARGETING_CATEGORIES.air.color,
                          cat === "Ground" && TARGETING_CATEGORIES.ground.color,
                          cat === "Sea" && TARGETING_CATEGORIES.sea.color
                        )}
                      >
                        ✓ {cat}
                      </Badge>
                    ))}
                    {cannotTarget.map(cat => (
                      <Badge 
                        key={cat} 
                        variant="outline" 
                        className="text-[10px] h-4 px-1 bg-muted/50 text-muted-foreground line-through"
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Cooldown badge */}
                  {isOnCooldown && !isCharging && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {Math.max(abilityCooldown, weaponCooldown)}
                    </Badge>
                  )}
                  {/* Charging/prep time badge */}
                  {isCharging && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-orange-500 text-white"
                    >
                      {chargeTurnsLeft}
                    </Badge>
                  )}
                  {/* Reload badge */}
                  {isReloading && !isCharging && !isOnCooldown && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-blue-500"
                    >
                      {reloadTurns}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                <div className="text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    {iconUrl && <img src={iconUrl} alt="" className="w-6 h-6 rounded" />}
                    <div>
                      <p className="font-semibold">{abilityName}</p>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {dmgTypeIcon && <img src={dmgTypeIcon} alt="" className="w-3 h-3" />}
                        <span>{dmgTypeName} Damage</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    <span>Damage:</span>
                    <span className="text-foreground">{ability.minDamage}-{ability.maxDamage}{totalShots > 1 && ` x${totalShots}`}</span>
                    <span>Offense:</span>
                    <span className="text-foreground">{ability.offense}</span>
                    <span>Range:</span>
                    <span className="text-foreground">{ability.minRange}-{ability.maxRange}</span>
                    <span>Line of Fire:</span>
                    <span className="text-foreground">{LineOfFireLabels[ability.lineOfFire] || "Direct"}</span>
                    {ability.attackDirection === AttackDirection.Back && (
                      <>
                        <span>Direction:</span>
                        <span className="text-purple-400">Back Attack</span>
                      </>
                    )}
                    <span>Cooldown:</span>
                    <span className="text-foreground">{ability.cooldown}{ability.globalCooldown > 0 && ` (global: ${ability.globalCooldown})`}</span>
                    {ability.chargeTime > 0 && (
                      <>
                        <span>Charge:</span>
                        <span className="text-foreground">{ability.chargeTime}</span>
                      </>
                    )}
                    <span>Armor Pierce:</span>
                    <span className="text-foreground">{Math.round(ability.armorPiercing * 100)}%</span>
                    <span>Crit:</span>
                    <span className="text-foreground">{ability.critPercent}%</span>
                    {ability.suppressionMultiplier !== 1 && (
                      <>
                        <span>Suppression:</span>
                        <span className="text-foreground">{ability.suppressionMultiplier}x {ability.suppressionBonus > 0 && `+${ability.suppressionBonus}`}</span>
                      </>
                    )}
                    {ability.isFixed && (
                      <>
                        <span>Pattern:</span>
                        <span className="text-amber-400">Fixed</span>
                      </>
                    )}
                    {ability.targetArea && !ability.isFixed && ability.targetArea.targetType === 2 && (
                      <>
                        <span>Pattern:</span>
                        <span className="text-foreground">AOE ({ability.targetArea.data.length} tiles)</span>
                      </>
                    )}
                  </div>
                  
                  {/* Weapon stats */}
                  <div className="pt-1 border-t">
                    <p className="text-muted-foreground mb-1">Weapon Stats:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                      {!isInfiniteAmmo && (
                        <>
                          <span>Ammo:</span>
                          <span className="text-foreground">{ability.ammoRequired} per use | {currentAmmo}/{ability.weaponMaxAmmo}</span>
                        </>
                      )}
                      {ability.weaponReloadTime > 0 && (
                        <>
                          <span>Reload:</span>
                          <span className="text-foreground">{ability.weaponReloadTime} turns</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Status effects */}
                  {Object.keys(statusEffects).length > 0 && (
                    <div className="pt-1 border-t">
                      <p className="text-muted-foreground mb-1">Inflicts:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(statusEffects).map(([effectId, chance]) => {
                          const id = parseInt(effectId);
                          const displayName = getEffectDisplayNameTranslated(id);
                          const color = getEffectColor(id);
                          const iconUrl = getEffectIconUrl(id);
                          const duration = getEffectDuration(id);
                          return (
                            <div 
                              key={effectId} 
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted border"
                              style={{ borderColor: color, borderLeftWidth: 2 }}
                            >
                              {iconUrl && (
                                <img src={iconUrl} alt="" className="h-3 w-3 object-contain" />
                              )}
                              <span className="font-medium">{displayName}</span>
                              <span className="text-muted-foreground">({chance as number}%{duration > 0 ? `, ${duration}t` : ""})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Cooldown/reload/charging status */}
                  {(isOnCooldown || isReloading || !hasEnoughAmmo || isCharging) && (
                    <div className="pt-1 border-t space-y-0.5">
                      {isCharging && (
                        <p className="text-orange-500">
                          Charging: {chargeTurnsLeft} turn{chargeTurnsLeft > 1 ? 's' : ''} remaining
                        </p>
                      )}
                      {isOnCooldown && (
                        <p className="text-yellow-500">
                          {weaponCooldown > 0 
                            ? `Weapon cooldown: ${weaponCooldown} turns`
                            : `On cooldown: ${abilityCooldown} turns`
                          }
                        </p>
                      )}
                      {isReloading && (
                        <p className="text-blue-500">
                          Reloading: {reloadTurns} turns
                        </p>
                      )}
                      {!hasEnoughAmmo && !isReloading && (
                        <p className="text-red-500">
                          Not enough ammo (needs {ability.ammoRequired})
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Detailed targeting breakdown */}
                  <div className="pt-1 border-t space-y-1">
                    <span className="text-muted-foreground font-medium">Targetable Unit Types:</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {getTargetingDetails(ability.targets).map(({ tag, label, canHit }) => (
                        <div key={tag} className="flex items-center gap-1.5">
                          {canHit ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <X className="h-3 w-3 text-red-500" />
                          )}
                          <span className={cn(
                            "text-[10px]",
                            canHit ? "text-foreground" : "text-muted-foreground line-through"
                          )}>
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {abilities.length === 0 && (
          <p className="text-sm text-muted-foreground">No abilities available</p>
        )}
      </div>
    </TooltipProvider>
  );
}