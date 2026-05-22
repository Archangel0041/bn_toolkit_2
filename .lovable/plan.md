## Goal
Visually tag missions in the Mission Tree by the kind of task each one asks for (battle, job, train units, dialogue, collect, etc.) using small colored dots/stripes on each node. Multiple tags → multiple colors.

## Approach

### 1. Derive categories from parsed objectives
Each mission already has `objectives[]` with a `type` (the prereq `_t`) plus parsed fields (`jobId`, `encounterId(s)`, `opponentId`, `unitId`, `npcCompositionId`, `speakerNpcId`, `count`).

In `src/lib/missions.ts`, add a new helper + exported type:

```ts
export type MissionCategory =
  | "battle"        // encounter/opponent/attack-npc-building objectives
  | "job"           // complete job_id
  | "train"         // produce/train units (unit_id without combat)
  | "dialogue"      // speak-to / npc dialogue
  | "collect"       // gather resources
  | "build"         // build/upgrade structures
  | "other";        // anything we don't classify
```

Add `getMissionCategories(m: ParsedMission): MissionCategory[]` that maps each objective's `type` (and supporting fields) to a category, dedupes, and returns a stable-ordered list. Also expose a `MISSION_CATEGORY_META` record with `{ label, colorVar }` per category.

### 2. Design tokens for category colors
Add semantic HSL tokens in `src/index.css` (light + dark) and register them in `tailwind.config.ts`:

- `--mission-battle` (red)
- `--mission-job` (amber)
- `--mission-train` (violet)
- `--mission-dialogue` (sky)
- `--mission-collect` (emerald)
- `--mission-build` (slate)
- `--mission-other` (muted)

No hardcoded colors in components.

### 3. Render tags on the mission node
In `src/components/missions/MissionTree.tsx`:

- Extend `MissionNodeData` with `categories: MissionCategory[]`.
- Compute categories when building nodes (in the place that constructs `MissionNodeData`).
- Render a thin colored stripe along the left edge of the node split into segments — one per category — using `background: hsl(var(--mission-xxx))`. Each segment is a tooltip-able `<span>` with the category label.
- Also add a small dot row in the header (next to `Lv` badge) for redundancy when the card is narrow.

Single-category missions get a solid stripe; multi-category split proportionally.

### 4. Optional: legend
Add a compact legend strip above the tree (in `MissionsView.tsx`) listing the 6–7 category colors with labels, so users learn the encoding. Hideable via a small toggle, persisted to localStorage (`missions:showLegend`).

## Files to touch
- `src/lib/missions.ts` — add `MissionCategory`, `getMissionCategories`, `MISSION_CATEGORY_META`.
- `src/index.css` + `tailwind.config.ts` — add `--mission-*` tokens.
- `src/components/missions/MissionTree.tsx` — extend node data, render stripe + dots.
- `src/components/missions/MissionsView.tsx` — render legend strip.

## Out of scope
- Filtering by category (can come later as a follow-up).
- Changing the tree layout/edges.
- Categorizing prereq rules (level, other missions) — only objective tasks are tagged.
