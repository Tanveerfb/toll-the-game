# Design Reference Index

> Screenshots gathered 2026-07-24 from Dokkan Battle, 7DS Grand Cross, and one unnamed gacha ("ref4"), for toll-the-game's upcoming design work. **These are inspiration, not blueprints** — each roadmap item's memory file (linked below) explains what's actually adaptable vs. what to skip. This index just tells you what each image *shows*; the memory files explain what it *means*.

Full context lives in Claude's memory (`toll-battle-ui-overhaul-requirements`, `toll-stage-map-reference`, `toll-gacha-design`, `toll-world-boss-refs`, `toll-card-disabled-state-and-merge-cost`) — this file is a quick lookup, not a replacement for those.

## battle-ui-refs/ — battle screen overhaul (roadmap #2)

- `7dsgc-battle-screen.jpg` — full battle screen: fanned card hand, rank-colored borders, per-unit orb rows, enemy NEXT telegraph (not adopted).
- `7dsgc-battle-screen-after-merge.jpg` — same screen after merging 2 R1 cards into R2; a RESET button appears to undo the staged play.
- `7dsgc-hand-all-ranks.jpg` — bronze/silver/gold rank borders side by side; gold is visibly more ornate, not just recolored.
- `7dsgc-ultimate-in-hand.jpg` — ultimate cards get their own distinct icy/crystalline border, separate from the rank ladder entirely.
- `7dsgc-enemy-target-marker.jpg` — the currently-targeted enemy gets red corner brackets directly on its portrait card.
- `7dsgc-roster-list-screen.jpg` — archive/roster grid: search bar, race-filter carousel, portrait grid, action buttons.
- `7dsgc-character-detail-screen.jpg` — character detail page; a diamond-chevron button expands substats as an inline drawer (not a modal) — a 3rd distinct substat-reveal pattern.
- `7dsgc-skill-info-modal.jpg` — R1→R2→R3 cards shown side by side with a merge-rule hint, colored-keyword description, "Preview" button.
- `7dsgc-ultimate-info-modal.jpg` — same modal shell as skills; shows base ult art → "Combined Attack" variant when synergy teammates are present; a level stepper (Lv 3/6).
- `7dsgc-preview-mode.jpg` — isolated 1v1 sandbox vs. a dummy enemy with a RESET button and every rank/ultimate available — maps to repurposing Kit Lab into a player-facing Preview feature.
- `7dsgc-victory-screen.jpg` — victory banner, stamina-refill progress, rewards, rank/XP bar, team strip with MVP badge (flagged "for later," not part of the battle overhaul itself).
- `dokkan-battle-screen-ki-spheres.jpg` — Dokkan's mid-battle screen; ki-sphere board (dropped — not applicable) + bottom team row + turn counter (kept, shape reference).
- `dokkan-character-detail-card.jpg` — Character Detail card reached from the Team Details list: big art, HP/ATK/DEF callouts, leader-skill text.
- `dokkan-character-details-full-top.jpg` — deeper Character Details page: Super ATK + Passive rows, each with its own "Details" button.
- `dokkan-character-details-scrolled.jpg` — same page scrolled: Hidden Potential/Skill Orb/Link Skill (all dropped, no equivalent mechanic) + Category tags (kept).
- `dokkan-character-list-by-tag.jpg` — tapping a Category/tag chip opens a filtered Character List grid of every character with that tag.
- `dokkan-inbattle-mini-info-panel.jpg` — tap-a-unit-mid-battle overlay with 5 live combat-stat trackers (attacks/supers/hits taken/guard procs/evades) — repurpose the concept, not the exact stat list.
- `dokkan-news-panel-list.jpg` — the in-game News panel (tabbed categories, card feed) — maps to the patch-notes roadmap item, not the battle overhaul.
- `dokkan-news-detail-top.jpg`, `dokkan-news-detail-scrolled.jpg` — News detail view: banner, body text, "Updated on" header, sub-sectioned content.
- `dokkan-passive-skill-details-modal.jpg` — Passive Details modal: categorized condition headers + bullet effect list with icons.
- `dokkan-stage-map.jpg` — the node-path stage map (see `story-mode-refs/` for the fuller A-to-B flow version).
- `dokkan-super-attack-details-modal.jpg` — Super Attack Details modal: Ki-bar activation threshold, effect text, secondary variant.
- `dokkan-team-details-list.jpg` — Team Details list: every party member as a row with quick stats.
- `ref4-character-info-screen.jpg` — 4th-game character info: 4 corner stat callouts, a "?" button opens substats, bottom row shows every skill at every rank + ultimate.
- `ref4-passive-detail.jpg`, `ref4-skill1-detail.jpg`, `ref4-ultimate-detail.jpg` — inline descriptions with colored/bold keyword highlighting + glossary footnotes (e.g. "Rend", "Power Strike") — maps closely to the existing `mechanicGlossary` system.
- `ref4-substats-detail.jpg` — **the substats validation screen**: Pierce Rate, Resistance, Regeneration Rate, Crit Chance, Crit Damage, Crit Resistance, Crit Defense, Recovery Rate, Lifesteal — 4 of these were built into toll-the-game the same day this was found.

