# data/characters — the kits

**Who updates this:** whoever changes how a kit is authored (the schema, the
template, the newkit script), in the same change. The kits themselves are
Tanveer's: every name, number and mechanic (AGENTS.md, Design Ownership).

One JSON per kit, the source of truth the game loads. **In `toll-kits` this
folder is mirrored as `kits/`**, so this file is read there too.

## Starting a kit

```
npm run newkit -- <id> --name "<Name>" --color <light|red|blue|green|dark> [--heading "<Heading>"]
```

It copies `data/kit.template.json`, drops the commentary, stamps the id, the
next free card number and `unreleased: true`, and prints the steps that
follow (register in the catalog, wording, audit, art fallbacks, check, sim).
**Never start a kit from another character's file** (his rule, 2026-10-13):
the template is the shape, the schema is the law, and his draft is the
content. In `toll-kits`, copy the template into `drafts/<id>/kit.json` the
same way and run `npm run audit` there.

## The schema

- `lib/game/characterSchema.ts` (zod) is what the catalog validates every
  kit against at load; a file that fails it is dropped with its id in the
  error.
- `data/kit.schema.json` is the same schema written out for editors (add
  `"$schema": "../kit.schema.json"` to a kit while editing, remove it before
  committing, or leave it: unknown keys are allowed). Regenerate with
  `npm run kit:schema` after a schema change; `tests/kitSchema.test.ts` fails
  until the file matches.
- The field descriptions live in the zod schema and nowhere else, so the
  JSON Schema, the template's comments and this README cannot disagree with
  the code for long.

## What guards a kit

| Test | Pins |
| --- | --- |
| `tests/kitSchema.test.ts` | the schema file and the template agree with the code |
| `tests/characterCatalogRegistration.test.ts` | every file here is registered in `characterCatalog.ts` |
| `tests/characterHeadings.test.ts` | variants share a name and differ by heading (ruling #141) |
| `tests/characterArt.test.ts` | every registered art file exists; a released kit has art or an alias |
| `tests/kitDescriptionRules.test.ts` | the wording rules (tier words, clause order) |
| the `kitcheck` skill | the judgement half: rulings, bands, substats, one scaling stat |

## Rules that are easy to get wrong

- Bracketed numbers in his draft are ranked (`valueRanked`); everything
  unbracketed is flat (`valuePercent`, `duration`). A tier word and a ranked
  value are mutually exclusive (ruling #130).
- One scaling stat per kit, heals included. Buffs multiply, so magnitudes
  stay small (self 25/50/75, team 20/30/50). `docs/design/KIT_DESIGN.md`.
- A kit without its art ships `unreleased: true` (ruling #171); releasing is
  adding the art and deleting the flag.
- A card number is assigned once and never reused; a deleted kit's number
  stays retired (ruling #187).
