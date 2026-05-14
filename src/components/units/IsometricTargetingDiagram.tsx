import { cn } from "@/lib/utils";
import type { TargetArea } from "@/types/battleSimulator";
import { LineOfFireLabels } from "@/types/battleSimulator";
import { Badge } from "@/components/ui/badge";
import { getUnitById } from "@/lib/units";
import { getUnitImageUrl } from "@/lib/unitImages";

interface Props {
  targetArea?: TargetArea;
  lineOfFire: number;
  attackDirection: number;
  minRange: number;
  maxRange: number;
  isFixed: boolean;
  minDamage?: number;
  maxDamage?: number;
  shotsPerAttack?: number;
  attacksPerUse?: number;
  centerUnitId?: number;
  className?: string;
}

const CELL_PX = 64;
const GAP_PX = 3;

export function IsometricTargetingDiagram({
  targetArea,
  lineOfFire,
  attackDirection,
  minRange,
  maxRange,
  isFixed,
  minDamage,
  maxDamage,
  shotsPerAttack = 1,
  attacksPerUse = 1,
  centerUnitId = 709,
  className,
}: Props) {
  const positions = targetArea?.data ?? [];
  const isSingleTarget = !targetArea || (targetArea.targetType === 1 && positions.length === 0);
  const isRandom = !!targetArea?.random;
  const totalShots = Math.max(1, shotsPerAttack) * Math.max(1, attacksPerUse);

  const avgDamage =
    minDamage !== undefined && maxDamage !== undefined
      ? (minDamage + maxDamage) / 2
      : undefined;

  const totalWeight = isRandom
    ? positions.reduce((s, p) => s + (p.weight ?? 1), 0) || 1
    : 0;

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const p of positions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);

  type Cell = {
    damagePercent: number;
    perShotProb?: number;
    hitChance?: number;
    expectedHits: number;
    expectedDamage?: number;
  } | null;

  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null),
  );
  for (const p of positions) {
    const dmgPct = p.damagePercent ?? 100;
    const perShotProb = isRandom ? (p.weight ?? 1) / totalWeight : 1;
    const expectedHits = totalShots * perShotProb;
    const hitChance = isRandom ? 1 - Math.pow(1 - perShotProb, totalShots) : 1;
    const expectedDamage =
      avgDamage !== undefined ? (avgDamage * dmgPct / 100) * expectedHits : undefined;
    grid[p.y - minY][p.x - minX] = {
      damagePercent: dmgPct,
      perShotProb: isRandom ? perShotProb : undefined,
      hitChance: isRandom ? hitChance : undefined,
      expectedHits,
      expectedDamage,
    };
  }
  const centerX = -minX;
  const centerY = -minY;

  const cellPitch = CELL_PX + GAP_PX;
  const centerCx = centerX * cellPitch + CELL_PX / 2;
  const centerCy = centerY * cellPitch + CELL_PX / 2;
  const gridW = width * cellPitch - GAP_PX;
  const gridH = height * cellPitch - GAP_PX;

  const dummy = getUnitById(centerUnitId);
  const dummyIconUrl = dummy?.identity.icon ? getUnitImageUrl(dummy.identity.icon) : null;

  const fmt = (n: number) => (n >= 100 ? Math.round(n).toString() : n.toFixed(n >= 10 ? 0 : 1));

  return (
    <div className={cn("space-y-2 p-3 bg-muted/30 rounded-lg", className)}>
      <div className="text-xs font-semibold text-foreground/90 text-center">AOE Pattern</div>
      <div className="flex flex-wrap gap-1 justify-center">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {LineOfFireLabels[lineOfFire] || "Direct"}
        </Badge>
        {attackDirection === 2 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-300 border-purple-500/50">
            Back Attack
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Range {minRange}-{maxRange}
        </Badge>
        {isFixed && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-300 border-amber-500/50">
            Fixed
          </Badge>
        )}
        {isRandom && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sky-500/20 text-sky-300 border-sky-500/50">
            Random
          </Badge>
        )}
        {isSingleTarget && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Single Target
          </Badge>
        )}
      </div>

      <div className="relative mx-auto" style={{ width: gridW, height: gridH }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${width}, ${CELL_PX}px)`,
            gridTemplateRows: `repeat(${height}, ${CELL_PX}px)`,
            gap: `${GAP_PX}px`,
          }}
        >
          {grid.map((row, y) =>
            row.map((cell, x) => {
              const isCenter = x === centerX && y === centerY;
              const hit = cell !== null;
              return (
                <div
                  key={`${x}-${y}`}
                  className={cn(
                    "flex flex-col items-center justify-center text-center select-none leading-tight rounded-sm",
                    isCenter && hit && "border-2 border-yellow-400 bg-yellow-500/40 text-yellow-50",
                    isCenter && !hit && "border-2 border-yellow-400 bg-yellow-500/10",
                    !isCenter && hit && "border border-red-400/80 bg-red-500/45 text-white",
                    !isCenter && !hit && "border border-muted-foreground/15 bg-transparent",
                  )}
                >
                  {hit && cell && (
                    <>
                      {cell.expectedDamage !== undefined ? (
                        <span className="text-[13px] font-bold">{fmt(cell.expectedDamage)}</span>
                      ) : (
                        <span className="text-[11px] font-bold">{cell.damagePercent}%</span>
                      )}
                      {cell.hitChance !== undefined && (
                        <span className="text-[9px] font-medium opacity-90">
                          {(cell.hitChance * 100).toFixed(cell.hitChance * 100 >= 10 ? 0 : 1)}%
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            }),
          )}
        </div>

        {dummyIconUrl && (
          <img
            src={dummyIconUrl}
            alt={dummy?.identity.name || "Target"}
            className="absolute pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]"
            style={{
              left: centerCx,
              top: centerCy,
              transform: "translate(-50%, -55%)",
              width: CELL_PX * 0.45,
              opacity: 0.85,
              height: "auto",
              imageRendering: "pixelated",
            }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 border border-yellow-400 bg-yellow-500/40 rounded-sm" />
          <span>Target</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 border border-red-400/80 bg-red-500/45 rounded-sm" />
          <span>{isFixed ? "Hit Area" : "Splash"}</span>
        </div>
        {avgDamage !== undefined && (
          <div className="flex items-center gap-1">
            <span>
              Avg {fmt(avgDamage)}/shot × {totalShots} shot{totalShots === 1 ? "" : "s"}
              {isRandom ? " (% = chance to be hit at least once)" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
