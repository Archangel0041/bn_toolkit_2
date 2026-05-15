# Mission Tree (v1)

Add an interactive mission tree page that loads `Config/missions.json` and renders all missions up to the current account level cap, grouped by level band, with edges from prerequisite missions to dependents. Filterable to "what's left for me".

V1 stays minimal: **mission name + required level only**. Building / composition / job prereqs are parsed and stored but not shown yet — they're noted on each node as "+N other requirements" so we can layer them in later.

## Data shape

`missions.json` = `Record<missionId, Component[]>`. Each mission's components include:

- `mission_identity_config` → `id`, `title`, `giver`
- `mission_existence_config` → `start_rules[]`, `persistence_rules[]`
- `mission_objectives_config` → objective `prereq` (some level requirements live here, e.g. mission 1 = reach level 65)
- `mission_rewards_config`, `mission_effects_config` → kept for later

Prereq rule types observed: `player_level_prereq_config`, `complete_all_missions_prereq_config`, `complete_any_mission_prereq_config`, `active_missions_prereq_config`, `inactive_missions_prereq_config`, `not_started_missions_prereq_config`, plus structure / building / composition / job / tag / state rules (all bucketed as "other" for v1).

`effectiveLevel(mission)` = max of every `player_level_prereq_config.min_level` in start_rules + objective completion rules. Falls back to 1.

## Files

1. `src/lib/dataLoader.ts` — add `loadMissions()` (cached like other configs).
2. `src/lib/missions.ts`
   - `parseMissions(raw)` → `ParsedMission[]` with `{ id, title, giver, level, prereqMissionIds: { all, any, active, inactive, notStarted }, otherPrereqCount }`.
   - `buildMissionGraph(parsed, { maxLevel })` → nodes + edges (one edge per prereq mission relationship, typed by category).
   - `filterRemaining(parsed, { currentLevel, completedIds })` → subgraph of missions not in `completedIds`, with `complete_all/any` resolved against `completedIds`, optionally hiding ones gated by level above `currentLevel`.
3. `src/components/missions/MissionTree.tsx`
   - Uses **React Flow** (`@xyflow/react`) + **dagre** for layout.
   - Layout: top-to-bottom, **ranks pinned by required level** (each level band = one horizontal row). Missions inside the same level band sit on the same Y; X is dagre-assigned to minimize edge crossings.
   - Subtle horizontal divider per level band with the level label on the left gutter ("Lv 10", "Lv 20", …).
   - Edges from prereq mission → dependent mission. Edge style varies by type (solid = require complete-all, dashed = complete-any, dotted = active/inactive/not-started).
   - Node = compact card: mission title (localized via `t(title)` with raw-key fallback), giver chip, "Lv N" badge, and a tiny "+N reqs" badge if `otherPrereqCount > 0` (no detail panel yet, just a tooltip listing the raw rule types — placeholder for later expansion).
4. `src/components/missions/MissionFilters.tsx`
   - Search by title/giver.
   - Mode toggle: **All** vs **Remaining**.
   - Remaining mode inputs: current level (defaults to `useAccountLevel`) + textarea/multiselect of completed mission IDs (persisted in localStorage).
   - Toggle "Hide missions above my level".
5. `src/pages/Missions.tsx` — page wrapper, route `/missions`.
6. `src/App.tsx` + `src/components/Header.tsx` — add nav link.

## Layout sketch

```text
Lv 1  ─ [Mission A] [Mission B]
              │           │
Lv 5  ─       [Mission C]─┘
                    │
Lv 10 ─       [Mission D]   [Mission E]
                                  │
Lv 15 ─                     [Mission F]
```

Each row's Y is fixed by level; dagre only solves X within / across rows. Edges always flow downward (higher level depends on lower).

## Out of scope for v1 (planned for later)

- Showing building / composition / job / tag prereqs as nodes or icons.
- "You need X concrete + Y buildings to finish this tree to level cap" rollup.
- Click-to-detail side panel with rewards, encounters, dialog.
- Localizing every mission title beyond best-effort `t()` lookup.
- Persisting completed mission IDs to Supabase per user.

## Open questions

1. Dedicated `/missions` route, or new tab inside `Index.tsx` next to Units / Encounters / Boss Strikes?
2. For "completed missions" input in v1: paste a comma-separated ID list, or click-to-toggle nodes on the graph (state in localStorage)?
