import type { DamageResult } from "@/types/battleSimulator";
import { DAMAGE_TYPE_MAP } from "@/types/battleSimulator";

interface DamageBreakdownProps {
  damageResult: DamageResult;
  damageType: number;
  label?: string;
}

// Get damage type name from ID
function getDamageTypeName(damageType: number): string {
  const typeKey = DAMAGE_TYPE_MAP[damageType];
  if (!typeKey) return "Unknown";
  // Capitalize first letter
  return typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
}

// Format modifier as percentage
function formatModifier(modifier: number): string {
  const percentage = Math.round(modifier * 100);
  return `${percentage}%`;
}

export function DamageBreakdown({ damageResult, damageType, label = "Damage Calculation" }: DamageBreakdownProps) {
  const { breakdown } = damageResult;

  // If no breakdown available, don't render anything
  if (!breakdown) return null;

  const {
    baseDamage,
    baseHpMod,
    baseArmorMod,
    envMod,
    statusHpMod,
    statusArmorMod,
    finalHpMod,
    finalArmorMod,
    piercingDamage,
    armorableDamage,
    effectiveArmorCapacity,
    armorAbsorbed,
    overflowToHp,
    bypassedArmor,
  } = breakdown;

  const typeName = getDamageTypeName(damageType);

  return (
    <div className="space-y-1.5 text-xs border-t border-border/40 pt-1.5 mt-1.5">
      <p className="font-medium text-muted-foreground">{label}:</p>

      {/* Base Damage */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base {typeName} Damage:</span>
          <span className="font-mono">{baseDamage}</span>
        </div>
      </div>

      {/* Modifiers Section */}
      {(envMod > 0 || statusHpMod > 0 || statusArmorMod > 0) && (
        <div className="space-y-0.5 border-l-2 border-amber-500/50 pl-2">
          <p className="text-xs font-medium text-amber-500">Damage Modifiers:</p>

          {envMod > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environmental:</span>
              <span className="font-mono text-amber-400">{formatModifier(envMod)}</span>
            </div>
          )}

          {statusHpMod > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status (HP):</span>
              <span className="font-mono text-amber-400">{formatModifier(statusHpMod)}</span>
            </div>
          )}

          {statusArmorMod > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status (Armor):</span>
              <span className="font-mono text-amber-400">{formatModifier(statusArmorMod)}</span>
            </div>
          )}
        </div>
      )}

      {/* Resistances */}
      <div className="space-y-0.5 border-l-2 border-blue-500/50 pl-2">
        <p className="text-xs font-medium text-blue-400">Target Resistances:</p>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Base HP Resistance:</span>
          <span className="font-mono text-blue-300">{formatModifier(baseHpMod)}</span>
        </div>

        {!bypassedArmor && armorableDamage > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base Armor Resistance:</span>
            <span className="font-mono text-blue-300">{formatModifier(baseArmorMod)}</span>
          </div>
        )}

        <div className="flex justify-between items-center border-t border-border/30 pt-0.5 mt-0.5">
          <span className="text-muted-foreground">Final HP Modifier:</span>
          <span className="font-mono font-medium text-blue-200">{formatModifier(finalHpMod)}</span>
        </div>

        {!bypassedArmor && armorableDamage > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Final Armor Modifier:</span>
            <span className="font-mono font-medium text-blue-200">{formatModifier(finalArmorMod)}</span>
          </div>
        )}
      </div>

      {/* Armor Mechanics */}
      {!bypassedArmor && armorableDamage > 0 && (
        <div className="space-y-0.5 border-l-2 border-purple-500/50 pl-2">
          <p className="text-xs font-medium text-purple-400">Armor Mechanics:</p>

          {piercingDamage > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Armor Piercing:</span>
                <span className="font-mono text-red-400">{piercingDamage} (bypasses armor)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Armorable Damage:</span>
                <span className="font-mono">{armorableDamage}</span>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Effective Armor Capacity:</span>
            <span className="font-mono text-purple-300">{effectiveArmorCapacity}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Armor Absorbed:</span>
            <span className="font-mono text-purple-300">{armorAbsorbed}</span>
          </div>

          {overflowToHp > piercingDamage && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overflow to HP:</span>
              <span className="font-mono text-red-400">{overflowToHp - piercingDamage}</span>
            </div>
          )}
        </div>
      )}

      {bypassedArmor && (
        <div className="space-y-0.5 border-l-2 border-red-500/50 pl-2">
          <p className="text-xs font-medium text-red-400">Armor Bypassed (Unit Stunned)</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">All damage to HP:</span>
            <span className="font-mono text-red-300">{baseDamage}</span>
          </div>
        </div>
      )}

      {/* Final Damage Summary */}
      <div className="space-y-0.5 border-t border-border/40 pt-1 mt-1">
        <div className="flex justify-between font-medium">
          <span>Armor Damage:</span>
          <span className="font-mono text-yellow-400">{damageResult.armorDamage}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>HP Damage:</span>
          <span className="font-mono text-red-400">{damageResult.hpDamage}</span>
        </div>
        <div className="flex justify-between font-semibold text-sm border-t border-border/40 pt-0.5 mt-0.5">
          <span>Total Damage:</span>
          <span className="font-mono text-orange-400">{damageResult.armorDamage + damageResult.hpDamage}</span>
        </div>
      </div>
    </div>
  );
}
