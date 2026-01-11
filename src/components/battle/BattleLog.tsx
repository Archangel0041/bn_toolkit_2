import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sword, Shield, Skull, Zap, Wind, Target, Flame, Droplets, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BattleAction, BattleTurn, TurnSummary } from "@/types/liveBattle";

interface BattleLogProps {
  turns: BattleTurn[];
  currentTurn: number;
  className?: string;
}

function ActionIcon({ type, statusEffectName }: { type: BattleAction["type"]; statusEffectName?: string }) {
  switch (type) {
    case "attack":
      return <Sword className="h-3 w-3 text-red-500" />;
    case "dodge":
      return <Wind className="h-3 w-3 text-blue-400" />;
    case "crit":
      return <Target className="h-3 w-3 text-yellow-500" />;
    case "death":
      return <Skull className="h-3 w-3 text-red-600" />;
    case "status_applied":
      return <Zap className="h-3 w-3 text-purple-500" />;
    case "status_tick":
      // Use appropriate icon based on status effect type
      if (statusEffectName?.toLowerCase().includes("poison") || statusEffectName?.toLowerCase().includes("fire")) {
        return <Flame className="h-3 w-3 text-orange-500" />;
      }
      return <Droplets className="h-3 w-3 text-green-500" />;
    case "skip":
      return <Shield className="h-3 w-3 text-gray-400" />;
    default:
      return null;
  }
}

function formatUnitWithGrid(name: string | undefined, gridId: number | undefined, t: (key: string) => string): string {
  if (!name) return "";
  const localizedName = t(name);
  if (gridId !== undefined) {
    return `${localizedName} (${gridId})`;
  }
  return localizedName;
}

function TurnSummaryDisplay({ summary, isPlayerTurn }: { summary: TurnSummary; isPlayerTurn: boolean }) {
  const hasStats = summary.totalDamage > 0 || summary.dodges > 0 || summary.crits > 0 || summary.statusEffectsApplied > 0 || summary.kills > 0;
  
  if (!hasStats) return null;
  
  return (
    <div className={cn(
      "flex flex-wrap gap-2 mt-1 pt-1 border-t border-border/50 text-[10px]",
      isPlayerTurn ? "text-green-600" : "text-red-600"
    )}>
      <TrendingUp className="h-3 w-3" />
      {summary.totalHpDamage > 0 && (
        <span className="text-red-500">{summary.totalHpDamage} HP dmg</span>
      )}
      {summary.totalArmorDamage > 0 && (
        <span className="text-blue-500">{summary.totalArmorDamage} armor dmg</span>
      )}
      {summary.crits > 0 && (
        <span className="text-yellow-500">{summary.crits} crit{summary.crits > 1 ? 's' : ''}</span>
      )}
      {summary.dodges > 0 && (
        <span className="text-blue-400">{summary.dodges} dodge{summary.dodges > 1 ? 's' : ''}</span>
      )}
      {summary.statusEffectsApplied > 0 && (
        <span className="text-purple-500">{summary.statusEffectsApplied} effect{summary.statusEffectsApplied > 1 ? 's' : ''}</span>
      )}
      {summary.kills > 0 && (
        <span className="text-red-600">{summary.kills} kill{summary.kills > 1 ? 's' : ''}</span>
      )}
    </div>
  );
}

export function BattleLog({ turns, currentTurn, className }: BattleLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  // Auto-scroll to bottom when new turns are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length]);

  // Format action message with localization
  const formatActionMessage = (action: BattleAction): string => {
    const { type, message, hpDamage, armorDamage, statusEffectName, hitCount } = action;
    
    // For status_tick, format with HP and armor damage
    if (type === 'status_tick') {
      const damageParts: string[] = [];
      if (hpDamage && hpDamage > 0) damageParts.push(`${hpDamage} HP`);
      if (armorDamage && armorDamage > 0) damageParts.push(`${armorDamage} armor`);
      const damageText = damageParts.length > 0 ? damageParts.join(' and ') : '0';
      // Extract turns left from message if present
      const turnsMatch = message.match(/\((\d+)t left\)/);
      const turnsLeft = turnsMatch ? turnsMatch[1] : '?';
      return `took ${damageText} ${statusEffectName || 'DOT'} damage (${turnsLeft}t left)`;
    }
    
    // For death by status effect
    if (type === 'death' && statusEffectName) {
      return `defeated by ${statusEffectName}!`;
    }
    
    // For attack actions, show hit count if multi-hit
    if (type === 'attack' && hitCount && hitCount > 1) {
      return message;
    }
    
    return message;
  };

  return (
    <div className={cn("border rounded-lg", className)}>
      <div className="p-2 border-b bg-muted/50">
        <h3 className="text-sm font-semibold">Battle Log</h3>
      </div>
      <ScrollArea className="h-[200px]" ref={scrollRef}>
        <div className="p-2 space-y-2">
          {turns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Battle not started
            </p>
          ) : (
            turns.map((turn, turnIndex) => (
              <div
                key={turnIndex}
                className={cn(
                  "space-y-1",
                  turn.turnNumber === currentTurn && "bg-primary/10 -mx-2 px-2 py-1 rounded"
                )}
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs",
                    turn.isPlayerTurn ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                  )}>
                    Turn {turn.turnNumber}
                  </span>
                  <span className="text-muted-foreground">
                    {turn.isPlayerTurn ? "Player" : "Enemy"}
                  </span>
                </div>
                <div className="space-y-0.5 ml-2">
                  {turn.actions.map((action, actionIndex) => {
                    const attackerDisplay = formatUnitWithGrid(action.attackerName, action.attackerGridId, t);
                    const targetDisplay = formatUnitWithGrid(action.targetName, action.targetGridId, t);
                    const abilityDisplay = action.abilityName ? t(action.abilityName) : "";
                    
                    return (
                      <div
                        key={actionIndex}
                        className="flex items-start gap-1.5 text-xs"
                      >
                        <ActionIcon type={action.type} statusEffectName={action.statusEffectName} />
                        <span className="text-muted-foreground">
                          {attackerDisplay && targetDisplay && abilityDisplay && (
                            <span className="font-medium text-foreground">
                              {attackerDisplay} → {abilityDisplay} → {targetDisplay}:{" "}
                            </span>
                          )}
                          {attackerDisplay && !targetDisplay && abilityDisplay && (
                            <span className="font-medium text-foreground">
                              {attackerDisplay} → {abilityDisplay}:{" "}
                            </span>
                          )}
                          {/* Status tick: show unit name → effect name */}
                          {action.type === 'status_tick' && targetDisplay && action.statusEffectName && (
                            <span className="font-medium text-foreground">
                              {targetDisplay} → {action.statusEffectName}:{" "}
                            </span>
                          )}
                          {/* Death by status effect */}
                          {action.type === 'death' && !attackerDisplay && targetDisplay && (
                            <span className="font-medium text-foreground">
                              {targetDisplay}:{" "}
                            </span>
                          )}
                          {attackerDisplay && !abilityDisplay && action.type !== 'status_tick' && (
                            <span className="font-medium text-foreground">
                              {attackerDisplay}:{" "}
                            </span>
                          )}
                          {!attackerDisplay && abilityDisplay && (
                            <span className="font-medium text-foreground">
                              {abilityDisplay}:{" "}
                            </span>
                          )}
                          {action.hitCount && action.hitCount > 1 && (
                            <span className="text-purple-400 font-medium">[{action.hitCount}x] </span>
                          )}
                          {formatActionMessage(action)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Turn summary */}
                {turn.summary && <TurnSummaryDisplay summary={turn.summary} isPlayerTurn={turn.isPlayerTurn} />}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}