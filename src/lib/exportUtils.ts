/**
 * Export utilities for formations and battle logs
 */

import { getUnitById } from "@/lib/units";
import type { CustomFormation, CustomFormationUnit } from "@/hooks/useCustomFormation";
import type { BattleTurn, BattleAction } from "@/types/liveBattle";
import type { PartyUnit } from "@/types/battleSimulator";

// Download helper
function downloadTextFile(content: string, filename: string, mimeType: string = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============= Formation Export =============

interface FormationExportOptions {
  formation: CustomFormation;
  t: (key: string) => string;
}

export function exportFormationAsText({ formation, t }: FormationExportOptions): string {
  const lines: string[] = [];
  
  lines.push(`=== ${formation.name} ===`);
  lines.push(`Level: ${formation.level || 1}`);
  lines.push(`Total Waves: ${formation.waves.length}`);
  lines.push("");

  formation.waves.forEach((wave, waveIdx) => {
    lines.push(`--- Wave ${waveIdx + 1} (${wave.units.length} units) ---`);
    
    if (wave.units.length === 0) {
      lines.push("  (empty)");
    } else {
      // Sort units by grid position for clarity
      const sortedUnits = [...wave.units].sort((a, b) => a.grid_id - b.grid_id);
      
      sortedUnits.forEach(unit => {
        const unitData = getUnitById(unit.unit_id);
        const unitName = unitData ? t(unitData.identity.name) : `Unit ${unit.unit_id}`;
        const rank = unit.rank || 1;
        lines.push(`  [${unit.grid_id}] ${unitName} (ID: ${unit.unit_id}, Rank: ${rank})`);
      });
    }
    lines.push("");
  });

  return lines.join("\n");
}

export function exportFormationAsCode({ formation, t }: FormationExportOptions): string {
  const lines: string[] = [];
  
  lines.push("// Formation Export");
  lines.push(`// Name: ${formation.name}`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("const formation = {");
  lines.push(`  name: "${formation.name}",`);
  lines.push(`  level: ${formation.level || 1},`);
  lines.push("  waves: [");
  
  formation.waves.forEach((wave, waveIdx) => {
    lines.push(`    // Wave ${waveIdx + 1}`);
    lines.push("    {");
    lines.push("      units: [");
    
    wave.units.forEach((unit, unitIdx) => {
      const unitData = getUnitById(unit.unit_id);
      const unitName = unitData ? t(unitData.identity.name) : `Unit ${unit.unit_id}`;
      const comma = unitIdx < wave.units.length - 1 ? "," : "";
      lines.push(`        { unit_id: ${unit.unit_id}, grid_id: ${unit.grid_id}, rank: ${unit.rank || 1} }${comma} // ${unitName}`);
    });
    
    lines.push("      ]");
    lines.push(`    }${waveIdx < formation.waves.length - 1 ? "," : ""}`);
  });
  
  lines.push("  ]");
  lines.push("};");
  
  return lines.join("\n");
}

export function downloadFormationAsText(options: FormationExportOptions) {
  const content = exportFormationAsText(options);
  const filename = `${options.formation.name.replace(/\s+/g, "_")}_formation.txt`;
  downloadTextFile(content, filename);
}

export function downloadFormationAsCode(options: FormationExportOptions) {
  const content = exportFormationAsCode(options);
  const filename = `${options.formation.name.replace(/\s+/g, "_")}_formation.js`;
  downloadTextFile(content, filename, "text/javascript");
}

// ============= Party/Player Formation Export =============

interface PartyExportOptions {
  units: PartyUnit[];
  partyName?: string;
  t: (key: string) => string;
}

export function exportPartyAsText({ units, partyName, t }: PartyExportOptions): string {
  const lines: string[] = [];
  
  lines.push(`=== ${partyName || "Player Formation"} ===`);
  lines.push(`Total Units: ${units.length}`);
  lines.push("");
  
  if (units.length === 0) {
    lines.push("(empty formation)");
  } else {
    const sortedUnits = [...units].sort((a, b) => a.gridId - b.gridId);
    
    sortedUnits.forEach(unit => {
      const unitData = getUnitById(unit.unitId);
      const unitName = unitData ? t(unitData.identity.name) : `Unit ${unit.unitId}`;
      lines.push(`[${unit.gridId}] ${unitName} (ID: ${unit.unitId}, Rank: ${unit.rank})`);
    });
  }
  
  return lines.join("\n");
}

// ============= Battle Log Export =============

interface BattleLogExportOptions {
  turns: BattleTurn[];
  encounterInfo?: {
    id?: string | number;
    name?: string;
    level?: number;
  };
  playerFormation?: PartyUnit[];
  t: (key: string) => string;
}

function formatActionForExport(action: BattleAction, t: (key: string) => string): string {
  const attackerName = action.attackerName ? t(action.attackerName) : "";
  const targetName = action.targetName ? t(action.targetName) : "";
  const abilityName = action.abilityName ? t(action.abilityName) : "";
  
  let prefix = "";
  
  if (attackerName && action.attackerGridId !== undefined) {
    prefix += `${attackerName} [${action.attackerGridId}]`;
  } else if (attackerName) {
    prefix += attackerName;
  }
  
  if (abilityName) {
    prefix += prefix ? ` → ${abilityName}` : abilityName;
  }
  
  if (targetName && action.targetGridId !== undefined) {
    prefix += prefix ? ` → ${targetName} [${action.targetGridId}]` : `${targetName} [${action.targetGridId}]`;
  } else if (targetName) {
    prefix += prefix ? ` → ${targetName}` : targetName;
  }
  
  const hitCountPrefix = action.hitCount && action.hitCount > 1 ? `[${action.hitCount}x] ` : "";
  
  return prefix ? `${prefix}: ${hitCountPrefix}${action.message}` : `${hitCountPrefix}${action.message}`;
}

export function exportBattleLogAsText({ turns, encounterInfo, playerFormation, t }: BattleLogExportOptions): string {
  const lines: string[] = [];
  
  // Header
  lines.push("╔════════════════════════════════════════════════════════════╗");
  lines.push("║                    BATTLE LOG EXPORT                       ║");
  lines.push("╚════════════════════════════════════════════════════════════╝");
  lines.push("");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  
  if (encounterInfo) {
    lines.push("");
    lines.push("=== Encounter Info ===");
    if (encounterInfo.name) lines.push(`Name: ${encounterInfo.name}`);
    if (encounterInfo.id) lines.push(`ID: ${encounterInfo.id}`);
    if (encounterInfo.level) lines.push(`Level: ${encounterInfo.level}`);
  }
  
  if (playerFormation && playerFormation.length > 0) {
    lines.push("");
    lines.push("=== Player Formation ===");
    const sortedUnits = [...playerFormation].sort((a, b) => a.gridId - b.gridId);
    sortedUnits.forEach(unit => {
      const unitData = getUnitById(unit.unitId);
      const unitName = unitData ? t(unitData.identity.name) : `Unit ${unit.unitId}`;
      lines.push(`  [${unit.gridId}] ${unitName} (Rank ${unit.rank})`);
    });
  }
  
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("                         BATTLE TURNS                          ");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  
  if (turns.length === 0) {
    lines.push("(No battle data recorded)");
  } else {
    turns.forEach(turn => {
      const sideLabel = turn.isPlayerTurn ? "PLAYER" : "ENEMY";
      lines.push(`┌─── Turn ${turn.turnNumber} [${sideLabel}] ───────────────────────────────────`);
      
      if (turn.actions.length === 0) {
        lines.push("│  (no actions)");
      } else {
        turn.actions.forEach(action => {
          const icon = getActionIcon(action.type);
          const formatted = formatActionForExport(action, t);
          lines.push(`│  ${icon} ${formatted}`);
        });
      }
      
      if (turn.summary) {
        const { summary } = turn;
        const stats: string[] = [];
        if (summary.totalHpDamage > 0) stats.push(`${summary.totalHpDamage} HP dmg`);
        if (summary.totalArmorDamage > 0) stats.push(`${summary.totalArmorDamage} armor dmg`);
        if (summary.crits > 0) stats.push(`${summary.crits} crit${summary.crits > 1 ? "s" : ""}`);
        if (summary.dodges > 0) stats.push(`${summary.dodges} dodge${summary.dodges > 1 ? "s" : ""}`);
        if (summary.statusEffectsApplied > 0) stats.push(`${summary.statusEffectsApplied} effect${summary.statusEffectsApplied > 1 ? "s" : ""}`);
        if (summary.kills > 0) stats.push(`${summary.kills} kill${summary.kills > 1 ? "s" : ""}`);
        
        if (stats.length > 0) {
          lines.push(`│  ────────────────────────────────────────`);
          lines.push(`│  Summary: ${stats.join(" | ")}`);
        }
      }
      
      lines.push(`└──────────────────────────────────────────────────────────────`);
      lines.push("");
    });
  }
  
  // Battle result summary
  const lastTurn = turns[turns.length - 1];
  if (lastTurn) {
    const totalPlayerDamage = turns
      .filter(t => t.isPlayerTurn)
      .reduce((sum, t) => sum + (t.summary?.totalDamage || 0), 0);
    const totalEnemyDamage = turns
      .filter(t => !t.isPlayerTurn)
      .reduce((sum, t) => sum + (t.summary?.totalDamage || 0), 0);
    const totalPlayerKills = turns
      .filter(t => t.isPlayerTurn)
      .reduce((sum, t) => sum + (t.summary?.kills || 0), 0);
    const totalEnemyKills = turns
      .filter(t => !t.isPlayerTurn)
      .reduce((sum, t) => sum + (t.summary?.kills || 0), 0);
    
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push("                       BATTLE SUMMARY                          ");
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push(`Total Turns: ${turns.length}`);
    lines.push(`Player Total Damage: ${totalPlayerDamage}`);
    lines.push(`Enemy Total Damage: ${totalEnemyDamage}`);
    lines.push(`Player Kills: ${totalPlayerKills}`);
    lines.push(`Enemy Kills: ${totalEnemyKills}`);
  }
  
  return lines.join("\n");
}

function getActionIcon(type: BattleAction["type"]): string {
  switch (type) {
    case "attack": return "⚔️";
    case "dodge": return "💨";
    case "crit": return "🎯";
    case "death": return "💀";
    case "status_applied": return "⚡";
    case "status_tick": return "🔥";
    case "skip": return "⏭️";
    case "miss": return "⭕";
    case "out_of_range": return "🚫";
    case "blocked": return "🛡️";
    default: return "•";
  }
}

export function downloadBattleLog(options: BattleLogExportOptions) {
  const content = exportBattleLogAsText(options);
  const timestamp = new Date().toISOString().slice(0, 10);
  const encounterId = options.encounterInfo?.id || "custom";
  const filename = `battle_log_${encounterId}_${timestamp}.txt`;
  downloadTextFile(content, filename);
}
