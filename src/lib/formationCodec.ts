/**
 * Formation codec - encode/decode formations to shareable strings
 * Uses base64 encoding for compact sharing
 */

import type { PartyUnit } from "@/types/battleSimulator";
import type { CustomFormation } from "@/hooks/useCustomFormation";

// Compact format for party units: [unitId, gridId, rank]
type CompactUnit = [number, number, number];

// Compact party format
interface CompactParty {
  n: string; // name
  u: CompactUnit[]; // units
}

// Compact formation format
interface CompactFormation {
  n: string; // name
  l: number; // level
  w: CompactUnit[][]; // waves (array of unit arrays)
}

// ============= Party Encoding =============

export function encodeParty(units: PartyUnit[], name?: string): string {
  const compact: CompactParty = {
    n: name || "Shared Party",
    u: units.map(u => [u.unitId, u.gridId, u.rank]),
  };
  const json = JSON.stringify(compact);
  return btoa(json);
}

export function decodeParty(code: string): { name: string; units: PartyUnit[] } | null {
  try {
    const json = atob(code);
    const compact: CompactParty = JSON.parse(json);
    
    if (!compact.n || !Array.isArray(compact.u)) {
      throw new Error("Invalid format");
    }
    
    const units: PartyUnit[] = compact.u.map(([unitId, gridId, rank]) => ({
      unitId,
      gridId,
      rank,
    }));
    
    return { name: compact.n, units };
  } catch (e) {
    console.error("[FormationCodec] Failed to decode party:", e);
    return null;
  }
}

// ============= Formation Encoding =============

export function encodeFormation(formation: CustomFormation): string {
  const compact: CompactFormation = {
    n: formation.name,
    l: formation.level || 1,
    w: formation.waves.map(wave => 
      wave.units.map(u => [u.unit_id, u.grid_id, u.rank || 1])
    ),
  };
  const json = JSON.stringify(compact);
  return btoa(json);
}

export function decodeFormation(code: string): CustomFormation | null {
  try {
    const json = atob(code);
    const compact: CompactFormation = JSON.parse(json);
    
    if (!compact.n || !Array.isArray(compact.w)) {
      throw new Error("Invalid format");
    }
    
    const formation: CustomFormation = {
      name: compact.n,
      level: compact.l || 1,
      waves: compact.w.map(waveUnits => ({
        units: waveUnits.map(([unit_id, grid_id, rank], idx) => ({
          unit_id,
          grid_id,
          wave_number: idx,
          rank,
        })),
      })),
    };
    
    return formation;
  } catch (e) {
    console.error("[FormationCodec] Failed to decode formation:", e);
    return null;
  }
}

// ============= Clipboard helpers =============

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  }
}

export async function readFromClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
