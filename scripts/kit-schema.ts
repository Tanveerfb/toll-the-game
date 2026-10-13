/**
 * Writes data/kit.schema.json from the zod kit schema.
 *
 *   npm run kit:schema
 *
 * Run it after any change to lib/game/characterSchema.ts;
 * tests/kitSchema.test.ts fails until the file matches.
 */
import { writeFileSync } from "node:fs";
import { buildKitJsonSchema } from "@/lib/game/kitJsonSchema";

const path = "data/kit.schema.json";
writeFileSync(path, `${JSON.stringify(buildKitJsonSchema(), null, 2)}\n`, "utf8");
console.log(`wrote ${path}`);