## gacha-refs/ — gacha system (roadmap #4)

- `7dsgc-gacha-paid-banner.jpg` — paid banner: 600-cap pity bar, milestones every 150, +30 pity per 11-pull.
- `7dsgc-gacha-free-ticket-banner.jpg` — free/ticket banner: uneven milestones (60/120/150/180/240), ticket-item currency.
- `7dsgc-rates-modal.jpg` — Rates modal, Draw Rate tab: featured units get a green "Rate Up!" badge vs. flat pool rate.
- `7dsgc-rates-loyalty-tab.jpg` — Rates modal, Loyalty tab: equal-odds distribution across all SSRs (a guaranteed-pity odds model).
- `7dsgc-coin-shop.jpg` — multi-tier currency shop: gold/silver/bronze = F2P, rainbow/pink gems = premium, weekly/daily purchase caps per item.

## story-mode-refs/ — story mode (roadmap Phase 3)

- `7dsgc-game-modes-hub.jpg` — home-screen grid of every game mode (relevant once World Boss/PvP/etc. actually exist).
- `7dsgc-quests-landing-screen.jpg` — Quest Log landing: Story/Side/Tasks/Challenge tabs, "In Progress" cards per track.
- `7dsgc-quest-chapter-archive-cleared.jpg`, `7dsgc-quest-chapter-archive-current-locked.jpg` — chapter archive showing cleared (stamped "CLEAR") vs. current vs. locked (padlock) episode states.
- `dokkan-flow-1-chapter-select.jpg` through `dokkan-flow-8-vs-splash.jpg` — the full A-to-B Dokkan story flow: Chapter select → Area list → Stage list → Difficulty select → Team select → loading screen → node-path map (`-7-stage-map-a/b`) → VS splash. **This is the ceiling reference (Dokkan's full 5-layer hierarchy), not a minimum bar** — pick only the layers toll-the-game's scope actually needs.
- `dokkan-per-fight-battle-results.jpg` — quick per-node reward popup with a translucent crit-damage-number watermark bleeding through.
- `dokkan-stage-clear-summary.jpg` — full stage-clear summary: cumulative rewards across every fight, clear time, retry/OK.

## world-boss-refs/ — World Boss + Ascension (roadmap #3)

- `7dsgc-deathmatch-stage-select.jpg` — Boss Battle landing: difficulty ladder (Normal/Hard/Extreme/Hell) with stamina costs.
- `7dsgc-deathmatch-lobby-prep.jpg`, `7dsgc-deathmatch-lobby-ready.jpg`, `7dsgc-deathmatch-team-select-cc.jpg`, `7dsgc-deathmatch-vs-cc-splash.jpg` — **co-op lobby/matchmaking/CC-threshold layer — confirmed DROPPED**, toll-the-game's World Boss is solo only.
- `7dsgc-deathmatch-battle-phase1.jpg`, `-phase2.jpg`, `-phase3.jpg` — the actual battle (kept, solo-compatible): multi-phase "heart" counter, already matches the built `CharacterPhase` system.
- `7dsgc-deathmatch-skill-cast-1.jpg`, `-skill-cast-2.jpg` — mid-battle skill casts with colored-keyword descriptions.
- `7dsgc-deathmatch-boss-knockdown.jpg` — boss knockdown/downed animation between phases — a cheap, worthwhile juice moment to keep.
- `7dsgc-boss-info-preview.jpg` — boss info/preview screen: stat callouts, uniquely-named boss skills, passive icon badges, Ultimate Move.
- `7dsgc-deathmatch-victory.jpg` — victory screen with a "Host Bonus" tag (co-op-specific, drop that tag) and rewards grouped by location.
- `7dsgc-deathmatch-reward-detail.jpg` — reward item detail popup (ascension material info, e.g. "Red Demon's Horn").
- `7dsgc-limit-break-ascension-screen.jpg` — single-step Limit Break screen (Lv60→65, 3 material slots, currency cost).
- `7dsgc-quick-exchange-60to100.jpg` — bulk 60→100 jump (8 material slots) — not needed yet, toll-the-game's level cap stays at 40 for this update.
