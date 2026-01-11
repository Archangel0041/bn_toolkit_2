import { Link, useLocation } from "react-router-dom";
import { GRID_LAYOUT, type EncounterUnit } from "@/types/encounters";
import { getUnitById } from "@/lib/units";
import { getAbilityById } from "@/lib/abilities";
import { UnitImage } from "@/components/units/UnitImage";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { statIcons } from "@/lib/statIcons";
import { getAbilityImageUrl } from "@/lib/abilityImages";
import { getDamageTypeName, getDamageTypeIconUrl } from "@/lib/damageImages";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface EncounterGridProps {
  units: EncounterUnit[];
  showPlayerUnits?: EncounterUnit[];
  compact?: boolean;
  backPath?: string;
  backLabel?: string;
}

// Calculate damage at rank: Damage = Base Damage * (1 + 2 * 0.01 * Power)
function calculateDamageAtRank(baseDamage: number, power: number): number {
  return Math.floor(baseDamage * (1 + 2 * 0.01 * power));
}

export function EncounterGrid({ units, showPlayerUnits, compact = false, backPath, backLabel }: EncounterGridProps) {
  const { t } = useLanguage();
  const location = useLocation();

  const getUnitAtPosition = (gridId: number): EncounterUnit | undefined => {
    return units.find(u => u.grid_id === gridId);
  };

  const getPlayerUnitAtPosition = (gridId: number): EncounterUnit | undefined => {
    return showPlayerUnits?.find(u => u.grid_id === gridId);
  };

  const renderSlot = (gridId: number) => {
    const encounterUnit = getUnitAtPosition(gridId);
    const playerUnit = getPlayerUnitAtPosition(gridId);
    const unit = encounterUnit || playerUnit;
    const isPlayer = !!playerUnit && !encounterUnit;

    const slotSize = compact ? "w-12 h-12" : "w-16 h-16 sm:w-20 sm:h-20";
    
    if (!unit) {
      return (
        <div
          key={gridId}
          className={cn(
            slotSize,
            "border border-dashed border-muted-foreground/20 rounded-md"
          )}
        />
      );
    }

    const unitData = getUnitById(unit.unit_id);
    const unitName = unitData ? t(unitData.identity.name) : `Unit ${unit.unit_id}`;
    
    // Get max rank stats
    const allStats = unitData?.statsConfig?.stats || [];
    const maxRank = allStats.length;
    const stats = maxRank > 0 ? allStats[maxRank - 1] : undefined;

    // Get abilities with damage info
    const weapons = unitData?.weapons?.weapons;
    const abilitiesInfo = weapons ? Object.entries(weapons).flatMap(([_, weapon]) =>
      weapon.abilities.map(abilId => {
        const ability = getAbilityById(abilId);
        if (!ability) return null;
        const minDmg = calculateDamageAtRank(weapon.stats.base_damage_min, stats?.power || 0);
        const maxDmg = calculateDamageAtRank(weapon.stats.base_damage_max, stats?.power || 0);
        // Total attack = weapon base_atk + ability attack
        const totalAttack = (weapon.stats.base_atk || 0) + ability.stats.attack;
        const offense = totalAttack + (stats?.accuracy || 0);
        return { ability, minDmg, maxDmg, offense, weapon };
      }).filter(Boolean)
    ) : [];

    const unitSlot = (
      <div
        className={cn(
          slotSize,
          "border rounded-md flex items-center justify-center overflow-hidden transition-all hover:scale-105 hover:z-10 relative group cursor-pointer",
          isPlayer 
            ? "border-primary bg-primary/10" 
            : "border-destructive/50 bg-destructive/10"
        )}
      >
        {unitData ? (
          <UnitImage
            iconName={unitData.identity.icon}
            alt={unitName}
            className="w-full h-full"
          />
        ) : (
          <span className="text-xs text-center px-1">{unit.unit_id}</span>
        )}
      </div>
    );

    return (
      <HoverCard key={gridId} openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Link
            to={`/unit/${unit.unit_id}`}
            state={{ from: backPath || location.pathname, fromLabel: backLabel || "Back" }}
          >
            {unitSlot}
          </Link>
        </HoverCardTrigger>
        <HoverCardContent className="w-80 p-3" side="top">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {unitData && (
                <UnitImage
                  iconName={unitData.identity.icon}
                  alt={unitName}
                  className="w-10 h-10 rounded"
                />
              )}
              <div>
                <p className="font-semibold text-sm">{unitName}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {unit.unit_id}
                  {maxRank > 1 && ` • Rank 1-${maxRank}`}
                </p>
              </div>
            </div>
            
            {stats && (
              <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-xs border-t pt-2">
                <span className="flex items-center gap-1" title="HP">
                  <img src={statIcons.hp} alt="" className="h-3 w-3" />
                  {stats.hp}
                </span>
                <span className="flex items-center gap-1" title="Accuracy">
                  <img src={statIcons.accuracy} alt="" className="h-3 w-3" />
                  {stats.accuracy}
                </span>
                <span className="flex items-center gap-1" title="Defense">
                  <img src={statIcons.defense} alt="" className="h-3 w-3" />
                  {stats.defense}
                </span>
                <span className="flex items-center gap-1" title="Dodge">
                  <img src={statIcons.dodge} alt="" className="h-3 w-3" />
                  {stats.dodge}
                </span>
                <span className="flex items-center gap-1" title="Power">
                  <img src={statIcons.power} alt="" className="h-3 w-3" />
                  {stats.power}
                </span>
                <span className="flex items-center gap-1" title="Bravery">
                  <img src={statIcons.bravery} alt="" className="h-3 w-3" />
                  {stats.bravery}
                </span>
                <span className="flex items-center gap-1" title="Critical">
                  <img src={statIcons.critical} alt="" className="h-3 w-3" />
                  {stats.critical}%
                </span>
                <span className="flex items-center gap-1" title="PV">
                  <img src={statIcons.pv} alt="" className="h-3 w-3" />
                  {stats.pv}
                </span>
              </div>
            )}

            {abilitiesInfo.length > 0 && (
              <div className="border-t pt-2 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Abilities (Max Rank)</p>
                {abilitiesInfo.slice(0, 3).map((info, idx) => {
                  if (!info) return null;
                  const { ability, minDmg, maxDmg, offense } = info;
                  const iconUrl = getAbilityImageUrl(ability.icon);
                  const dmgTypeIcon = getDamageTypeIconUrl(ability.stats.damage_type);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 rounded p-1.5">
                      {iconUrl && (
                        <img src={iconUrl} alt="" className="w-6 h-6 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t(ability.name)}</p>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {dmgTypeIcon && <img src={dmgTypeIcon} alt="" className="w-3 h-3" />}
                          <span>Dmg: {minDmg}-{maxDmg}</span>
                          <span>• Off: {offense}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {abilitiesInfo.length > 3 && (
                  <p className="text-xs text-muted-foreground">+{abilitiesInfo.length - 3} more</p>
                )}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground text-center pt-1 border-t">
              Click to view full details
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Row 3 (back row): positions 13,12,11 - now at top */}
      <div className="flex gap-1">
        {GRID_LAYOUT.ROW_3.map(gridId => renderSlot(gridId))}
      </div>
      
      {/* Row 2 (middle): positions 9,8,7,6,5 */}
      <div className="flex gap-1">
        {GRID_LAYOUT.ROW_2.map(gridId => renderSlot(gridId))}
      </div>
      
      {/* Row 1 (front row): positions 4,3,2,1,0 - now at bottom */}
      <div className="flex gap-1">
        {GRID_LAYOUT.ROW_1.map(gridId => renderSlot(gridId))}
      </div>
    </div>
  );
}