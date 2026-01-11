import { useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { CompareBar } from "@/components/units/CompareBar";
import { StatSection, StatRow, DamageModsGrid } from "@/components/units/StatSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getUnitById } from "@/lib/units";
import { getAbilityById, getLineOfFireLabel } from "@/lib/abilities";
import { getStatusEffectDisplayName, getStatusEffectColor, getStatusEffectIconUrl, getEffectDisplayNameTranslated, getEffectColor, getEffectIconUrl, getEffectDuration } from "@/lib/statusEffects";
import { getClassDisplayName } from "@/lib/battleConfig";
import { getAbilityImageUrl } from "@/lib/abilityImages";
import { getDamageTypeName, getDamageTypeIconUrl } from "@/lib/damageImages";
import { getUnitImageUrl } from "@/lib/unitImages";
import { getResourceIconUrl } from "@/lib/resourceImages";
import { statIcons } from "@/lib/statIcons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompare } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, Swords, Clock, Coins, Wrench, Plus, Check, Activity, Shield
} from "lucide-react";
import { UnitTag, UnitTagLabels } from "@/data/gameEnums";
import { expandTargetTags } from "@/lib/tagHierarchy";

// Main targeting categories
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
  
  // Check if targets Unit (51) which means everything
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && hours === 0) parts.push(`${secs}s`);
  
  return parts.join(" ") || "0s";
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Calculate damage at rank: Damage = Base Damage * (1 + 2 * 0.01 * Power)
function calculateDamageAtRank(baseDamage: number, power: number): number {
  return Math.floor(baseDamage * (1 + 2 * 0.01 * power));
}

interface StatWithChangeProps {
  label: string;
  value: number | string;
  prevValue?: number | string;
  iconSrc?: string;
  suffix?: string;
}

function StatWithChange({ label, value, prevValue, iconSrc, suffix = "" }: StatWithChangeProps) {
  const numValue = typeof value === "number" ? value : parseFloat(value);
  const numPrevValue = prevValue !== undefined ? (typeof prevValue === "number" ? prevValue : parseFloat(prevValue as string)) : undefined;
  
  const hasChange = numPrevValue !== undefined && !isNaN(numValue) && !isNaN(numPrevValue) && numValue !== numPrevValue;
  const isIncrease = hasChange && numValue > numPrevValue!;
  
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-muted-foreground flex items-center gap-2">
        {iconSrc && <img src={iconSrc} alt="" className="h-5 w-5 object-contain" />}
        {label}
      </span>
      <span className={cn(
        "flex items-center gap-1 font-medium",
        hasChange && isIncrease && "text-green-600 dark:text-green-400",
        hasChange && !isIncrease && "text-red-600 dark:text-red-400"
      )}>
        {value}{suffix}
        {hasChange && (
          <span className="text-xs ml-1">
            ({isIncrease ? "+" : ""}{(numValue - numPrevValue!).toFixed(numValue % 1 === 0 ? 0 : 1)})
          </span>
        )}
      </span>
    </div>
  );
}

