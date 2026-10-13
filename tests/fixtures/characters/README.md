# Mechanic fixtures

**Who updates this:** whoever adds or removes a fixture here, in the same
change. These are **test units, not kits**: they are never in the catalog,
the archive, a banner or a save, and `kitcheck` does not run on them.

The six collab units left the game on 2026-10-13 (ruling #187, his call) and
the engine mechanics only they carried stayed (his call). The tests that pin
those mechanics need units that carry them, so each one became a neutral
fixture with the same numbers and mechanics and new names. A fixture is
loaded straight from JSON in a test (`import thief from
"@/tests/fixtures/characters/fx_thief.json"`) and built with the test's own
`fromData` / `makeChar` helpers.

| Fixture | Carries | Was |
| --- | --- | --- |
| `fx_thief` (Thief, green) | Extort, Lifesteal, max-HP shred, [Human] synergy | the 7DS thief |
| `fx_colossus` (Colossus, blue) | Rupture, Attack Seal, turn ramp, [Giant] synergy | the 7DS giant |
| `fx_reaver` (Reaver, red) | Deathblow, counter stance (Mirror Stance), weakpoint, cancels + stun ult, [Demon] synergy | the 7DS captain |
| `fx_rookie` (Rookie, green) | buff-before-hit, gainUltGauge, stat shift after attacks, permanent ult raises, [Squad] synergy | the HxH rookie |
| `fx_prodigy` (Prodigy, blue) | Detonate, rank-gated stun, cancelStances, stat shift, [Squad] synergy | the HxH heir |
| `fx_medic` (Medic, red) | characterSynergy (needs `fx_rookie` / `fx_prodigy`), ranked AoE buff, Pierce, Bleed, [Squad] synergy | the HxH doctor |

Card numbers are `9999xx`, the sim-placeholder range, so nothing can mistake
one for a shipped card. A new mechanic that no shipped kit uses gets a
fixture here rather than a kit nobody will play.
