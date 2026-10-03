import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { GAME_ROUTES } from "@/lib/nav/routes";
import {
  summariseRank,
  summariseWorldLevel,
} from "@/lib/game/accountSummary";
import {
  describeRewardPart,
  rewardParts,
  ticketNoun,
} from "@/lib/game/rewardParts";
import { rewardRows } from "@/lib/game/worldBossPreview";
import { getBossTier } from "@/lib/game/worldBossRewards";

/**
 * Audit group 3 (2026-10-03): one job, one implementation.
 *
 * Each extraction below has a source scan that forbids the hand-rolled
 * pattern it replaced, because the failure it exists to stop is the sixth
 * copy of a thing quietly appearing. A scan is only worth having once it has
 * been seen to fail, so each one names what it catches.
 */

/** Every `.tsx` under `app/` and `components/`, as `[relative path, source]`. */
function screens(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) {
        out.push([full.replaceAll("\\", "/"), fs.readFileSync(full, "utf8")]);
      }
    }
  };
  walk("app");
  walk("components");
  return out;
}

/** A comment naming the thing that was removed is not the thing itself. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Files that contain `pattern`, excluding the file that owns the pattern. */
function filesMatching(pattern: RegExp, owner: string[] = []): string[] {
  return screens()
    .filter(([file]) => !owner.includes(file))
    .filter(([, source]) => pattern.test(stripComments(source)))
    .map(([file]) => file);
}

