import { cn } from "@/lib/utils";
import type { TargetArea } from "@/types/battleSimulator";
import { LineOfFireLabels } from "@/types/battleSimulator";
import { AttackDirectionLabels } from "@/data/gameEnums";
import { Badge } from "@/components/ui/badge";

interface TargetingPatternDiagramProps {
  targetArea?: TargetArea;
  lineOfFire: number;
  attackDirection: number;
  minRange: number;
  maxRange: number;
  isFixed: boolean;
  className?: string;
}

export function TargetingPatternDiagram({ 
  targetArea, 
  lineOfFire, 
  attackDirection, 
  minRange, 
  maxRange, 
  isFixed,
  className 
}: TargetingPatternDiagramProps) {
  // Show single target info if no AOE pattern
  const isSingleTarget = !targetArea || 
    (targetArea.targetType === 1 && !isFixed) || 
    targetArea.data.length === 0;

  return (
    <div className={cn("space-y-2 p-2 bg-muted/30 rounded-lg", className)}>
      {/* Targeting mode badges */}
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
      </div>

      {/* Pattern visualization */}
      {isSingleTarget ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-yellow-500 bg-yellow-500/30 rounded-sm" />
          <span className="text-xs text-muted-foreground">Single Target</span>
        </div>
      ) : (
        <PatternGrid targetArea={targetArea!} isFixed={isFixed} />
      )}
    </div>
  );
}

function PatternGrid({ targetArea, isFixed }: { targetArea: TargetArea; isFixed: boolean }) {
  const positions = targetArea.data;
  if (positions.length === 0) return null;

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const pos of positions) {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  }

  // Always include center (0,0) in bounds for movable AOE
  if (!isFixed) {
    minX = Math.min(minX, 0);
    maxX = Math.max(maxX, 0);
    minY = Math.min(minY, 0);
    maxY = Math.max(maxY, 0);
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  // Create a grid of the pattern
  const grid: (number | null)[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = null;
    }
  }

  // Fill in the pattern positions
  for (const pos of positions) {
    const gridX = pos.x - minX;
    const gridY = pos.y - minY;
    if (gridY >= 0 && gridY < height && gridX >= 0 && gridX < width) {
      grid[gridY][gridX] = pos.damagePercent || 100;
    }
  }

  // Mark center (only for movable AOE)
  const centerX = 0 - minX;
  const centerY = 0 - minY;
  const hasCenter = !isFixed && centerX >= 0 && centerX < width && centerY >= 0 && centerY < height;

  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">
        {isFixed ? "Fixed Pattern:" : "AOE Pattern:"}
      </span>
      <div 
        className="inline-grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
      >
        {grid.map((row, y) =>
          row.map((dmgPercent, x) => {
            const isCenter = hasCenter && x === centerX && y === centerY;
            const hasValue = dmgPercent !== null;
            
            return (
              <div
                key={`${x}-${y}`}
                className={cn(
                  "w-4 h-4 rounded-sm text-[6px] flex items-center justify-center font-bold",
                  isCenter && hasValue && "border-2 border-yellow-500 bg-yellow-500/40 text-yellow-200",
                  isCenter && !hasValue && "border-2 border-yellow-500 bg-yellow-500/40",
                  !isCenter && hasValue && "border border-orange-500/70 bg-orange-500/30 text-orange-200",
                  !isCenter && !hasValue && "border border-muted-foreground/20 bg-transparent"
                )}
              >
                {hasValue && dmgPercent !== 100 && dmgPercent}
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {hasCenter && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 border border-yellow-500 bg-yellow-500/40 rounded-sm" />
            <span>Target</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 border border-orange-500/70 bg-orange-500/30 rounded-sm" />
          <span>{isFixed ? "Hit Area" : "Splash"}</span>
        </div>
      </div>
    </div>
  );
}
