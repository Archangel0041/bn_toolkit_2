import type { LiveBattleState } from "@/types/liveBattle";
import type { PartyUnit } from "@/types/battleSimulator";

const STORAGE_KEY = "live_battle_snapshots";

export interface BattleSnapshot {
  id: string;
  name: string;
  encounterId?: string;
  encounterName?: string;
  turn: number;
  wave: number;
  savedAt: number;
  formation: PartyUnit[];
  state: SerializedBattleState;
}

type SerializedBattleState = Omit<LiveBattleState, "friendlyCollapsedRows" | "enemyCollapsedRows"> & {
  friendlyCollapsedRows: number[];
  enemyCollapsedRows: number[];
};

function serialize(state: LiveBattleState): SerializedBattleState {
  return {
    ...state,
    friendlyCollapsedRows: Array.from(state.friendlyCollapsedRows ?? []),
    enemyCollapsedRows: Array.from(state.enemyCollapsedRows ?? []),
  };
}

export function deserializeBattleState(state: SerializedBattleState): LiveBattleState {
  return {
    ...state,
    friendlyCollapsedRows: new Set(state.friendlyCollapsedRows ?? []),
    enemyCollapsedRows: new Set(state.enemyCollapsedRows ?? []),
  } as LiveBattleState;
}

export function getBattleSnapshots(): BattleSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as BattleSnapshot[]) : [];
    return list.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveBattleSnapshot(params: {
  name: string;
  state: LiveBattleState;
  formation: PartyUnit[];
  encounterId?: string;
  encounterName?: string;
}): BattleSnapshot | null {
  try {
    const snapshot: BattleSnapshot = {
      id: crypto.randomUUID(),
      name: params.name,
      encounterId: params.encounterId,
      encounterName: params.encounterName,
      turn: params.state.currentTurn,
      wave: params.state.currentWave,
      savedAt: Date.now(),
      formation: params.formation,
      state: serialize(params.state),
    };
    const list = [snapshot, ...getBattleSnapshots()].slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return snapshot;
  } catch (error) {
    console.error("[BattleSnapshots] Failed to save snapshot:", error);
    return null;
  }
}

export function deleteBattleSnapshot(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getBattleSnapshots().filter(s => s.id !== id)));
  } catch (error) {
    console.error("[BattleSnapshots] Failed to delete snapshot:", error);
  }
}
