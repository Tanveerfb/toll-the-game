import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

/**
 * Debug helper (playtest request 2026-07-11): saves a finished battle under
 * <project root>/battle-log/ so a match can be analysed afterwards. Local
 * filesystem only — fails gracefully where the FS is read-only (e.g.
 * serverless deploys).
 *
 * The payload became JSON on 2026-08-13: nobody reads these by eye, they are
 * saved so battles and kits can be analysed, and prose was the wrong shape for
 * that (see `lib/game/battleReport.ts`). The extension is taken from the
 * filename now rather than forced to `.md`.
 */
const ALLOWED_EXTENSIONS = [".json", ".md"];
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const { filename, content } = await req.json();
    if (typeof content !== "string" || content.length === 0) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }
    const safeName = String(filename || `battle_${Date.now()}`).replace(
      /[^a-zA-Z0-9_\-.]/g,
      "_",
    );
    const dir = path.join(process.cwd(), "battle-log");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(
      dir,
      ALLOWED_EXTENSIONS.some((ext) => safeName.endsWith(ext))
        ? safeName
        : `${safeName}.json`,
    );
    await fs.writeFile(file, content, "utf8");
    return NextResponse.json({ saved: `battle-log/${path.basename(file)}` });
  } catch {
    return NextResponse.json(
      { error: "failed to save battle log" },
      { status: 500 },
    );
  }
}
