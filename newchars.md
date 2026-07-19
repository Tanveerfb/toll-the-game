# Character kits and notes by Tanveer Singh

---


**Conventions (so I don't have to ask):**

- `[r1/r2/r3]` = value at card rank 1/2/3. Single value = flat, never scales.
- Ultimate must hit harder than any rank-3 skill.
- Any skill with damage > 0 deals that damage even if it's "a debuff skill".
- Durations are literal (ruling #21): "N turns" = N DoT procs / N blocked
  turns. Debuffs tick at the victim's turn end (they get a cleanse window);
  buffs tick at the owner's turn start (a 1-turn buff survives the whole
  enemy turn).
- Dokkan wording tiers: "raises" (<50%), "greatly raises" (50–79%),
  "massively raises" (80%+); same for "lowers". Descriptions don't need the
  numbers — hovering the word shows that skill's exact values.
- Permanent stat changes say it explicitly: "Permanently raises ATK"
  (rest of battle). Temporary ones state the duration.
- Semicolons separate the distinct parts of a description:
  "Permanently raises ATK; greatly raises DEF for 1 turn; then does 500%
  ATK damage to one enemy."
- No "own": "Raises ATK" always means the skill user's stats.
- Effects are cancellable and stackable by default — only call out
  "cannot be cancelled" / "unstackable" when they aren't.
- If a mechanic already exists (Weakpoint, Amplify, Shock...), name-drop it —
  no need to redefine. New ones need full definition once.
- Anything you leave out, I will ask rather than invent.

---

<!-- Implemented kits get removed from this file — they live in data/characters/*.json.
     Seras, Meliodas, Ban, Diane: implemented 2026-07-07.
     Gon, Killua, Leorio: implemented 2026-07-11.
     Molvarr (sea monster boss): implemented 2026-07-19 -> data/characters/molvarr.json. -->

<!-- No pending drafts. Add the next character/boss kit below. -->

## Ideas parked (not started)

- **Lyra boss expansion:** Lyra_npc is currently the plain playable Red Ice kit
  with boss stamina. Now that the boss passive engine exists (bossAutoSp /
  spSkill slot / bossStatSpike / etc.), we may give her boss-only features — an
  SP Skill and extra passives. Draft the kit here when ready.
