// Capture the live screens at phone size from a scratch dev server, with an
// owned roster seeded into the browser's own localStorage (never data/).
//
//   NEXT_DIST_DIR=.next-verify npx next dev -p 3210        # in another shell
//   node scripts/capture-screens.mjs --out /tmp/shots [--base http://localhost:3210]
//        [--routes /,/archive,/events,/gacha,/profile] [--no-seed] [--full]
//
// Writes <out>/live-<name>.png per route (viewport-sized; --full adds a
// full-page copy) and prints each page's scroll height. The `redesign` skill
// uses it to draw a mockup against what is actually on screen, and
// `mobilecheck` to measure a screen. Needs the repo's devDependency
// `playwright`; in the cloud container the browser is at /opt/pw-browsers.
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://localhost:3210");
const out = opt("out", null);
if (!out) {
  console.error("--out <dir> is required");
  process.exit(1);
}
const routes = opt("routes", "/,/archive,/events,/gacha,/profile,/login,/practice").split(",");
const seed = !args.includes("--no-seed");
const full = args.includes("--full");

const browser = await chromium
  .launch({ executablePath: "/opt/pw-browsers/chromium" })
  .catch(() => chromium.launch());
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

if (seed) {
  // Own a handful of units at different levels, with gems and stamina, so the
  // archive, the picker and the summon screen show their real states.
  const fields = await page.evaluate(() => {
    const key = "toll-player-storage";
    const raw = localStorage.getItem(key);
    if (!raw) return "no storage yet";
    const data = JSON.parse(raw);
    const s = data.state;
    const own = ["duke", "lyra", "sara", "batra", "yalina", "seras", "meliodas"];
    const levels = [12, 20, 8, 1, 15, 5, 30];
    const ults = [2, 3, 1, 0, 2, 0, 5];
    s.roster = Array.from(new Set([...(s.roster || []), ...own]));
    s.characters = s.characters || {};
    const proto = s.characters.duke || {};
    own.forEach((id, i) => {
      s.characters[id] = { ...proto, ...(s.characters[id] || {}), level: levels[i], ultLevel: ults[i] };
    });
    if (s.currencies) {
      s.currencies.gems = 3250;
      s.currencies.coin = 48200;
    }
    if (s.account && typeof s.account.rank === "number") s.account.rank = 9;
    localStorage.setItem(key, JSON.stringify(data));
    return Object.keys(s.characters.duke || {}).join(",");
  });
  console.log("seeded; progress fields:", fields);
}

for (const path of routes) {
  const name = path === "/" ? "home" : path.replace(/^\//, "").replace(/\//g, "-");
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  // The browser pane lies about transitions (AGENTS.md); freeze them.
  await page.addStyleTag({ content: "*{transition:none!important;animation:none!important}" });
  await page.screenshot({ path: `${out}/live-${name}.png` });
  if (full) await page.screenshot({ path: `${out}/live-${name}-full.png`, fullPage: true });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`${name}: scrollHeight ${h}`);
}
await browser.close();
