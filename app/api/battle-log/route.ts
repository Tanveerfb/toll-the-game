import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

/**
 * Debug helper (playtest request 2026-07-11): saves a finished battle's full
 * event log under <project root>/battle-log/ so a match can be read back and
 * debugged. Local filesystem only — fails gracefully where the FS is
 * read-only (e.g. serverless deploys).
 */
export async function POST(req: Request) {
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
      safeName.endsWith(".log") ? safeName : `${safeName}.log`,
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
