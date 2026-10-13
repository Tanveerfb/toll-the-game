# Boss Battle mode — practice page

**Date:** 2026-07-19 · **Status:** approved, building

## Problem

Bosses (Molvarr, Lyra_npc) are `storyOnly`, so the practice Team Select roster
(`getPlayableCharacters()`) excludes them — there's no way to fight a boss in
practice. As more bosses land, we want a first-class way to pick one and test
it against a chosen team.

## Decisions (Tanveer, 2026-07-19)

1. **Layout:** a `Sandbox | Boss Battle` mode toggle at the top of Team Select.
   Boss mode keeps the player-team picker and swaps the enemy side for a
   single-boss picker.
2. **Boss tagging:** an explicit `boss: true` flag on the kit JSON (curated).
   Only Molvarr and Lyra_npc carry it now; future bosses opt in.
3. **Enemy setup:** a single boss (solo, elite = 3 actions/turn). No adds.

## Design

### Data
- Add optional `boss?: boolean` to `Character` (`types/character.ts`),
  `CharacterData` (`characterCatalog.ts`), and the Zod schema
  (`characterSchema.ts`, `z.boolean().optional()`).
- Set `"boss": true` in `data/characters/molvarr.json` and
  `data/characters/lyra_npc.json`.
- New catalog helper `getBossCharacters(): CharacterData[]` — kits with
  `boss === true` (independent of `storyOnly`).

### UI — `components/game/TeamSelect.tsx`
- New `mode` state: `"sandbox" | "boss"`, toggle rendered beside the existing
  format toggle.
- **Sandbox mode:** unchanged (current two-team picker).
- **Boss mode:**
  - Left panel: PLAYER TEAM picker (unchanged; 1–4 units, format field-cap
    still applies to the player team).
  - Right panel: **CHOOSE BOSS** — a single-select grid of boss cards
    (`getBossCharacters()`), each showing art, name, `ELITE`, and phase count
    for multi-phase bosses. Selecting one replaces any prior pick.
  - Primary button: `START BOSS BATTLE`, enabled when the player team has ≥1
    unit AND a boss is selected. Calls
    `onStart(playerPicks, [{ id: selectedBoss.id }])`.
  - `CLEAR` resets the player team and the boss pick.

### Wiring
No engine changes. `startCustomBattle` already resolves any enemy id via
`getCharacterById` (not filtered by `storyOnly`), and the boss engine
(`lib/game/bossPassives.ts` + `phases.ts`) drives phases/passives. Enemy pick is
just `[{ id: bossId }]`.

## Testing
- Unit: `getBossCharacters()` returns exactly the boss-flagged kits
  (Molvarr + Lyra_npc), and every returned kit has `boss === true`.
- `npm run check` green; `/practice` route 200.
- Manual: Tanveer drives an actual boss fight in-browser (the whole point).

## Out of scope / future
- **Lyra boss kit expansion (later):** Lyra_npc is currently the plain playable
  kit with boss stamina. We may give her boss-only features — an SP Skill and
  extra passives — using the boss passive engine now that it exists. Not now.
- Kit Lab boss mode (deferred v2).
- Difficulty tiers / rewards (part of the world-boss meta, separate track).
