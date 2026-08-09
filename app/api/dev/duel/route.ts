import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

/**
 * Bridge for duel mode — Claude plays the enemy side of a PvE battle.
 *
 * The browser can't read the filesystem and Claude can't read the browser, so
 * this route is the only thing between them. It owns `.duel/` (gitignored):
 *
 *   state.md     written when it becomes Claude's turn — what Claude reads
 *   move.json    written by Claude — the actions to take
 *   rejected.md  why a move was thrown out and the AI took the turn instead
 *   duel-log.md  append-only history of states, moves and reasoning
 *
 * Development only, enforced server-side on every verb: this must not exist in
 * a production build no matter what a client sends. Spec:
 * docs/superpowers/specs/2026-08-09-claude-duel-mode-design.md
 */

const DUEL_DIR = ".duel";

function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return null;
}

function duelPath(...parts: string[]) {
  return path.join(process.cwd(), DUEL_DIR, ...parts);
}

async function appendLog(entry: string) {
  await fs.mkdir(duelPath(), { recursive: true });
  await fs.appendFile(duelPath("duel-log.md"), entry, "utf8");
}

/**
 * POST — publishes either a turn's state, or the battle's result.
 *
 * The result branch exists because a finished battle writes no new state, so
 * a watcher polling `state.md` waits forever with no idea the fight ended.
 * `result.md` is the end-of-battle signal (added 2026-08-09 after exactly that
 * happened in the first duel).
 */
export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const { state, turn, result } = await req.json();

    if (typeof result === "string" && result.length > 0) {
      await fs.mkdir(duelPath(), { recursive: true });
      await fs.writeFile(duelPath("result.md"), result, "utf8");
      await fs.rm(duelPath("move.json"), { force: true });
      await appendLog(`\n\n---\n\n${result}\n`);
      return NextResponse.json({ finished: true });
    }

    if (typeof state !== "string" || state.length === 0) {
      return NextResponse.json({ error: "state required" }, { status: 400 });
    }
    // A new battle starts clean — a stale result must not look like this
    // fight's outcome.
    await fs.rm(duelPath("result.md"), { force: true });
    // Likewise a rejection from a previous turn — it's been surfaced already,
    // and leaving it would make the next turn look rejected too.
    await fs.rm(duelPath("rejected.md"), { force: true });
    await fs.mkdir(duelPath(), { recursive: true });

    // A move from an earlier turn must never be applied to this one. The turn
    // guard in parseDuelMove catches it too; deleting here means Claude never
    // sees a stale file and thinks it already moved.
    await fs.rm(duelPath("move.json"), { force: true });
    await fs.writeFile(duelPath("state.md"), state, "utf8");
    await appendLog(`\n\n---\n\n${state}\n`);

    return NextResponse.json({ waiting: true, turn });
  } catch {
    return NextResponse.json({ error: "failed to publish state" }, { status: 500 });
  }
}

/** GET — the game polls for Claude's move. `{ pending: true }` until it lands. */
export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const raw = await fs.readFile(duelPath("move.json"), "utf8").catch(() => null);
    if (raw === null) return NextResponse.json({ pending: true });

    // Returned verbatim; validation belongs to parseDuelMove on the client,
    // where the live teams and hand are, and where a rejection can fall back
    // to the scripted AI.
    return NextResponse.json({ pending: false, move: raw });
  } catch {
    return NextResponse.json({ pending: true });
  }
}

/** DELETE — the game consumed (or abandoned) the move; drop it and log why. */
export async function DELETE(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const params = new URL(req.url).searchParams;
    const note = params.get("note");
    await fs.rm(duelPath("move.json"), { force: true });
    if (note) await appendLog(`\n> ${note}\n`);
    // A rejected move is otherwise invisible until someone greps the log —
    // which is how a whole turn got silently handed to the AI mid-duel on
    // 2026-08-09. Give watchers a file they can poll for instead.
    if (params.get("rejected") === "1" && note) {
      await fs.mkdir(duelPath(), { recursive: true });
      await fs.writeFile(duelPath("rejected.md"), `${note}\n`, "utf8");
    }
    return NextResponse.json({ cleared: true });
  } catch {
    return NextResponse.json({ cleared: false }, { status: 500 });
  }
}
