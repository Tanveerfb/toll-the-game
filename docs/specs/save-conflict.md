# Sign-in over a guest save: ask, with the differences shown

**Status:** planned. The pure half is built (`lib/game/saveConflict.ts`,
`tests/saveConflict.test.ts`); the dialog and the provider wiring wait on a
mockup round (project-rules §OWNER: every visual change starts as a mockup he
approves).

**Who updates this:** the session that builds it marks it built; the
checkpoint keeps the status line current (§SPECS).

## Goal

When a player who has played as a guest signs in to an account that has also
been played, the game asks which save to keep and shows what differs. It
never silently replaces either. His decision, 2026-10-13, on audit finding 4
(`docs/GAME_AUDIT_2026-10-13.md`): *"Ask with differences shown."*

**Deliberately not:** a merge. Two saves do not combine (pulls, pity and
clears cannot be added without double-paying); one wins whole.

## Decided

- **The question is asked only when both saves have been played**
  (`isPlayedSave`): more than the starter roster, any pull, clear, rank or
  level. A fresh device over a real account, or a real device over an empty
  account, replaces without asking, the played side winning. Reason: the
  question is a cost; a player with nothing to lose should not pay it.
- **What is compared:** characters owned, account rank, highest level, gems,
  pulls made, fights cleared (`describeSaveConflict` rows). Reason: the six
  numbers a player can judge at a glance; the inventory and pity are not
  something a player weighs.
- **A side is pre-selected:** the one further along by a simple score
  (`progressScore`). Reason: the common case is "keep the bigger one" and
  one tap should do it.
- **The non-chosen save is written over, not kept.** Reason: a second copy
  is a second source of truth; the choice is the player's and final.
- **Until the choice is made, nothing syncs.** The cloud read sets the
  scheduler not-ready (`lib/game/cloudSync.ts`) and holds the patch; the
  choice applies it (cloud) or writes the local document over the cloud
  (local), then `setReady(true)`.

## Open

1. The dialog itself: a shadcn `Dialog` customised to the motif, two columns
   of rows, the suggested side marked, two buttons named by what they keep
   ("Keep this phone's progress" / "Keep the account's progress"). **Needs
   his mockup pick** (two or three options, drawn from the live login and
   profile screens, per the `redesign` skill).
2. The login screen's copy, which today says sign-in "banks your progress":
   **business copy, his to approve** (§OWNER).
3. Where the dialog opens: the login screen after sign-in, or wherever the
   auth change lands the player. Claude's recommendation: wherever the
   player is, because sign-in can complete on any screen and the question
   must not be missed.

## What it touches

- `hooks/AuthProvider.tsx`: the signed-in read branch gains a "conflict"
  state that holds `cloudPatch` until the choice; a `resolveSaveConflict(side)`
  on the context.
- A new `components/game/SaveConflictDialog.tsx` reading the rows.
- `app/login/page.tsx` copy.
- `tests/cloudSync.test.ts` already covers the gate; a provider-level test
  of the hold is out of reach without Firebase and is verified by hand on
  his account (`docs/PC_SESSION.md`).

## Done means

- A played guest save plus a played cloud save shows the dialog with six
  rows and the further side pre-selected; nothing is written to Firestore
  until a button is pressed.
- Keep local: the cloud document becomes the local save. Keep cloud: the
  local save becomes the cloud document. Either way `cloudStatus` ends
  `ready` and the next change syncs.
- An untouched side on either end shows no dialog and the played side wins.
- The login copy no longer promises what the game does not do.
