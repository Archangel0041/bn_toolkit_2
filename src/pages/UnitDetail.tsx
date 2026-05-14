import { useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { CompareBar } from "@/components/units/CompareBar";
import { StatSection, StatRow, DamageModsGrid } from "@/components/units/StatSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  ArrowLeft, Swords, Clock, Coins, Wrench, Plus, Check, Activity, Shield, Film
} from "lucide-react";
import { UnitAnimationViewer } from "@/components/units/UnitAnimationViewer";
import { IsometricTargetingDiagram } from "@/components/units/IsometricTargetingDiagram";
import { getUnitAbilities } from "@/lib/battleCalculations";
import { UnitTag, UnitTagLabels } from "@/data/gameEnums";
import { expandTargetTags } from "@/lib/tagHierarchy";

// Detailed targeting categories - all unit class types
const TARGETING_CATEGORIES: { tag: number; label: string; color: string }[] = [
  { tag: 39, label: "Air", color: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/50" },
  { tag: 9, label: "LTA", color: "bg-sky-400/20 text-sky-600 dark:text-sky-400 border-sky-400/50" },
  { tag: 52, label: "Aircraft", color: "bg-sky-300/20 text-sky-600 dark:text-sky-400 border-sky-300/50" },
  { tag: 23, label: "Helicopter", color: "bg-sky-200/20 text-sky-600 dark:text-sky-400 border-sky-200/50" },
  { tag: 24, label: "Ground", color: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50" },
  { tag: 6, label: "Soldier", color: "bg-amber-400/20 text-amber-600 dark:text-amber-400 border-amber-400/50" },
  { tag: 46, label: "Sniper", color: "bg-amber-300/20 text-amber-600 dark:text-amber-400 border-amber-300/50" },
  { tag: 11, label: "Vehicle", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50" },
  { tag: 20, label: "Tank", color: "bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 border-emerald-400/50" },
  { tag: 15, label: "Sea", color: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/50" },
  { tag: 29, label: "Ship", color: "bg-blue-400/20 text-blue-600 dark:text-blue-400 border-blue-400/50" },
  { tag: 8, label: "Sub", color: "bg-blue-300/20 text-blue-600 dark:text-blue-400 border-blue-300/50" },
  { tag: 26, label: "Metal", color: "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/50" },
  { tag: 38, label: "Critter", color: "bg-lime-500/20 text-lime-700 dark:text-lime-300 border-lime-500/50" },
  { tag: 41, label: "Civilian", color: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50" },
  { tag: 55, label: "Structure", color: "bg-stone-500/20 text-stone-700 dark:text-stone-300 border-stone-500/50" },
];

function getTargetingCategories(targets: number[]): { canTarget: { label: string; color: string }[]; cannotTarget: { label: string; color: string }[] } {
  const expandedTargets = expandTargetTags(targets);
  const canTarget: { label: string; color: string }[] = [];
  const cannotTarget: { label: string; color: string }[] = [];
  
  // Check if targets Unit (51) which means everything, or empty targets
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

// Calculate damage at rank: 
// Formula: base_damage * damage_from_weapon * (1 + 2 * damage_from_unit * power / 100)
// Floor after each multiplication involving decimal values
function calculateDamageAtRank(baseDamage: number, power: number, damageFromWeapon?: number, damageFromUnit?: number): number {
  const scaledBase = damageFromWeapon !== undefined && damageFromWeapon !== 1 
    ? Math.floor(baseDamage * damageFromWeapon) 
    : baseDamage;
  const powerMultiplier = damageFromUnit !== undefined && damageFromUnit !== 1
    ? Math.floor(2 * damageFromUnit * power)
    : 2 * power;
  return Math.floor(scaledBase * (1 + powerMultiplier / 100));
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

  // Targeting/range info per ability (from the simulator's data pipeline).
  const abilityInfoMap = (() => {
    const map: Record<number, ReturnType<typeof getUnitAbilities>[number]> = {};
    try {
      for (const info of getUnitAbilities(unit.id, selectedRank)) {
        map[info.abilityId] = info;
      }
    } catch (e) {
      console.warn("getUnitAbilities failed", e);
    }
    return map;
  })();

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

          {/* Weapons & Abilities */}
          {unit.weapons?.weapons && Object.keys(unit.weapons.weapons).length > 0 && (
            <StatSection title="Weapons & Abilities" icon={<Swords className="h-4 w-4" />} defaultOpen>
              <div className="space-y-6">
                {Object.entries(unit.weapons.weapons).map(([weaponKey, weapon]) => (
                  <div key={weaponKey} className="border rounded-lg overflow-hidden">
                    {/* Weapon Header */}
                    <div className="bg-muted/70 p-3 border-b">
                      <h4 className="font-medium mb-2">{t(weapon.name)}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                        <StatRow label="Base Min" value={weapon.stats.base_damage_min} />
                        <StatRow label="Base Max" value={weapon.stats.base_damage_max} />
                        <StatRow label="Base Attack" value={weapon.stats.base_atk} />
                        <StatRow label="Base Crit" value={`${weapon.stats.base_crit_percent}%`} />
                        <StatRow label="Ammo" value={weapon.stats.ammo === -1 ? "∞" : weapon.stats.ammo} />
                        <StatRow label="Reload" value={weapon.stats.reload_time ? `${weapon.stats.reload_time}t` : "-"} />
                      </div>
                    </div>
                    
                    {/* Abilities for this weapon */}
                    <div className="divide-y">
                      {weapon.abilities.map((abilId) => {
                        const ability = getAbilityById(abilId);
                        if (!ability) return null;
                        const abilityIconUrl = getAbilityImageUrl(ability.icon);
                        const damageType = ability.stats.damage_type;
                        const damageTypeName = getDamageTypeName(damageType);
                        const damageTypeIconUrl = getDamageTypeIconUrl(damageType);
                        
                        // Calculate damage at current rank using power
                        const currentPower = stats?.power || 0;
                        const damageFromWeapon = (ability.stats as any)?.damage_from_weapon as number | undefined;
                        const damageFromUnit = (ability.stats as any)?.damage_from_unit as number | undefined;
                        const minDamage = calculateDamageAtRank(weapon.stats.base_damage_min, currentPower, damageFromWeapon, damageFromUnit);
                        const maxDamage = calculateDamageAtRank(weapon.stats.base_damage_max, currentPower, damageFromWeapon, damageFromUnit);
                        // Pre-calculate power multiplier for tooltips: 2 * damage_from_unit * power
                        const powerMultiplier = damageFromUnit !== undefined && damageFromUnit !== 1
                          ? Math.floor(2 * damageFromUnit * currentPower)
                          : 2 * currentPower;
                        
                        // Total attack = weapon base_atk + ability attack
                        const weaponBaseAtk = weapon.stats.base_atk || 0;
                        const totalAttack = weaponBaseAtk + ability.stats.attack;
                        // Calculate offense = total attack + unit accuracy
                        const offense = totalAttack + (stats?.accuracy || 0);
                        
                        // Calculate weapon crit contribution: floor(base_crit * crit_from_weapon)
                        const critFromWeapon = (ability.stats as any)?.crit_from_weapon as number | undefined;
                        const scaledWeaponCrit = critFromWeapon !== undefined && critFromWeapon !== 1 
                          ? Math.floor(weapon.stats.base_crit_percent * critFromWeapon) 
                          : weapon.stats.base_crit_percent;
                        const totalCrit = (stats?.critical || 0) + scaledWeaponCrit + ability.stats.critical_hit_percent;
                        
                        return (
                          <div key={abilId} className="p-4 bg-background">
                            <div className="flex items-center gap-3 mb-3">
                              {abilityIconUrl && (
                                <img 
                                  src={abilityIconUrl} 
                                  alt="" 
                                  className="h-10 w-10 rounded object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
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
                            <TooltipProvider>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-between py-1 font-medium text-primary">
                                    <span className="text-muted-foreground">Min Damage</span>
                                    <span>{ability.stats.shots_per_attack > 1 ? `${minDamage} (x${ability.stats.shots_per_attack})` : minDamage}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {weapon.stats.base_damage_min}{damageFromWeapon && damageFromWeapon !== 1 ? ` × ${damageFromWeapon}` : ''} × (1 + 2{damageFromUnit !== undefined && damageFromUnit !== 1 ? ` × ${damageFromUnit}` : ''} × {currentPower} / 100)
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-between py-1 font-medium text-primary">
                                    <span className="text-muted-foreground">Max Damage</span>
                                    <span>{ability.stats.shots_per_attack > 1 ? `${maxDamage} (x${ability.stats.shots_per_attack})` : maxDamage}</span>
                                  </div>
                              </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {weapon.stats.base_damage_max}{damageFromWeapon && damageFromWeapon !== 1 ? ` × ${damageFromWeapon}` : ''} × (1 + 2{damageFromUnit !== undefined && damageFromUnit !== 1 ? ` × ${damageFromUnit}` : ''} × {currentPower} / 100)
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-between py-1 font-medium text-primary">
                                    <span className="text-muted-foreground">Offense</span>
                                    <span>{offense}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Attack: {totalAttack} + Accuracy: {stats?.accuracy || 0}</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">Attack</span>
                                    <span>{totalAttack}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Weapon: {weaponBaseAtk} + Ability: {ability.stats.attack}</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-between py-1 font-medium text-primary">
                                    <span className="text-muted-foreground">Crit %</span>
                                    <span>{totalCrit}%</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Unit: {stats?.critical || 0}% + Weapon: {weapon.stats.base_crit_percent}%
                                    {critFromWeapon !== undefined && critFromWeapon !== 1 && ` × ${critFromWeapon} = ${scaledWeaponCrit}%`}
                                    {' '}+ Ability: {ability.stats.critical_hit_percent}%
                                  </p>
                                </TooltipContent>
                              </Tooltip>
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
                            </TooltipProvider>
                            
                            {/* Targets + AOE Pattern side-by-side */}
                            {(() => {
                              const info = abilityInfoMap[abilId];
                              const hasTargets = ability.stats.targets && ability.stats.targets.length > 0;
                              if (!info && !hasTargets) return null;
                              const cats = hasTargets ? getTargetingCategories(ability.stats.targets) : null;
                              return (
                                <div className="mt-3 flex flex-wrap items-stretch gap-3">
                                  {cats && (
                                    <div className="flex-1 min-w-[220px] p-3 bg-muted/30 rounded-lg flex flex-col">
                                      <div className="text-xs font-semibold text-muted-foreground mb-2">Targets</div>
                                      <div className="flex items-start gap-1.5 flex-wrap">
                                        {cats.canTarget.map(cat => (
                                          <Badge
                                            key={cat.label}
                                            variant="outline"
                                            className={cn("text-xs", cat.color)}
                                          >
                                            ✓ {cat.label}
                                          </Badge>
                                        ))}
                                        {cats.cannotTarget.map(cat => (
                                          <Badge
                                            key={cat.label}
                                            variant="outline"
                                            className="text-xs bg-muted/50 text-muted-foreground line-through"
                                          >
                                            {cat.label}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {info && (
                                    <IsometricTargetingDiagram
                                      targetArea={info.targetArea}
                                      lineOfFire={info.lineOfFire}
                                      attackDirection={info.attackDirection}
                                      minRange={info.minRange}
                                      maxRange={info.maxRange}
                                      isFixed={info.isFixed}
                                      minDamage={info.minDamage}
                                      maxDamage={info.maxDamage}
                                      shotsPerAttack={info.shotsPerAttack}
                                      attacksPerUse={info.attacksPerUse}
                                      className="shrink-0"
                                    />
                                  )}
                                </div>
                              );
                            })()}
                            
                            {/* Critical Bonuses */}
                            {(() => {
                              const critBonuses = (ability.stats as any)?.critical_bonuses as Record<string, number> | undefined;
                              if (!critBonuses || Object.keys(critBonuses).length === 0) return null;
                              return (
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm text-muted-foreground">Crit Bonus:</span>
                                  {Object.entries(critBonuses).map(([tagId, bonus]) => {
                                    const tagLabel = UnitTagLabels[parseInt(tagId)] || `Tag ${tagId}`;
                                    return (
                                      <Badge 
                                        key={tagId} 
                                        variant="outline" 
                                        className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/50"
                                      >
                                        {bonus > 0 ? `+${bonus}` : bonus}% vs {tagLabel}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                            
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

                            {(() => {
                              const wname = t(weapon.name);
                              const hasAnim = (weapon.frontattack_animation || weapon.backattack_animation) && unit.identity.icon;
                              if (!hasAnim) return null;

                              const lbls: Record<string, string> = {};
                              const names: string[] = [];
                              if (weapon.backattack_animation) {
                                lbls[weapon.backattack_animation] = `${wname} (Back)`;
                                names.push(weapon.backattack_animation);
                              }
                              if (weapon.frontattack_animation) {
                                lbls[weapon.frontattack_animation] = `${wname} (Front)`;
                                names.push(weapon.frontattack_animation);
                              }
                              return (
                                <div className="mt-3 pt-3 border-t">
                                  <UnitAnimationViewer
                                    iconName={unit.identity.icon}
                                    labelMap={lbls}
                                    filterNames={names}
                                    groups={[{ title: "", names }]}
                                    compact
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </StatSection>
          )}

          {/* Requirements */}
          {unit.requirements?.cost && (
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
          {unit.healing?.heal_cost && (
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

          {/* Animations - at the bottom, fetched on mount */}
          {unit.identity.icon && (() => {
            const animLabels: Record<string, string> = {};
            const animGroups: Array<{ title: string; names: string[] }> = [];

            const idleNames: string[] = [];
            if (unit.animation?.back_idle) {
              animLabels[unit.animation.back_idle] = "Idle (Back)";
              idleNames.push(unit.animation.back_idle);
            }
            if (unit.animation?.front_idle) {
              animLabels[unit.animation.front_idle] = "Idle (Front)";
              idleNames.push(unit.animation.front_idle);
            }
            if (idleNames.length) animGroups.push({ title: "Idle", names: idleNames });

            if (unit.weapons?.weapons) {
              for (const weapon of Object.values(unit.weapons.weapons)) {
                const abilityNames = weapon.abilities
                  .map((aid) => {
                    const a = getAbilityById(aid);
                    return a ? t(a.name) : null;
                  })
                  .filter(Boolean)
                  .join(", ");
                const wname = t(weapon.name);
                const title = abilityNames ? `${wname} — ${abilityNames}` : wname;
                const names: string[] = [];
                if (weapon.backattack_animation) {
                  animLabels[weapon.backattack_animation] = `${wname} (Back)`;
                  names.push(weapon.backattack_animation);
                }
                if (weapon.frontattack_animation) {
                  animLabels[weapon.frontattack_animation] = `${wname} (Front)`;
                  names.push(weapon.frontattack_animation);
                }
                if (names.length) animGroups.push({ title, names });
              }
            }
            return (
              <StatSection title="Animations" icon={<Film className="h-4 w-4" />} defaultOpen>
                <UnitAnimationViewer
                  iconName={unit.identity.icon}
                  labelMap={animLabels}
                  groups={animGroups}
                />
              </StatSection>
            );
          })()}
        </div>
      </main>
      <CompareBar />
    </div>
  );
}
