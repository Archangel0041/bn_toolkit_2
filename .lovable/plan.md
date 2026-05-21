## Change healing time display to hh:mm format

### What
Update the time display in healing scaling tables from `5m 30s` style to `hh:mm` format (e.g. `01:30`, `00:45`).

### Where
`src/components/units/HealingScalingTables.tsx` — the `formatSeconds` helper function (lines 17–23).

### How
- Rewrite `formatSeconds` to always output `HH:MM`:
  - `45s` → `00:00` (or keep seconds if under 60? needs decision)
  - `180s` → `00:03`
  - `5400s` → `01:30`
- Optional: clamp to minutes (no seconds shown) since the user said "instead of showing minutes show hhmm" — so we only care about hours and minutes, rounding up or dropping seconds.

### Scope
Only the `formatSeconds` function in `HealingScalingTables.tsx`. No other files touched.