export default function UnitDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { addToCompare, removeFromCompare, isInCompare, compareUnits } = useCompare();
  const location = useLocation();
  
  // Get back navigation from location state
  const backPath = (location.state as { from?: string; fromLabel?: string })?.from || "/";
  const backLabel = (location.state as { from?: string; fromLabel?: string })?.fromLabel || "Back to Units";

  const unit = getUnitById(parseInt(id || "0"));

  if (!unit) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Unit Not Found</h1>
          <p className="text-muted-foreground mb-6">The unit with ID {id} does not exist.</p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Units
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const allStats = unit.statsConfig?.stats || [];
  const maxRank = allStats.length;
  const [selectedRank, setSelectedRank] = useState(maxRank);
  
  const stats = allStats[selectedRank - 1];
  const prevStats = selectedRank > 1 ? allStats[selectedRank - 2] : undefined;
  const inCompare = isInCompare(unit.id);
  const canAddToCompare = compareUnits.length < 2;

  const classDisplayName = t(getClassDisplayName(unit.identity.class_name));
  const sideLabels: Record<number, string> = {
    1: "Friendly",
    2: "Enemy", 
    3: "Unknown",
    4: "Cast (NPC)",
    5: "Boss",
    6: "Test",
  };
  const sideLabel = sideLabels[unit.identity.side] || `Side ${unit.identity.side}`;

  const handleCompareClick = () => {
    if (inCompare) {
      removeFromCompare(unit.id);
    } else if (canAddToCompare) {
      addToCompare(unit);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={backPath}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          {unit.identity.icon && (
            <img
              src={getUnitImageUrl(unit.identity.icon) || ""}
              alt={t(unit.identity.name)}
              className="w-16 h-16 object-contain rounded-lg border bg-muted"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{t(unit.identity.name)}</h1>
            <p className="text-muted-foreground">
              ID: {unit.id} • {classDisplayName} • {sideLabel}
            </p>
          </div>
          {maxRank > 1 && (
            <Select value={selectedRank.toString()} onValueChange={(v) => setSelectedRank(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxRank }, (_, i) => i + 1).map((rank) => (
                  <SelectItem key={rank} value={rank.toString()}>
                    Rank {rank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant={inCompare ? "default" : "outline"}
            onClick={handleCompareClick}
            disabled={!inCompare && !canAddToCompare}
            className="gap-2"
          >
            {inCompare ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {inCompare ? "In Compare" : "Add to Compare"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {unit.identity.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {UnitTagLabels[tag] || `#${tag}`}
            </Badge>
          ))}
        </div>

        {/* Only show description if it's actually translated (not a raw key) */}
        {t(unit.identity.description) !== unit.identity.description && (
          <p className="text-muted-foreground">{t(unit.identity.description)}</p>
        )}

        <div className="space-y-4">
          {/* Main Stats */}
          {stats && (
            <StatSection title="Main Stats" icon={<Activity className="h-4 w-4" />} defaultOpen>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatWithChange label="HP" value={stats.hp} prevValue={prevStats?.hp} iconSrc={statIcons.hp} />
                <StatWithChange label="Power" value={stats.power} prevValue={prevStats?.power} iconSrc={statIcons.power} />
                <StatWithChange label="PV" value={stats.pv} prevValue={prevStats?.pv} iconSrc={statIcons.pv} />
                <StatWithChange label="Accuracy" value={stats.accuracy} prevValue={prevStats?.accuracy} iconSrc={statIcons.accuracy} />
                <StatWithChange label="Defense" value={stats.defense} prevValue={prevStats?.defense} iconSrc={statIcons.defense} />
                <StatWithChange label="Dodge" value={stats.dodge} prevValue={prevStats?.dodge} iconSrc={statIcons.dodge} />
                <StatWithChange label="Bravery" value={stats.bravery} prevValue={prevStats?.bravery} iconSrc={statIcons.bravery} />
                <StatWithChange label="Critical" value={stats.critical} prevValue={prevStats?.critical} iconSrc={statIcons.critical} suffix="%" />
                <StatWithChange label="Ability Slots" value={stats.ability_slots} prevValue={prevStats?.ability_slots} iconSrc={statIcons.ability_slots} />
                {stats.armor_hp && <StatWithChange label="Armor HP" value={stats.armor_hp} prevValue={prevStats?.armor_hp} iconSrc={statIcons.armor_hp} />}
              </div>
              {unit.statsConfig?.size && (
                <div className="mt-4 pt-4 border-t">
                  <StatRow label="Size" value={unit.statsConfig.size} />
                  <StatRow label="Preferred Row" value={unit.statsConfig.preferred_row} />
                </div>
              )}
            </StatSection>
          )}

          {/* Damage & Armor */}
          {stats && (stats.damage_mods || stats.armor_damage_mods) && (
            <StatSection title="Damage & Armor Modifiers" icon={<img src={statIcons.damage_mods} alt="" className="h-4 w-4" />} defaultOpen>
              <div className="space-y-4">
                {stats.damage_mods && (
                  <DamageModsGrid mods={stats.damage_mods} title="Damage Resistance" />
                )}
                {stats.armor_damage_mods && (
                  <DamageModsGrid mods={stats.armor_damage_mods} title="Armor Damage Mods" />
                )}
              </div>
            </StatSection>
          )}

          {/* Status Immunities */}
          {unit.statsConfig?.status_effect_immunities && unit.statsConfig.status_effect_immunities.length > 0 && (
            <StatSection title="Status Effect Immunities" icon={<Shield className="h-4 w-4" />} defaultOpen>
              <div className="flex flex-wrap gap-3">
                {unit.statsConfig.status_effect_immunities.map((immunityId) => {
                  const displayName = getStatusEffectDisplayName(immunityId);
                  const color = getStatusEffectColor(immunityId);
                  const iconUrl = getStatusEffectIconUrl(immunityId);
                  return (
                    <div 
                      key={immunityId} 
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card shadow-sm"
                      style={{ borderColor: color, borderLeftWidth: 4 }}
                    >
                      {iconUrl && (
                        <img 
                          src={iconUrl} 
                          alt="" 
                          className="h-5 w-5 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <span className="font-medium text-foreground">{displayName}</span>
                    </div>
                  );
                })}
              </div>
            </StatSection>
          )}

          {/* Abilities */}
          {unit.weapons && Object.keys(unit.weapons.weapons).length > 0 && (
            <StatSection title="Abilities" icon={<Swords className="h-4 w-4" />} defaultOpen>
              <div className="space-y-4">
                {Object.entries(unit.weapons.weapons).flatMap(([weaponKey, weapon]) =>
                  weapon.abilities.map((abilId) => {
                    const ability = getAbilityById(abilId);
                    if (!ability) return null;
                    const abilityIconUrl = getAbilityImageUrl(ability.icon);
                    const damageType = ability.stats.damage_type;
                    const damageTypeName = getDamageTypeName(damageType);
                    const damageTypeIconUrl = getDamageTypeIconUrl(damageType);
                    
                    // Calculate damage at current rank using power
                    const currentPower = stats?.power || 0;
                    const minDamage = calculateDamageAtRank(weapon.stats.base_damage_min, currentPower);
                    const maxDamage = calculateDamageAtRank(weapon.stats.base_damage_max, currentPower);
                    
                    // Total attack = weapon base_atk + ability attack
                    const weaponBaseAtk = weapon.stats.base_atk || 0;
                    const totalAttack = weaponBaseAtk + ability.stats.attack;
                    // Calculate offense = total attack + unit accuracy
                    const offense = totalAttack + (stats?.accuracy || 0);
                    
                    return (
                      <div key={`${weaponKey}-${abilId}`} className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                          {abilityIconUrl && (
                            <img 
                              src={abilityIconUrl} 
                              alt="" 
                              className="h-10 w-10 rounded object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium">{t(ability.name)}</h4>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              {damageTypeIconUrl && (
                                <img 
                                  src={damageTypeIconUrl} 
                                  alt="" 
                                  className="h-4 w-4 object-contain"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                              <span>{damageTypeName} Damage</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                          <StatRow 
                            label="Min Damage" 
                            value={ability.stats.shots_per_attack > 1 ? `${minDamage} (x${ability.stats.shots_per_attack})` : minDamage} 
                            highlight 
                          />
                          <StatRow 
                            label="Max Damage" 
                            value={ability.stats.shots_per_attack > 1 ? `${maxDamage} (x${ability.stats.shots_per_attack})` : maxDamage} 
                            highlight 
                          />
                          <StatRow label="Offense" value={offense} highlight />
                          <StatRow label="Attack" value={`${totalAttack} (${weaponBaseAtk}+${ability.stats.attack})`} />
                          <StatRow label="Crit %" value={`${ability.stats.critical_hit_percent}%`} />
                          <StatRow label="Cooldown" value={ability.stats.ability_cooldown} />
                          <StatRow label="Ammo Required" value={ability.stats.ammo_required} />
                          <StatRow label="Range" value={`${ability.stats.min_range}-${ability.stats.max_range}`} />
                          {getLineOfFireLabel(ability.stats.line_of_fire) && (
                            <StatRow label="Line of Fire" value={getLineOfFireLabel(ability.stats.line_of_fire)!} />
                          )}
                          {ability.stats.armor_piercing_percent > 0 && (
                            <StatRow label="Armor Pierce" value={`${Math.round(ability.stats.armor_piercing_percent * 100)}%`} />
                          )}
                        </div>
                        
                        {/* Targets */}
                        {ability.stats.targets && ability.stats.targets.length > 0 && (() => {
                          const { canTarget, cannotTarget } = getTargetingCategories(ability.stats.targets);
                          return (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-muted-foreground">Targets:</span>
                              {canTarget.map(cat => (
                                <Badge 
                                  key={cat} 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
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
                                  className="text-xs bg-muted/50 text-muted-foreground line-through"
                                >
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          );
                        })()}
                        
                        {/* Weapon Stats */}
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Weapon: {t(weapon.name)}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                            <StatRow label="Base Min" value={weapon.stats.base_damage_min} />
                            <StatRow label="Base Max" value={weapon.stats.base_damage_max} />
                            <StatRow label="Ammo" value={weapon.stats.ammo === -1 ? "∞" : weapon.stats.ammo} />
                            <StatRow label="Reload" value={weapon.stats.reload_time ?? "-"} />
                          </div>
                        </div>
                        
                        {ability.stats.status_effects && Object.keys(ability.stats.status_effects).length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-2">Inflicts Status Effects:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(ability.stats.status_effects).map(([effectId, chance]) => {
                                const id = parseInt(effectId);
                                const displayName = getEffectDisplayNameTranslated(id);
                                const color = getEffectColor(id);
                                const iconUrl = getEffectIconUrl(id);
                                const duration = getEffectDuration(id);
                                return (
                                  <div 
                                    key={effectId} 
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-muted border"
                                    style={{ borderColor: color, borderLeftWidth: 3 }}
                                  >
                                    {iconUrl && (
                                      <img 
                                        src={iconUrl} 
                                        alt="" 
                                        className="h-4 w-4 object-contain"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    )}
                                    <span className="text-foreground font-medium">{displayName}</span>
                                    <span className="text-muted-foreground">({chance}%{duration > 0 ? `, ${duration}t` : ""})</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </StatSection>
          )}

          {/* Requirements */}
          {unit.requirements && (
            <StatSection title="Build Requirements" icon={<Coins className="h-4 w-4" />} defaultOpen>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(unit.requirements.cost).map(([resource, amount]) => (
                  <div key={resource} className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <img 
                        src={getResourceIconUrl(resource)} 
                        alt="" 
                        className="h-5 w-5 object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      {capitalize(resource)}
                    </span>
                    <span className="font-medium">{amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <img 
                      src={getResourceIconUrl("time")} 
                      alt="" 
                      className="h-5 w-5 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    Build Time
                  </span>
                  <span className="font-medium">{formatDuration(unit.requirements.build_time)}</span>
                </div>
              </div>
            </StatSection>
          )}

          {/* Healing */}
          {unit.healing && (
            <StatSection title="Healing" icon={<Wrench className="h-4 w-4" />} defaultOpen>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(unit.healing.heal_cost).map(([resource, amount]) => (
                  <div key={resource} className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <img 
                        src={getResourceIconUrl(resource)} 
                        alt="" 
                        className="h-5 w-5 object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      {capitalize(resource)}
                    </span>
                    <span className="font-medium">{amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <img 
                      src={getResourceIconUrl("time")} 
                      alt="" 
                      className="h-5 w-5 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    Heal Time
                  </span>
                  <span className="font-medium">{formatDuration(unit.healing.heal_time)}</span>
                </div>
              </div>
            </StatSection>
          )}
        </div>
      </main>
      <CompareBar />
    </div>
  );
}
