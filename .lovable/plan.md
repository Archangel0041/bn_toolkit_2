## Findings in `compositions.json`

Six healing buildings — Hospital, VRB, SRB — each Normal + Advanced. `building_upgrade_config.levels[]` has 10 entries with:
- `input` — % of base **heal cost** at that level
- `time` — % of base **heal time** at that level
- `upgrade_cost` / `upgrade_time` — cost to reach the **next** level (ignored on unit pages)

| ID | Building | Variant |
|----|----------|---------|
| 133 | Hospital | Normal |
| 134 | Hospital | Advanced |
| 142 | VRB | Normal |
| 143 | VRB | Advanced |
| 140 | SRB | Normal |
| 141 | SRB | Advanced |

## Plan

### 1. Data loading
- Add `loadCompositions()` to `src/lib/dataLoader.ts` (cached, version-aware).
- Wire into `GameDataContext` + `gameDataStore`.

### 2. `src/lib/healingBuildings.ts`
- Building ID constants grouped by unit tag → `{ normalId, advancedId }`.
- `getBuildingLevels(buildingId)` → 10-level `{ input, time }` (upgrade_cost/upgrade_time ignored).
- `scaleHealCost(baseCost, inputPct)` → `Math.ceil(amount * inputPct / 100)` per resource.
- `scaleHealTime(baseTime, timePct)` → `Math.ceil(baseTime * timePct / 100)`.
- `getApplicableBuildingGroup(unitTags)` → Hospital / VRB / SRB based on unit tags.

### 3. UnitDetail UI — "Healing scaling" tables
Rendered only for units whose tags include Hospital / VRB / SRB. Below the existing base `heal_cost` block.

Two tables (stacked on mobile, side-by-side on desktop), one Normal, one Advanced:

```
Lvl │ Heal time │ Cost
1   │  100s     │ 450 gold · 30 stone
...
10  │   40s     │ 150 gold · 10 stone
```

- Heal time = ceil-scaled, formatted seconds or mm:ss.
- Cost columns = each base `heal_cost` resource scaled by `input%` (ceiling), with `getResourceIconUrl` + `.toLocaleString()`.
- **No upgrade-cost columns shown** — that data is intentionally omitted from the unit page. Building-upgrade pricing is reserved for a future buildings view if needed.
- Subtle highlight on lvl-10 row.

### 4. Types
- `src/types/buildings.ts` with `BuildingUpgradeLevel { input?: number; time?: number; maximum_healing_queue_size?: number; upgrade_cost?: Record<string, number>; upgrade_time?: number; }` — full type kept for future reuse, but only `input` and `time` are read on the unit page.

### Technical notes
- Use `Math.ceil(base * pct / 100)` for both cost (per resource) and time, per latest direction (overrides project-default floor for this UI).
- Lvl-10 entries may omit `upgrade_cost`/`upgrade_time` — fine, we don't read them here.
- Compositions ≈ 950 KB — loaded once at startup with other configs.
- No changes to battle/heal logic elsewhere.
