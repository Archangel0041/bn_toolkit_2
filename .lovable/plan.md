## Goal
Add a "Rank Up Costs & Rewards" section to the unit detail page (`src/pages/UnitDetail.tsx`) that shows, for every rank of the selected unit, the resources required to level up to that rank (SP + any others) and the rewards granted (XP, SP, gold).

## Data source
Already in `unit.statsConfig.stats[]` (one entry per rank). Per-rank fields used:
- `level_up_cost: Record<string, number>` — cost to reach this rank (includes `sp` when applicable).
- `level_up_time: number` — duration.
- `level_up_rewards: { xp?: number }` — XP awarded.
- `rewards: { sp?: number; gold?: number }` — SP/gold awarded.

No type changes needed (already declared in `src/types/units.ts`).

## UI
New collapsible `StatSection` titled **"Rank Up Costs & Rewards"** placed right after the existing "Build Requirements" section (~line 691 of `UnitDetail.tsx`), open by default when any rank has `level_up_cost` or rewards.

Render a compact responsive table:

```text
Rank | Cost (icons + amounts) | Time | Rewards (XP / SP / Gold icons)
  2  | 🪙 500  ⭐ 100         | 1h   | XP 250
  3  | 🪙 1,200 ⭐ 250        | 4h   | XP 600, ⭐ 50
 ...
```

- Rank column: rank number (skip rank 1 since it has no level-up cost — or show it grayed as "base").
- Cost cell: iterate `level_up_cost` entries, each as `<img getResourceIconUrl(key) /> amount` (same pattern as Build Requirements lines 663–676).
- Time cell: `formatDuration(stat.level_up_time)`.
- Rewards cell: show XP from `level_up_rewards.xp`, SP from `rewards.sp`, gold from `rewards.gold`, each with its resource icon. Hide entries that are 0/undefined.

Mobile (≤640px): stack as cards instead of a table to stay readable at 430px viewport.

## Technical notes
- Pure presentational change in `src/pages/UnitDetail.tsx`; reuses `getResourceIconUrl`, `formatDuration`, `StatSection`, and `Coins`/`Star`-style lucide icons already imported.
- No data loader, store, or type edits. No new files unless the table gets large enough to warrant extracting a `RankUpTable` subcomponent — extract only if the JSX exceeds ~60 lines.
- Hide the section entirely if every rank lacks both `level_up_cost` and rewards.

## Out of scope
- Editing the existing per-rank stats viewer.
- Aggregating cumulative cost (could be a follow-up: "Total SP to max rank" summary row).
- Changes to other pages (Compare, Encounters, etc.).