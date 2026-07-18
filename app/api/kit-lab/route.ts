import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { characterSchema } from "@/lib/game/characterSchema";

// Dev-only kit-authoring API for the Kit Lab (/kit-lab). Reads/writes kit JSON
// under data/characters/ and proposed-mechanic briefs under docs/proposed-
// mechanics/. Hard-disabled in production — this touches the working tree.

export const runtime = "nodejs";

const isProd = process.env.NODE_ENV === "production";

const CHARACTERS_DIR = path.join(process.cwd(), "data", "characters");
const BRIEFS_DIR = path.join(process.cwd(), "docs", "proposed-mechanics");

function devOnly(): NextResponse | null {
  if (isProd) {
    return NextResponse.json(
      { error: "Kit Lab is disabled in production." },
      { status: 404 },
    );
  }
  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/kit-lab            -> { ids: string[] }
// GET /api/kit-lab?id=duke    -> the parsed kit JSON
export async function GET(request: Request): Promise<NextResponse> {
  const blocked = devOnly();
  if (blocked) return blocked;

  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    const files = await fs.readdir(CHARACTERS_DIR);
    const ids = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
    return NextResponse.json({ ids });
  }

  if (!/^[a-z0-9_]+$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const raw = await fs.readFile(
      path.join(CHARACTERS_DIR, `${id}.json`),
      "utf8",
    );
    return NextResponse.json({ kit: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ error: "Kit not found." }, { status: 404 });
  }
}

// POST /api/kit-lab  { action: "saveKit", kit }  | { action: "saveBrief", brief }
export async function POST(request: Request): Promise<NextResponse> {
  const blocked = devOnly();
  if (blocked) return blocked;

  const body = (await request.json()) as {
    action?: string;
    kit?: unknown;
    brief?: Record<string, string>;
  };

  if (body.action === "saveKit") {
    const result = characterSchema.safeParse(body.kit);
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `${i.path.join(".") || "<root>"}: ${i.message}`,
      );
      return NextResponse.json(
        { error: "Kit failed validation.", issues },
        { status: 422 },
      );
    }
    const kit = result.data as { id: string };
    if (!/^[a-z0-9_]+$/i.test(kit.id)) {
      return NextResponse.json(
        { error: "Kit id must be alphanumeric/underscore." },
        { status: 400 },
      );
    }
    await fs.writeFile(
      path.join(CHARACTERS_DIR, `${kit.id}.json`),
      `${JSON.stringify(body.kit, null, 2)}\n`,
      "utf8",
    );
    return NextResponse.json({ ok: true, id: kit.id });
  }

  if (body.action === "saveBrief") {
    const brief = body.brief ?? {};
    const name = brief.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Brief needs a name." },
        { status: 400 },
      );
    }
    const slug = slugify(name);
    const md = [
      `# Proposed mechanic: ${name}`,
      "",
      `> Captured from Kit Lab. NOT YET IMPLEMENTED — pending engine support.`,
      "",
      `- **Trigger (when it fires):** ${brief.trigger ?? "TODO"}`,
      `- **Rule + numbers:** ${brief.rule ?? "TODO"}`,
      `- **Stacking:** ${brief.stacking ?? "TODO"}`,
      `- **Duration:** ${brief.duration ?? "TODO"}`,
      `- **Removed by:** ${brief.removal ?? "TODO"}`,
      "",
      `## Notes`,
      brief.notes ?? "",
      "",
    ].join("\n");

    await fs.mkdir(BRIEFS_DIR, { recursive: true });
    await fs.writeFile(path.join(BRIEFS_DIR, `${slug}.md`), md, "utf8");
    return NextResponse.json({ ok: true, slug });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
