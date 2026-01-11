import { cn } from "@/lib/utils";
import { getAbilityById } from "@/lib/abilities";
import { getAbilityImageUrl } from "@/lib/abilityImages";
import { getDamageTypeIconUrl } from "@/lib/damageImages";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { expandTargetTags } from "@/lib/tagHierarchy";
import type { AbilityInfo } from "@/types/battleSimulator";
import { LineOfFireLabels } from "@/types/battleSimulator";
import { AttackDirection, UnitTag } from "@/data/gameEnums";
import { Check, X } from "lucide-react";

// Detailed targeting categories matching what users care about
// Order matters - displayed in this order
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

// Check if a specific tag can be targeted by ability
function canTargetTag(abilityTargets: number[], tagToCheck: number, expandedTargets: Set<number>): boolean {
  // If no targets specified, can target everything
  if (abilityTargets.length === 0) return true;
  
  // If targets Unit (51), can target everything
  if (abilityTargets.includes(UnitTag.Unit) || expandedTargets.has(UnitTag.Unit)) return true;
  
  // Check if the tag or any of its parents are in the targets
  if (abilityTargets.includes(tagToCheck) || expandedTargets.has(tagToCheck)) return true;
  
  return false;
}

function getTargetingDetails(targets: number[]): { tag: number; label: string; canHit: boolean }[] {
  // If no targets, can hit everything
  if (targets.length === 0) {
    return TARGETING_TYPES.map(t => ({ tag: t.tag, label: t.label, canHit: true }));
  }
  
  // Expand all target tags through hierarchy
  const expandedTargets = new Set(expandTargetTags(targets));
  
  // Also add the original targets
  targets.forEach(t => expandedTargets.add(t));
  
  return TARGETING_TYPES.map(t => ({
    tag: t.tag,
    label: t.label,
    canHit: canTargetTag(targets, t.tag, expandedTargets),
  }));
}

interface AbilitySelectorProps {
  abilities: AbilityInfo[];
  selectedAbilityId: number | null;
  onSelectAbility: (abilityId: number) => void;
  className?: string;
}

export function AbilitySelector({
  abilities,
  selectedAbilityId,
  onSelectAbility,
  className,
}: AbilitySelectorProps) {
  const { t } = useLanguage();

  if (abilities.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground p-2", className)}>
        No abilities available
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("flex flex-wrap gap-2 p-2", className)}>
        {abilities.map((info) => {
          const ability = getAbilityById(info.abilityId);
          if (!ability) return null;

          const iconUrl = getAbilityImageUrl(ability.icon);
          const dmgTypeIcon = getDamageTypeIconUrl(info.damageType);
          const isSelected = selectedAbilityId === info.abilityId;
          const totalShots = info.shotsPerAttack * info.attacksPerUse;

          return (
            <Tooltip key={info.abilityId}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSelectAbility(info.abilityId)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-all",
                    "hover:bg-accent/50",
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary"
                      : "border-border bg-background"
                  )}
                >
                  {iconUrl && (
                    <img src={iconUrl} alt="" className="w-8 h-8 rounded" />
                  )}
                  <div className="text-left">
                    <p className="text-xs font-medium truncate max-w-24">
                      {t(ability.name)}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {dmgTypeIcon && <img src={dmgTypeIcon} alt="" className="w-3 h-3" />}
                      <span>
                        {info.minDamage}-{info.maxDamage}
                        {totalShots > 1 && ` x${totalShots}`}
                      </span>
                    </div>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="text-xs space-y-1">
                  <p className="font-semibold">{t(ability.name)}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    <span>Damage:</span>
                    <span>{info.minDamage}-{info.maxDamage}{totalShots > 1 && ` x${totalShots}`}</span>
                    <span>Offense:</span>
                    <span>{info.offense}</span>
                    <span>Range:</span>
                    <span>{info.minRange}-{info.maxRange}</span>
                    <span>Line of Fire:</span>
                    <span>{LineOfFireLabels[info.lineOfFire] || "Direct"}</span>
                    {info.attackDirection === AttackDirection.Back && (
                      <>
                        <span>Direction:</span>
                        <span className="text-purple-400">Back Attack</span>
                      </>
                    )}
                    <span>Cooldown:</span>
                    <span>{info.cooldown}{info.globalCooldown > 0 && ` (global: ${info.globalCooldown})`}</span>
                    {info.chargeTime > 0 && (
                      <>
                        <span>Charge:</span>
                        <span>{info.chargeTime}</span>
                      </>
                    )}
                    <span>Armor Pierce:</span>
                    <span>{Math.round(info.armorPiercing * 100)}%</span>
                    <span>Crit:</span>
                    <span>{info.critPercent}%</span>
                    {info.suppressionMultiplier !== 1 && (
                      <>
                        <span>Suppression:</span>
                        <span>{info.suppressionMultiplier}x {info.suppressionBonus > 0 && `+${info.suppressionBonus}`}</span>
                      </>
                    )}
                    {info.isFixed && (
                      <>
                        <span>Pattern:</span>
                        <span className="text-amber-400">Fixed</span>
                      </>
                    )}
                    {info.targetArea && !info.isFixed && info.targetArea.targetType === 2 && (
                      <>
                        <span>Pattern:</span>
                        <span>AOE ({info.targetArea.data.length} tiles)</span>
                      </>
                    )}
                  </div>
                  
                  {/* Detailed targeting breakdown */}
                  <div className="pt-1 border-t space-y-1">
                    <span className="text-muted-foreground font-medium">Targetable Unit Types:</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {getTargetingDetails(info.targets).map(({ tag, label, canHit }) => (
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
      </div>
    </TooltipProvider>
  );
}
