import { supabase } from "@/integrations/supabase/client";
import type { LiveBattleState, BattleTurn, LiveBattleUnit } from "@/types/liveBattle";
import type { PartyUnit } from "@/types/battleSimulator";
import type { Encounter } from "@/types/encounters";

const APP_VERSION = "1.0.0";

interface AnalyticsSession {
  sessionId: string;
  lastRecordedTurnIndex: number;
  closed: boolean;
}

let activeSession: AnalyticsSession | null = null;

function getClientSessionId(): string {
  let id = localStorage.getItem("ba_client_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ba_client_session_id", id);
  }
  return id;
}

function serializeFormation(units: LiveBattleUnit[] | PartyUnit[]) {
  return units.map(u => ({
    unitId: u.unitId,
    gridId: u.gridId,
    rank: u.rank,
  }));
}

function countDamaged(units: LiveBattleUnit[]) {
  return units.filter(u => u.currentHp < u.maxHp || u.currentArmor < u.maxArmor).length;
}

function countKilled(units: LiveBattleUnit[]) {
  return units.filter(u => u.isDead).length;
}

export async function startBattleAnalytics(params: {
  encounter: Encounter | null;
  encounterId?: string;
  friendlyParty: PartyUnit[];
  enemyUnits: LiveBattleUnit[];
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const friendlyFormation = params.friendlyParty.map(u => ({ unitId: u.unitId, gridId: u.gridId, rank: u.rank }));
    const enemyFormation = params.enemyUnits.map(u => ({ unitId: u.unitId, gridId: u.gridId, rank: u.rank }));

    const { data, error } = await supabase
      .from("battle_sessions")
      .insert({
        user_id: userId || null,
        client_session_id: getClientSessionId(),
        encounter_id: params.encounterId || null,
        encounter_name: params.encounter?.name || null,
        is_boss_strike: false,
        bs_points: null,
        outcome: null,
        total_turns: 0,
        player_units_total: params.friendlyParty.length,
        enemy_units_total: params.enemyUnits.length,
        player_units_damaged: 0,
        enemy_units_damaged: 0,
        player_units_killed: 0,
        enemy_units_killed: 0,
        player_formation: friendlyFormation as any,
        enemy_formation: enemyFormation as any,
        app_version: APP_VERSION,
        started_at: new Date().toISOString(),
        ended_at: null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[BattleAnalytics] Failed to start session:", error);
      return;
    }

    activeSession = {
      sessionId: data.id,
      lastRecordedTurnIndex: -1,
      closed: false,
    };
  } catch (err) {
    console.error("[BattleAnalytics] startBattleAnalytics error:", err);
  }
}

function serializeTurn(turn: BattleTurn, waveNumber: number) {
  return {
    turn_number: turn.turnNumber,
    wave_number: waveNumber,
    is_player_turn: turn.isPlayerTurn,
    actions: turn.actions.map(a => ({
      type: a.type,
      attackerGridId: a.attackerGridId,
      attackerName: a.attackerName,
      targetGridId: a.targetGridId,
      targetName: a.targetName,
      abilityId: a.abilityId,
      abilityName: a.abilityName,
      damage: a.damage,
      armorDamage: a.armorDamage,
      hpDamage: a.hpDamage,
      wasCrit: a.wasCrit,
      wasDodged: a.wasDodged,
      statusEffectId: a.statusEffectId,
      statusEffectName: a.statusEffectName,
      message: a.message,
      hitCount: a.hitCount,
    })) as any,
    summary: turn.summary as any,
  };
}

export async function recordAnalyticsTurns(state: LiveBattleState) {
  if (!activeSession || activeSession.closed) return;

  const newTurns = state.battleLog.slice(activeSession.lastRecordedTurnIndex + 1);
  if (newTurns.length === 0) return;

  try {
    const records = newTurns.map(turn => ({
      session_id: activeSession!.sessionId,
      ...serializeTurn(turn, state.currentWave + 1),
    }));

    const { error } = await supabase.from("battle_turn_events").insert(records);
    if (error) {
      console.error("[BattleAnalytics] Failed to record turns:", error);
      return;
    }

    activeSession.lastRecordedTurnIndex = state.battleLog.length - 1;
  } catch (err) {
    console.error("[BattleAnalytics] recordAnalyticsTurns error:", err);
  }
}

export async function closeBattleAnalytics(state: LiveBattleState) {
  if (!activeSession || activeSession.closed) return;

  await recordAnalyticsTurns(state);

  try {
    const outcome = state.isBattleOver
      ? state.isPlayerVictory
        ? "player_victory"
        : "enemy_victory"
      : "abandoned";

    const { error } = await supabase
      .from("battle_sessions")
      .update({
        outcome,
        total_turns: state.battleLog.length,
        player_units_damaged: countDamaged(state.friendlyUnits),
        enemy_units_damaged: countDamaged(state.enemyUnits),
        player_units_killed: countKilled(state.friendlyUnits),
        enemy_units_killed: countKilled(state.enemyUnits),
        ended_at: new Date().toISOString(),
      })
      .eq("id", activeSession.sessionId);

    if (error) {
      console.error("[BattleAnalytics] Failed to close session:", error);
      return;
    }

    activeSession.closed = true;
  } catch (err) {
    console.error("[BattleAnalytics] closeBattleAnalytics error:", err);
  }
}

export function clearActiveBattleAnalytics() {
  activeSession = null;
}
