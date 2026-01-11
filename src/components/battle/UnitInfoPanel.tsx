import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UnitImage } from "@/components/units/UnitImage";
import { useLanguage } from "@/contexts/LanguageContext";
import { getUnitById } from "@/lib/units";
import { getUnitAbilities } from "@/lib/battleCalculations";
import { getAbilityById, getLineOfFireLabel } from "@/lib/abilities";
import { DamageTypeLabels, UnitTagLabels } from "@/data/gameEnums";
import { UnitBlocking, UnitBlockingLabels, UnitClassLabels } from "@/data/gameEnums";
import { cn } from "@/lib/utils";
import { getStatusEffectDisplayName, getStatusEffectIconUrl, getEffectDisplayNameTranslated, getEffectIconUrl, getStatusEffect } from "@/lib/statusEffects";
import { getAbilityImageUrl } from "@/lib/abilityImages";
import { getDamageTypeIconUrl } from "@/lib/damageImages";
import { expandTargetTags } from "@/lib/tagHierarchy";

// Detailed targeting categories - all unit class types
const TARGETING_CATEGORIES: { tag: number; label: string; color: string }[] = [
  { tag: 39, label: "Air", color: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/50" },
  { tag: 9, label: "LTA", color: "bg-sky-400/20 text-sky-600 dark:text-sky-400 border-sky-400/50" },
  { tag: 15, label: "Sea", color: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/50" },
  { tag: 29, label: "Ship", color: "bg-blue-400/20 text-blue-600 dark:text-blue-400 border-blue-400/50" },
  { tag: 6, label: "Soldier", color: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50" },
  { tag: 46, label: "Sniper", color: "bg-amber-400/20 text-amber-600 dark:text-amber-400 border-amber-400/50" },
  { tag: 11, label: "Vehicle", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50" },
  { tag: 20, label: "Tank", color: "bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 border-emerald-400/50" },
  { tag: 26, label: "Metal", color: "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/50" },
  { tag: 38, label: "Critter", color: "bg-lime-500/20 text-lime-700 dark:text-lime-300 border-lime-500/50" },
  { tag: 41, label: "Civilian", color: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50" },
];

function getTargetingCategories(targets: number[]): { canTarget: { label: string; color: string }[]; cannotTarget: { label: string; color: string }[] } {
  const expandedTargets = expandTargetTags(targets);
  const canTarget: { label: string; color: string }[] = [];
  const cannotTarget: { label: string; color: string }[] = [];
  
  // Check if targets Unit (51) which means everything
  const targetsAll = targets.length === 0 || targets.includes(51) || expandedTargets.includes(51);
  
  for (const { tag, label, color } of TARGETING_CATEGORIES) {
    if (targetsAll || targets.includes(tag) || expandedTargets.includes(tag)) {
      canTarget.push({ label, color });
    } else {
      cannotTarget.push({ label, color });
    }
  }
  
  return { canTarget, cannotTarget };
}

interface UnitInfoPanelProps {
  unitId: number;
  rank: number;
  gridId?: number;
  isEnemy?: boolean;
  currentHp?: number;
  currentArmor?: number;
  weaponAmmo?: Record<string, number>;
  abilityCooldowns?: Record<number, number>;
  weaponGlobalCooldowns?: Record<string, number>;
  className?: string;
}

export function UnitInfoPanel({
  unitId,
  rank,
  gridId,
  isEnemy,
  currentHp,
  currentArmor,
  weaponAmmo,
  abilityCooldowns,
  weaponGlobalCooldowns,
  className,
}: UnitInfoPanelProps) {
  const { t } = useLanguage();

  const unit = useMemo(() => getUnitById(unitId), [unitId]);
  const abilities = useMemo(() => getUnitAbilities(unitId, rank), [unitId, rank]);
  
  // Group abilities by weapon
  const abilitiesByWeapon = useMemo(() => {
    const grouped: Record<string, typeof abilities> = {};
    abilities.forEach(ability => {
      const weaponName = ability.weaponName || "default";
      if (!grouped[weaponName]) grouped[weaponName] = [];
      grouped[weaponName].push(ability);
    });
    return grouped;
  }, [abilities]);
  
  if (!unit) return null;

  const stats = unit.statsConfig?.stats?.[rank - 1];
  const maxRank = unit.statsConfig?.stats?.length || 1;
  const blocking = unit.statsConfig?.blocking ?? 0;
  const blockingLabel = UnitBlockingLabels[blocking] || "Unknown";
  const className_ = unit.identity.class_name;
  const classLabel = UnitClassLabels[className_] || `Class ${className_}`;
  const preferredRow = unit.statsConfig?.preferred_row || 1;
  const size = unit.statsConfig?.size || 1;
  const unitName = t(unit.identity.name);

  const hp = stats?.hp || 0;
  const armorHp = stats?.armor_hp || 0;
  const accuracy = stats?.accuracy || 0;
  const defense = stats?.defense || 0;
  const power = stats?.power || 0;
  const bravery = stats?.bravery || 0;
  const critical = stats?.critical || 0;
  const pv = stats?.pv || 0;

  const displayHp = currentHp !== undefined ? `${currentHp}/${hp}` : hp;
  const displayArmor = currentArmor !== undefined ? `${currentArmor}/${armorHp}` : armorHp;

  const weapons = unit.weapons?.weapons;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <UnitImage
            iconName={unit.identity.icon}
            alt={unitName}
            className="w-12 h-12 rounded"
          />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{unitName}</CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs h-5">ID: {unitId}</Badge>
              <Badge variant="secondary" className="text-xs h-5">Rank {rank}/{maxRank}</Badge>
              {gridId !== undefined && (
                <Badge variant="outline" className="text-xs h-5">Grid: {gridId}</Badge>
              )}
              {isEnemy !== undefined && (
                <Badge variant={isEnemy ? "destructive" : "default"} className="text-xs h-5">
                  {isEnemy ? "Enemy" : "Friendly"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="py-2 px-4 space-y-3">
        {/* Core Stats */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Combat Stats</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">HP</span>
              <span className={cn(
                "font-medium",
                currentHp !== undefined && currentHp < hp && "text-red-500"
              )}>{displayHp}</span>
            </div>
            {armorHp > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Armor</span>
                <span className={cn(
                  "font-medium text-blue-500",
                  currentArmor !== undefined && currentArmor < armorHp && "text-blue-400"
                )}>{displayArmor}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accuracy</span>
              <span className="font-medium">{accuracy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Defense</span>
              <span className="font-medium">{defense}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Power</span>
              <span className="font-medium">{power}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Critical</span>
              <span className="font-medium">{critical}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bravery</span>
              <span className="font-medium">{bravery}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PV</span>
              <span className="font-medium">{pv}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Unit Properties */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Properties</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Class</span>
              <span className="font-medium">{classLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Blocking</span>
              <span className={cn(
                "font-medium",
                blocking === UnitBlocking.Full && "text-orange-500",
                blocking === UnitBlocking.God && "text-purple-500"
              )}>{blockingLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Row</span>
              <span className="font-medium">{preferredRow === 1 ? "Front" : preferredRow === 2 ? "Middle" : "Back"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size</span>
              <span className="font-medium">{size}</span>
            </div>
          </div>
        </div>

        {/* Weapons & Abilities (grouped) */}
        {Object.entries(abilitiesByWeapon).map(([weaponName, weaponAbilities]) => {
          const weapon = weapons?.[weaponName];
          const currentAmmo = weaponAmmo?.[weaponName];
          const maxAmmo = weapon?.stats.ammo ?? -1;
          const hasInfiniteAmmo = maxAmmo === -1;
          const reloadTime = weapon?.stats.reload_time;
          const weaponCooldown = weaponGlobalCooldowns?.[weaponName] ?? 0;
          const weaponDisplayName = weapon ? t(weapon.name) : `Weapon ${weaponName}`;

          return (
            <div key={weaponName}>
              <Separator />
              {/* Weapon Header */}
              <div className="mt-2 mb-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{weaponDisplayName}</span>
                  <div className="flex items-center gap-2 text-xs">
                    {weaponCooldown > 0 && (
                      <Badge variant="secondary" className="text-xs h-5">CD: {weaponCooldown}</Badge>
                    )}
                    <span className={cn(
                      "font-medium",
                      currentAmmo !== undefined && currentAmmo === 0 && "text-red-500"
                    )}>
                      {hasInfiniteAmmo ? "∞" : (
                        currentAmmo !== undefined ? `${currentAmmo}/${maxAmmo}` : `${maxAmmo} ammo`
                      )}
                    </span>
                    {reloadTime && reloadTime > 0 && (
                      <span className="text-muted-foreground">({reloadTime}t reload)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Abilities for this weapon */}
              <div className="space-y-2">
                {weaponAbilities.map((ability) => {
                  const abilityData = getAbilityById(ability.abilityId);
                  const abilityName = abilityData ? t(abilityData.name) : `Ability ${ability.abilityId}`;
                  const abilityCooldown = abilityCooldowns?.[ability.abilityId] ?? 0;
                  const lofLabel = getLineOfFireLabel(ability.lineOfFire);
                  const damageTypeLabel = DamageTypeLabels[ability.damageType] || "Unknown";
                  const damageTypeIcon = getDamageTypeIconUrl(ability.damageType);
                  const abilityIcon = abilityData?.icon ? getAbilityImageUrl(abilityData.icon) : null;
                  const ammoRequired = abilityData?.stats.ammo_required ?? 1;
                  const shotsPerAttack = abilityData?.stats.shots_per_attack ?? 1;
                  const attacksPerUse = ability.attacksPerUse ?? 1;
                  const totalShots = shotsPerAttack * attacksPerUse;
                  const critPercent = abilityData?.stats.critical_hit_percent ?? 0;
                  const armorPierce = abilityData?.stats.armor_piercing_percent ?? 0;
                  
                  // Get targets and critical bonuses
                  const targets = abilityData?.stats.targets || [];
                  const { canTarget, cannotTarget } = getTargetingCategories(targets);
                  const critBonuses = (abilityData?.stats as any)?.critical_bonuses as Record<string, number> | undefined;
                  
                  // Get status effects from ability
                  const statusEffects = abilityData?.stats.status_effects 
                    ? Object.entries(abilityData.stats.status_effects) 
                    : [];
                  
                  return (
                    <div key={ability.abilityId} className="bg-muted/50 rounded-lg p-3 space-y-2">
                      {/* Ability Header with Icon and Name */}
                      <div className="flex items-start gap-3">
                        {abilityIcon && (
                          <img 
                            src={abilityIcon} 
                            alt="" 
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate" title={abilityName}>
                              {abilityName}
                            </span>
                            {abilityCooldown > 0 && (
                              <Badge variant="destructive" className="text-xs h-5 flex-shrink-0">
                                CD: {abilityCooldown}
                              </Badge>
                            )}
                          </div>
                          {/* Damage Type Description Line */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            {damageTypeIcon && (
                              <img 
                                src={damageTypeIcon} 
                                alt="" 
                                className="w-4 h-4 object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                            <span>{damageTypeLabel} Damage</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Damage</span>
                          <span className="font-medium">
                            {ability.minDamage}-{ability.maxDamage}
                            {totalShots > 1 && <span className="text-muted-foreground"> (x{totalShots})</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Offense</span>
                          <span className="font-medium">{ability.offense}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Range</span>
                          <span className="font-medium">{ability.minRange}-{ability.maxRange}</span>
                        </div>
                        {lofLabel && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Line of Fire</span>
                            <span className="font-medium">{lofLabel}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cooldown</span>
                          <span className="font-medium">{ability.cooldown}t</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Global CD</span>
                          <span className="font-medium">{ability.globalCooldown}t</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ammo</span>
                          <span className="font-medium">{ammoRequired}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Crit %</span>
                          <span className="font-medium">{critPercent}%</span>
                        </div>
                        {armorPierce > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Armor Pierce</span>
                            <span className="font-medium text-orange-500">{Math.round(armorPierce * 100)}%</span>
                          </div>
                        )}
                      </div>

                      {/* Targets */}
                      {(canTarget.length > 0 || cannotTarget.length > 0) && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Targets:</span>
                          {canTarget.map(cat => (
                            <Badge 
                              key={cat.label} 
                              variant="outline" 
                              className={cn("text-xs h-5", cat.color)}
                            >
                              ✓ {cat.label}
                            </Badge>
                          ))}
                          {cannotTarget.map(cat => (
                            <Badge 
                              key={cat.label} 
                              variant="outline" 
                              className="text-xs h-5 bg-muted/50 text-muted-foreground line-through"
                            >
                              {cat.label}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Crit Bonuses */}
                      {critBonuses && Object.keys(critBonuses).length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">Crit Bonus:</span>
                          {Object.entries(critBonuses).map(([tagId, bonus]) => {
                            const tagLabel = UnitTagLabels[parseInt(tagId)] || `Tag ${tagId}`;
                            return (
                              <Badge 
                                key={tagId} 
                                variant="outline" 
                                className="text-xs h-5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/50"
                              >
                                +{bonus}% vs {tagLabel}
                              </Badge>
                            );
                          })}
                        </div>
                      )}

                      {/* Status Effects */}
                      {statusEffects.length > 0 && (
                        <div className="pt-1 border-t border-border/50">
                          <div className="text-xs text-muted-foreground mb-1">Inflicts:</div>
                          <div className="flex flex-wrap gap-1">
                            {statusEffects.map(([effectId, chance]) => {
                              const effectIdNum = parseInt(effectId);
                              const effectName = getEffectDisplayNameTranslated(effectIdNum);
                              const effectIcon = getEffectIconUrl(effectIdNum);
                              const effect = getStatusEffect(effectIdNum);
                              const duration = effect?.duration ?? 0;
                              
                              return (
                                <Badge key={effectId} variant="outline" className="text-xs gap-1">
                                  {effectIcon && <img src={effectIcon} alt="" className="w-3 h-3" />}
                                  {effectName} ({chance}%{duration > 0 && `, ${duration}t`})
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Status Effect Immunities */}
        {unit.statsConfig?.status_effect_immunities && unit.statsConfig.status_effect_immunities.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Immunities</div>
              <div className="flex flex-wrap gap-1">
                {unit.statsConfig.status_effect_immunities.map((immunity, i) => {
                  const immunityName = getStatusEffectDisplayName(immunity);
                  const iconUrl = getStatusEffectIconUrl(immunity);
                  return (
                    <Badge key={i} variant="outline" className="text-xs gap-1">
                      {iconUrl && <img src={iconUrl} alt="" className="w-3 h-3" />}
                      {immunityName}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
