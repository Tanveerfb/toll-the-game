import { z } from "zod";
import { characterSchema } from "@/lib/game/characterSchema";

/**
 * The kit JSON Schema, derived from the zod schema so there is one source of
 * truth (his ask, 2026-10-13: a schema or template to draft a kit from, so a
 * new kit does not start from a copy of another character's file).
 *
 * `data/kit.schema.json` is this object written to disk by
 * `npm run kit:schema`, for editors and for `toll-kits`; `tests/kitSchema.test.ts`
 * fails when the file and this function disagree, so the file never drifts
 * from the zod schema that actually validates the catalog.
 */
export function buildKitJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(characterSchema, {
    target: "draft-2020-12",
    io: "input",
    // Inline, not `reused: "ref"`: with refs every described field became an
    // opaque `#/$defs/__schemaN` pointer and the descriptions left the
    // properties an editor reads. The skill and mechanic shapes therefore
    // repeat (skills, ultimate, passive, phases); the file is bigger and
    // readable.
    // `.refine` on the passive (trigger or blocks) has no JSON Schema form;
    // the zod schema still enforces it at load time.
    unrepresentable: "any",
  }) as Record<string, unknown>;
  return {
    $schema: schema.$schema,
    $id: "toll-the-game/data/kit.schema.json",
    ...schema,
  };
}
