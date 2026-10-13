---
name: savefield
description: Add, rename or remove a persisted field on the player save (store/playerStore.ts) without losing anyone's progress — the cloud-sync decision, the version bump and migration, the Firestore shape rules, the guard tests, and the reload check. Use whenever a feature needs the player to remember something: a clear record, a counter, a claim, a setting that must survive reload, a new currency. Also when a persisted field changes shape.
---

# savefield

Every field the player store persists is a promise to every save that already
exists. This skill is the checklist that promise needs, written after the
2026-10-13 audit found a synced field whose shape Firestore rejects (issue #28)
and after `clearedEvents` and `autoClearTickets` went a month unsynced and paid
a first-clear bundle twice (AGENTS.md).

## Where the truth lives

- `store/playerStore.ts` — `DEFAULT_PLAYER_STATE`, `CURRENT_PLAYER_STATE_VERSION`,
  `migratePlayerState` (the chain v1 → current), `partialize` (what persists).
- `lib/game/cloudSave.ts` — `CLOUD_FIELDS` (travels to Firestore) and
  `DEVICE_LOCAL_FIELDS` (stays on the device, with the reason), `cloudDocument`
  (what is written), `cloudPatch` (what a read applies).
- `tests/cloudSave.test.ts` — fails the build when a persisted field is in
  neither list; `tests/playerStore*.test.ts` — the migrations.
- `hooks/AuthProvider.tsx` — when the cloud is read and written.
- `docs/GAME_AUDIT_2026-10-13.md` Part 1 — the known save defects; do not
  build on a path listed there without saying so.
- `docs/demo-shortcuts.md` — if the field carries value (currency, a claim,
  a reward), it is client-authored for now and goes in that register.

## Do this, in order

1. **Name it by what the player understands** (§NAMING) and decide its
   **shape with Firestore's limits in mind**: no nested arrays (`string[][]`
   is rejected: issue #28), no `undefined` (drop the key or use `null`), no
   `Date` (epoch ms), no unbounded growth (cap lists; `epicClears` caps distinct
   teams at 30). A map keyed by id beats an array you search.
2. **Default it** in `DEFAULT_PLAYER_STATE` and add it to `partialize` if the
   store filters what it persists.
3. **Decide where it lives and write the decision down**: add it to
   `CLOUD_FIELDS` (it must reach a second device and survive sign-out/in) or to
   `DEVICE_LOCAL_FIELDS` with a one-line reason. "Not synced" is never the
   silent default. The test fails the build until you do.
4. **Bump `CURRENT_PLAYER_STATE_VERSION` and add a migration step** in
   `migratePlayerState` that fills the field for an older save. Migrations are
   chained in order; never edit an older step. If the shape changes, the step
   converts the old shape, it does not drop it.
5. **Cloud read:** `cloudPatch` applies a field only when the document has it.
   A new field on an old document therefore keeps the local default: confirm
   that is the behaviour you want (it is, for a counter; it is not for a claim
   that must not pay twice: see how `claimedOrders` is handled).
6. **Tests, red first:** the cloud test round-trips the field; a migration test
   feeds a save at the previous version and asserts the field; if the field
   carries a claim or a payout, a test asserts it pays once across a
   sign-out/in. Prove each test fails before the change (AGENTS.md: a green
   guard is not a working guard).
7. **Hydration:** anything that reads the field on first render is gated on
   `hasHydrated` (TopNav's pattern), or it mismatches on the server.
8. **Reload check on a scratch server:** write the field, reload, confirm it
   survived; sign out and in if Firebase is configured; look at the Firestore
   console if you can. Note what you could not verify in STATUS.
9. **Register** value-bearing fields in `docs/demo-shortcuts.md` with the
   server-side rule that replaces them, and add `// DEMO:` at the write site.

## Never

- Write to the store from a component; actions describe intent (§STATE).
- Add a field in `CLOUD_FIELDS` with a shape you have not checked against
  the Firestore rules above.
- Skip the version bump because "it has a default": an old save hits code
  that reads the field before the default merge runs, and that is the empty
  `/events` screen in the audit's finding on corrupt saves.
- Reuse a field for a second meaning. Two meanings in one field is the
  `limited` pity key that still means "the gem banner".
