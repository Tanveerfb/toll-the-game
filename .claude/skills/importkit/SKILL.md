---
name: importkit
description: Bring an approved kit from the toll-kits workshop repo into the game, game-ready but not live — copy the JSON, register it, give it a card number, wire art or fallbacks and VFX, run kitcheck and the suite, flag it unreleased, queue its art. Use when he says "import <character>", "bring <id> in from toll-kits", "make <kit> game ready", "do the sync" for kits, or a draft.md says APPROVED FOR IMPORT. Never for a kit that is not approved, and never changes a number.
---

# importkit

A kit crosses from `toll-kits` to this repo in one shape every time. The
rules are his (AGENTS.md, "Kits are workshopped in a separate repo"; rulings
#162, #171); this skill is the order of operations so nothing is forgotten,
because a push here is a production deploy.

## Where the truth lives

- `github.com/Tanveerfb/toll-kits` — `drafts/<id>/draft.md` and `kit.json`;
  only a draft whose `draft.md` says **APPROVED FOR IMPORT** crosses.
- `data/characters/*.json` — the kits (the numbers live here, never in prose).
- `lib/game/characterCatalog.ts` — the registry (imports and `CHARACTERS`),
  `cardNumber`, `unreleased`, `storyOnly`; `getPlayableCharacters` hides
  unreleased kits on the deployed site (#171).
- `lib/game/characterArt.ts` — `CHARACTERS_WITH_ART`, `TILE_ART`,
  `SKILL_ART_ALIAS` (borrow another unit's art as a fallback);
  `lib/game/characterVfx.ts` — the per-unit VFX entry.
- `lib/game/unitKey.ts` — `colorQualifiedId`: a colour variant of an existing
  unit is `blue_lyra`, its coin `blue_lyra_coin` (#171, amends #162).
- `docs/design/KIT_DESIGN.md` — bands and wording; the `kitcheck` skill audits
  against it; `kitwords` writes the player text.
- `tests/characterCatalogRegistration.test.ts`, `characterArt.test.ts`,
  `characterVfx.test.ts`, `kitInvariants.test.ts`, `kitDescriptionRules.test.ts`
  — what import work must turn green.
- `docs/ART_REQUESTS.md` Category E — where the kit's art is queued.
- `docs/HANDOFF.md` — the ledger; `toll-kits/decisions/PENDING.md` feeds it.

## Do this, in order

1. **Confirm approval.** Read `drafts/<id>/draft.md` in toll-kits. No
   "APPROVED FOR IMPORT" line, no import: say so and stop.
2. **Copy** `drafts/<id>/kit.json` to `data/characters/<id>.json` verbatim.
   Not one number changes on the way (AGENTS.md: he owns the numbers).
3. **Register** it in `characterCatalog.ts`: the import, the entry, the next
   free `cardNumber` (a 999xxx number in the draft is a sim placeholder, not a
   card number), `"unreleased": true` unless its art is already locked and
   installed. A colour variant takes the `colorQualifiedId` form.
4. **Art and VFX:** if the unit has locked art, install it per
   `docs/CHARACTER_ART.md` step 6 (`charart`); if not, add a `SKILL_ART_ALIAS`
   fallback to the nearest unit, add the VFX entry, and **queue the art** with
   the `comfypending` skill (Category E).
5. **Audit the wording** with `kitcheck`. Findings go back to toll-kits as
   notes, not as edits here, unless they are structural (a missing field).
6. **Run the suite**: `npm run check`. The registration, art and VFX tests are
   exactly the ones toll-kits' own audit skipped. A new mechanic the engine
   lacks is a stop: tell him, do not improvise it.
7. **Simulate** once, as a smoke test, not a verdict: `npm run sim -- <id>
   <opponent>`. Report dominance as "X currently has no counter" (#138); never
   propose a nerf.
8. **File the rulings** that came with the draft: each entry in toll-kits'
   `decisions/PENDING.md` goes into the ledger with the `ruling` skill, then is
   deleted there, and its number is added to `KIT_RULINGS` in toll-kits'
   `tools/sync.mjs`.
9. **Record** in `docs/STATUS.md`: imported, unreleased, art queued; and in
   toll-kits, mark the draft imported.

## Releasing later

Releasing is adding the locked art and deleting the `unreleased` flag
(#171), after `charart` step 6. Nothing else changes.

## Never

- Import a draft that is not marked approved, or change a number on import.
- Make a kit live without its art: `unreleased` stays until the art is in.
- Put kit ideas back into this repo; they go to toll-kits.
- Build a missing mechanic on the way through. That is its own session, with
  his ruling first.