describe("the back control is one component (3.1)", () => {
  it("draws its chevron nowhere but BackLink and the unit stepper", () => {
    expect(
      filesMatching(/ChevronLeft/, [
        "components/ui/BackLink.tsx",
        // Steps to the previous unit; not a way back.
        "components/game/battle/UnitDetailPanel.tsx",
      ]),
    ).toEqual([]);
  });

  it("has no unicode arrow or 'Back to' label left", () => {
    // `← Older` and `← Prev` are paging, not a way back, so only a
    // destination after the arrow counts.
    expect(
      filesMatching(
        /←\s*(News|Events|Menu|Character|Characters)\b|[>"'`]\s*Back to (the )?(events|stages|menu)/i,
      ),
    ).toEqual([]);
  });
});

describe("a picked tile is one component (3.2)", () => {
  it("writes the picked slab only in SelectTile", () => {
    expect(
      filesMatching(/border-rule hover:border-border/, [
        "components/ui/SelectTile.tsx",
      ]),
    ).toEqual([]);
  });
});

describe("an empty list says so through one component (3.3)", () => {
  it("has no muted <p> that starts 'No ...' or 'Nothing ...'", () => {
    expect(
      filesMatching(/<p\b[^>]*text-muted-foreground[^>]*>\s*(No |Nothing )/),
    ).toEqual([]);
  });
});

describe("chips are Badges (3.4)", () => {
  it("hand-writes no skill-type chip or log chip", () => {
    expect(
      filesMatching(
        /border border-border px-1\.5 py-0\.5 font-body|bg-destructive px-1 font-bold uppercase/,
      ),
    ).toEqual([]);
  });
});

describe("rewards are formatted once (3.5)", () => {
  it("agrees on the plural of a ticket", () => {
    expect(ticketNoun(1)).toBe("ticket");
    expect(ticketNoun(2)).toBe("tickets");
    expect(
      describeRewardPart(rewardParts({ permanentTicket: 1 })[0]),
    ).toBe("1 ticket");
    expect(
      describeRewardPart(rewardParts({ permanentTicket: 3 })[0]),
    ).toBe("3 tickets");
  });

  it("leads with a character, then currencies, then materials", () => {
    const parts = rewardParts({
      character: "duke",
      gems: 5,
      coin: 1200,
      materials: { training_manual: 2 },
    });
    expect(parts.map((part) => part.kind)).toEqual([
      "character",
      "currency",
      "currency",
      "material",
    ]);
    expect(parts.map(describeRewardPart)).toEqual([
      expect.any(String),
      "5 gems",
      "1,200 coin",
      expect.stringMatching(/^2× /),
    ]);
  });

  it("drops zeroes", () => {
    expect(rewardParts({ gems: 0, coin: 0, materials: { training_manual: 0 } })).toEqual(
      [],
    );
  });

  it("names the ticket row 'Tickets', not 'Permanent Ticket'", () => {
    const rows = rewardRows(getBossTier(1).firstClear);
    const labels = rows.map(([, label]) => label);
    expect(labels).not.toContain("Permanent Ticket");
    for (const [, label, amount] of rows) expect(amount, label).toBeGreaterThan(0);
  });

  it("does not rebuild the parts by hand in the Orders board", () => {
    expect(
      filesMatching(/function rewardParts\(|ticket\$\{[^}]*\? "s"/),
    ).toEqual([]);
  });
});

describe("rank and clock logic is shared (3.6)", () => {
  const account = { rank: 5, xp: 50, clearedWalls: [] as number[] };

  it("fills the bar from the xp the next rank needs", () => {
    const rank = summariseRank(account);
    expect(rank.walled).toBe(false);
    expect(rank.progress?.current).toBe(50);
    expect(rank.percent).toBeCloseTo(
      (50 / (rank.progress?.required ?? 1)) * 100,
    );
    expect(rank.nextRank).toBe(6);
  });

  it("reads a rank held at a wall as a full, walled bar", () => {
    const rank = summariseRank({ rank: 20, xp: 999, clearedWalls: [] });
    expect(rank.walled).toBe(true);
    expect(rank.percent).toBe(100);
    expect(rank.progress).toBeNull();
  });

  it("names the wall that lifts the world level cap", () => {
    const early = summariseWorldLevel(5);
    expect(early.atMaximum).toBe(false);
    expect(early.nextWall).toBe(20);
    expect(summariseWorldLevel(60).atMaximum).toBe(true);
  });

  it("keeps the rank bar and the 30s clock in one place each", () => {
    // The top bar and the profile page each drew the bar by hand.
    for (const file of ["components/ui/TopNav.tsx", "app/profile/page.tsx"]) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      expect(source, file).not.toMatch(/transition-\[width\]/);
      expect(source, file).not.toMatch(/rankProgress\(/);
      expect(source, file).not.toMatch(/setInterval\(/);
    }
  });
});

describe("the tab bar is derived from the routes (3.7)", () => {
  it("flags the four tabs the phone has always had, with their labels", () => {
    const tabs = GAME_ROUTES.filter((route) => route.tab).map((route) => [
      route.href,
      route.tabLabel ?? route.navLabel ?? route.label,
    ]);
    expect(tabs).toEqual([
      ["/", "Menu"],
      ["/events", "Events"],
      ["/gacha", "Gacha"],
      ["/profile", "You"],
    ]);
  });

  it("lists no tab by hand in TopNav", () => {
    const source = fs.readFileSync("components/ui/TopNav.tsx", "utf8");
    expect(source).not.toMatch(/label: "Menu"/);
    expect(source).not.toMatch(/five slots|Five destinations/i);
  });
});

describe("the collection is called Characters (3.8)", () => {
  it("labels its route 'Characters' and uses the book icon", () => {
    const route = GAME_ROUTES.find((r) => r.href === "/archive");
    expect(route?.label).toBe("Characters");
    expect(route?.navLabel).toBeUndefined();
    const nav = fs.readFileSync("components/ui/TopNav.tsx", "utf8");
    expect(nav).toMatch(/"\/archive": BookOpen/);
    expect(nav).not.toMatch(/ARCHIVE_ICON/);
  });

  it("says Archive or Roster in no label a player reads", () => {
    expect(
      filesMatching(
        />\s*(Archive|Character Archive|Your characters|Your roster)\s*<|(title|label)="(Archive|Roster)"/,
      ),
    ).toEqual([]);
  });
});

describe("one word per job (3.9)", () => {
  it("has no 'Foe' in a label", () => {
    expect(filesMatching(/label="Foe"|plays the foe/)).toEqual([]);
  });

  it("starts every fight with 'Fight' and leaves with 'Leave'", () => {
    expect(
      filesMatching(
        /["'>]\s*(Start (boss )?battle|Enter battle|Rematch|Retry battle|Change teams|Main menu)\s*["'<]/i,
      ),
    ).toEqual([]);
  });

  it("types no label in capitals for CSS to do", () => {
    // A whole line of JSX text in capitals, `TOLL` (the wordmark) aside.
    const offenders: string[] = [];
    for (const [file, source] of screens()) {
      for (const line of stripComments(source).split("\n")) {
        const text = line.trim();
        if (/^[A-Z][A-Z' —-]{5,}$/.test(text) && text !== "TOLL") {
          offenders.push(`${file}: ${text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("a screen sits in the Screen shell (3.10)", () => {
  it("lets the practice bench use it, not its own max-w-6xl column", () => {
    const source = fs.readFileSync("components/game/TeamSelect.tsx", "utf8");
    expect(source).toMatch(/<Screen\b/);
    expect(source).not.toMatch(/max-w-6xl/);
  });
});

describe("a navigation tile is one component (3.11)", () => {
  it("builds no pressable panel on Home, Profile or the Orders tile by hand", () => {
    for (const file of [
      "components/HomeMenu.tsx",
      "app/profile/page.tsx",
      "components/game/OrdersButton.tsx",
    ]) {
      expect(stripComments(fs.readFileSync(file, "utf8")), file).not.toMatch(
        /press: true|PROFILE_TILE|HUB_TILE/,
      );
    }
  });
});

describe("a collapsible row is one component (3.12)", () => {
  it("sets aria-expanded only in DisclosureRow", () => {
    expect(
      filesMatching(/aria-expanded=/, ["components/ui/DisclosureRow.tsx"]),
    ).toEqual([]);
  });
});

describe("sheets share one shell (3.13)", () => {
  it("keeps PanelSheet in components/ui and nowhere else", () => {
    expect(fs.existsSync("components/ui/PanelSheet.tsx")).toBe(true);
    expect(fs.existsSync("components/gacha/PanelSheet.tsx")).toBe(false);
  });

  it("opens Growth in a sheet, not a dialog", () => {
    const source = fs.readFileSync(
      "components/game/CharacterProgressionPanel.tsx",
      "utf8",
    );
    expect(source).toMatch(/<PanelSheet\b/);
    expect(source).not.toMatch(/DialogContent/);
  });
});

describe("repeated sizes are tokens (3.14)", () => {
  it("types the unit tile cap and the drawer width as tokens", () => {
    expect(filesMatching(/max-w-\[112px\]|w-\[360px\]|max-w-\[360px\]/)).toEqual(
      [],
    );
    const css = fs.readFileSync("styles/globals.css", "utf8");
    expect(css).toMatch(/--container-unit:/);
    expect(css).toMatch(/--container-drawer:/);
  });
});
