# Boss: Molvarr — the Sunken Warden

> Finalized design 2026-07-18 (Tanveer). The Ch8/9 lake boss + first farmable
> world boss. Art: `public/npc/sea_monster.png`. NOT BUILT — needs the
> engine work in "Systems required" below.

- **Color:** Dark | **Tags:** [Demon] | **Tier:** elite (3 actions/turn)
- **No ult gauge** — the "SP Skill" is the special, auto-fired (see timers).
- **Multi-phase "hearts"** (7DSGC Ragnarok demonic-beast model): a phase ends
  when its HP bar hits 0, then the next phase begins with a fresh bar.

## Phase transition rules
- P2 starts when P1's HP reaches 0 (fresh 4000 bar).
- **Boss fully resets:** its own buffs, debuffs on it, and its per-phase timers.
- **Persists:** player team state (HP, their buffs/debuffs), the **global battle
  turn counter**, and **Corrosion stacks already on the players** (boss-applied
  debuffs on players carry over).
- The boss's **per-phase trigger counters** ("every 3 turns", "turn 10") reset
  to 0 at phase entry. (Global battle counter keeps running independently.)

## Phase 1 — HP 3000 | ATK 150 | DEF 110
- **Skill 1:** [140/170/225] damage to all enemies; applies **Corrosion** for
  [1/1/2] turns.
- **Skill 2:** [300/335/400] damage to one enemy.
- **SP Skill:** heals self for 30% of **missing** HP (maxHP - currentHP).
- **Passive [Main]:** +10% ATK per debuff across ALL enemies, linear
  (5 debuffs = +50% ATK), recalculated live as debuff count changes.
- **SP Passive 1:** every 3rd phase-turn, the 3rd of its 3 actions is forced to
  be the SP Skill (SP is never a normal AI pick).
- **SP Passive 2:** immune to crowd control — **stun/freeze** only (freeze = a
  stun variant). Seal is NOT blocked. Future CC types join this list.
- **SP Passive 3:** on **turn 10** (of the phase): x2 ATK, DEF, **and max HP**;
  current HP scales by the same ratio (e.g. 1000/3000 -> 2000/6000).

## Phase 2 — HP 4000 | ATK 210 | DEF 145
- **Skill 1:** **Pierce** [150/180/250] damage to all enemies.
- **Skill 2:** [200/250/350] damage to one enemy; lifesteals 30% of damage.
- **SP Skill:** raises own ATK and DEF by 50% for 2 turns.
- **Passive [Main]:** applies 1 Corrosion to each enemy at the start of each
  (boss) turn; deals +30% damage to enemies that have Corrosion.
- **SP Passive 1/2/3:** same as Phase 1 (auto-SP-timer now fires P2's SP Skill;
  CC immunity; turn-10 x2 spike).
- **SP Passive 4:** from **turn 10** (of the phase), all enemies lose 10% of
  their max HP every turn.

## New mechanic: Corrosion
- DoT debuff. Each stack deals **10% of the target's MAX HP per turn**, ticking
  at the victim's turn-end (cleanse window, ruling #21).
- **Stacks uncapped** — 3 Corrosion = 30% max HP/turn. Intended boss gimmick:
  forces a cleanse/heal unit, or a race to out-damage it.
- Applied by: P1 Skill 1 (ranked duration [1/1/2]); P2 Main passive (1/turn).

## Systems required (build order)

1. **Enemy hidden deck + auto-merge (7DSGC "headless" model).** Enemies get
   their own deck/hand like players: cards auto-merge adjacent identical skills
   (rank up), AI plays from the merged hand. This is what makes the ranked skill
   values ([140/170/225]) rank up for a boss — same mechanic as players, no
   manual dragging. Optional UI: "NEXT" telegraph cards above the boss.
   *Self-contained; benefits every enemy; build + test first.*
2. **Boss/phase engine.** A boss kit shape with `phases[]` (each: own stat
   block, `skills[]` of any count, `passives[]` of any count), HP-threshold
   phase transitions with the reset/persist rules above.
3. **New mechanics/hooks:** Corrosion (maxHP% DoT, uncapped); CC-immunity
   (block stun); auto-SP-timer (forced Nth action every 3rd phase-turn);
   per-phase turn counter; turn-N stat spike incl. max-HP scaling; the
   "+X% dmg vs corroded" and "debuff-count -> ATK" passives.
4. **Molvarr kit data** authored against the new schema.
5. **Kit Lab boss mode** (later — v2 of the tool).

Reference: 7DSGC demonic beast (Ragnarok) battles; enemy hidden deck visible
top-left in-battle, NEXT telegraph above enemies.
