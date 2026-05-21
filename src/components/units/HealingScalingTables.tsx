import { getResourceIconUrl } from "@/lib/resourceImages";
import {
  HealingBuildingGroup,
  getBuildingLevels,
  scaleHealCost,
  scaleHealTime,
  useCompositions,
} from "@/lib/healingBuildings";
import { cn } from "@/lib/utils";

interface Props {
  group: HealingBuildingGroup;
  baseHealCost: Record<string, number>;
  baseHealTime: number;
}

function formatSeconds(s: number): string {
  if (s <= 0) return "0s";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

function ScalingTable({
  title,
  variantLabel,
  levels,
  baseHealCost,
  baseHealTime,
  resources,
}: {
  title: string;
  variantLabel: "Normal" | "Advanced";
  levels: ReturnType<typeof getBuildingLevels>;
  baseHealCost: Record<string, number>;
  baseHealTime: number;
  resources: string[];
}) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-sm">
        <span className="font-semibold">{title}</span>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border",
            variantLabel === "Advanced"
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-muted text-muted-foreground border-border"
          )}
        >
          {variantLabel}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-2 py-1.5 w-10">Lvl</th>
              <th className="text-left font-medium px-2 py-1.5">Time</th>
              {resources.map((r) => (
                <th key={r} className="text-left font-medium px-2 py-1.5">
                  <span className="flex items-center gap-1">
                    <img
                      src={getResourceIconUrl(r)}
                      alt=""
                      className="h-4 w-4 object-contain"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                    <span className="capitalize">{r}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((lvl, i) => {
              const scaledCost = scaleHealCost(baseHealCost, lvl.input);
              const scaledTime = scaleHealTime(baseHealTime, lvl.time);
              const isMax = i === levels.length - 1;
              return (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border/50 last:border-b-0",
                    isMax && "bg-primary/5"
                  )}
                >
                  <td className="px-2 py-1.5 font-medium tabular-nums">{i + 1}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatSeconds(scaledTime)}</td>
                  {resources.map((r) => (
                    <td key={r} className="px-2 py-1.5 tabular-nums">
                      {(scaledCost[r] ?? 0).toLocaleString()}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HealingScalingTables({ group, baseHealCost, baseHealTime }: Props) {
  const compositions = useCompositions();
  const resources = Object.keys(baseHealCost);

  if (!compositions) {
    return (
      <div className="text-xs text-muted-foreground py-2">Loading building scaling…</div>
    );
  }

  const normalLevels = getBuildingLevels(compositions, group.normalId);
  const advancedLevels = getBuildingLevels(compositions, group.advancedId);

  if (normalLevels.length === 0 && advancedLevels.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Cost and time scale with {group.label} building level. Advanced variants reach
        lower minimums.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {normalLevels.length > 0 && (
          <ScalingTable
            title={`${group.label}`}
            variantLabel="Normal"
            levels={normalLevels}
            baseHealCost={baseHealCost}
            baseHealTime={baseHealTime}
            resources={resources}
          />
        )}
        {advancedLevels.length > 0 && (
          <ScalingTable
            title={`${group.label}`}
            variantLabel="Advanced"
            levels={advancedLevels}
            baseHealCost={baseHealCost}
            baseHealTime={baseHealTime}
            resources={resources}
          />
        )}
      </div>
    </div>
  );
}
