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
  /** Unit ID to render (upright) at the target reticle. Defaults to the in-game dummy (709). */
  centerUnitId?: number;
  className?: string;
}

const CELL_PX = 38;
const GAP_PX = 2;

export function IsometricTargetingDiagram({
  targetArea,
  lineOfFire,
  attackDirection,
  minRange,
  maxRange,
  isFixed,
  centerUnitId = 709,
  className,
}: Props) {
  const positions = targetArea?.data ?? [];
  const isSingleTarget = !targetArea || (targetArea.targetType === 1 && positions.length === 0);

  // Always include the center (0,0) so the dummy can sit somewhere.
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const p of positions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);

  // Build a value grid: damage % for each occupied tile, null otherwise.
  const grid: (number | null)[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null),
  );
  for (const p of positions) {
    grid[p.y - minY][p.x - minX] = p.damagePercent ?? 100;
  }
  const centerX = -minX;
  const centerY = -minY;

  // Pixel position of the center cell within the un-tilted grid.
  const cellPitch = CELL_PX + GAP_PX;
  const centerCx = centerX * cellPitch + CELL_PX / 2;
  const centerCy = centerY * cellPitch + CELL_PX / 2;
  const gridW = width * cellPitch - GAP_PX;
  const gridH = height * cellPitch - GAP_PX;

  const dummy = getUnitById(centerUnitId);
  const dummyIconUrl = dummy?.identity.icon ? getUnitImageUrl(dummy.identity.icon) : null;

  // Outer canvas needs extra room for the rotated grid; rotated bbox ≈ (W+H)/√2.
  const outerW = Math.ceil((gridW + gridH) * 0.72) + 48;
  const outerH = Math.ceil((gridW + gridH) * 0.42) + 64;

  return (
    <div className={cn("space-y-2 p-2 bg-muted/30 rounded-lg", className)}>
      <div className="flex flex-wrap gap-1">
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
        {isSingleTarget && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Single Target
          </Badge>
        )}
      </div>

      <div
        className="relative mx-auto"
        style={{
          width: outerW,
          height: outerH,
          perspective: "800px",
        }}
      >
        {/* Tilted grid of attack tiles */}
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            width: gridW,
            height: gridH,
            transform: `translate(-50%, -50%) rotateX(55deg) rotateZ(-45deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${width}, ${CELL_PX}px)`,
              gridTemplateRows: `repeat(${height}, ${CELL_PX}px)`,
              gap: `${GAP_PX}px`,
              width: gridW,
              height: gridH,
            }}
          >
            {grid.map((row, y) =>
              row.map((dmg, x) => {
                const isCenter = x === centerX && y === centerY;
                const hit = dmg !== null;
                return (
                  <div
                    key={`${x}-${y}`}
                    className={cn(
                      "flex items-center justify-center text-[10px] font-bold select-none",
                      isCenter && hit && "border-2 border-yellow-400 bg-yellow-500/40 text-yellow-50",
                      isCenter && !hit && "border-2 border-yellow-400 bg-yellow-500/10",
                      !isCenter && hit && "border border-red-400/80 bg-red-500/45 text-white",
                      !isCenter && !hit && "border border-muted-foreground/15 bg-transparent",
                    )}
                  >
                    {hit && dmg !== 100 ? `${dmg}` : hit ? "100" : ""}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* Upright dummy unit positioned over the center tile.
            We project the cell center through the same rotation by leaving the
            tilted grid centered at the canvas center, then placing the dummy
            using the cell's offset from the grid center, rotated 45° in 2D
            (the rotateX foreshortens the Y axis to ~cos(55°) ≈ 0.574). */}
        {dummyIconUrl && (() => {
          const dx = (centerCx - gridW / 2);
          const dy = (centerCy - gridH / 2);
          // Rotate (dx, dy) by -45° in 2D, then squash Y by cos(55°).
          const ang = -45 * (Math.PI / 180);
          const cos = Math.cos(ang), sin = Math.sin(ang);
          const rx = dx * cos - dy * sin;
          const ry = (dx * sin + dy * cos) * Math.cos(55 * Math.PI / 180);
          return (
            <img
              src={dummyIconUrl}
              alt={dummy?.identity.name || "Target"}
              className="absolute pointer-events-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]"
              style={{
                left: `calc(50% + ${rx}px)`,
                top: `calc(50% + ${ry}px)`,
                transform: "translate(-50%, -75%)",
                width: CELL_PX * 1.4,
                height: "auto",
                imageRendering: "pixelated",
              }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          );
        })()}
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
      </div>
    </div>
  );
}
