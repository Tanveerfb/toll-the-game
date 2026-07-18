# Product & Experience Audit — Monetization Readiness

> Drafted 2026-07-18. Reference points: **Seven Deadly Sins: Grand Cross (7DSGC)**, **Genshin Impact**, **Honkai: Star Rail (HSR)**.
> Purpose: identify what to **add / change / organize / repurpose** to turn a strong combat prototype into a live, monetizable, retainable game.
> Cadence goal: patch notes + content updates every ~3 weeks; scalable to more players.

---

## 1. Executive summary

The **combat core is genuinely strong** — deep kit system (42 typed mechanics, multiplicative stacking, rank system, subs, evade/crit/type-advantage), a tested engine (182 tests), battle cinematics, a Dokkan-style archive, and a full AI-art roster. This is the hard part of a gacha battler and it's largely done.

What's missing is **everything around the fight that makes players come back and spend**: no onboarding, no daily loop, no collection/acquisition system, no economy, no audio, no social, no live-ops scaffolding. In gacha terms we've built the *battle* but not the *game-as-a-service*.

**The single biggest lever:** a **character acquisition system (summon/gacha)** + a **core daily loop**. Everything monetizable in 7DSGC/Hoyo hangs off "pull characters → build them → clear content → earn currency → pull more." We have the *build* (leveling plan) and *clear* (battles/story) halves; we're missing *acquire* and *loop*.

---

## 2. Current strengths (keep + build on)

- Combat depth & correctness (rulings-driven, tested) — our differentiator.
- Kit/mechanic authoring pipeline (JSON + Zod validation) — content-scalable.
- AI art pipeline (ComfyUI) — cheap, fast roster/enemy/boss art.
- Story mode (VN + canon battles), archive/codex, battle cinematics.
- Firebase auth + `users/{uid}` cloud saves — account backbone exists.
- Clean tech (Next 16 / React 19 / typed, self-hosted art) — deployable.

---

## 3. Gap analysis (vs 7DSGC / Hoyo)

| Pillar | Current state | What the references do | Gap severity |
|---|---|---|---|
| **Onboarding / FTUE** | Drops into menu; no tutorial | Scripted first-battle tutorial, guided pulls, gift new player a strong unit | **Critical** |
| **Core daily loop** | None | Stamina dungeons, daily missions, login calendar, weekly bosses, events | **Critical** |
| **Acquisition / collection** | Fixed roster, all unlocked | Gacha/summon banners, pity, dupes→limit-break, "owned vs not" | **Critical (monetization core)** |
| **Progression** | Card ranks only; leveling *planned* | Level + ascension + skill levels + gear/relics + affinity | **High** (plan started — see WORLD_BOSS_AND_ASCENSION_PLAN) |
| **Economy / currencies** | None | Soft (gold), premium (crystals/jade), stamina, event tokens, shops | **Critical** |
| **Monetization surfaces** | None | Banners, battle pass, monthly card, starter/value packs, shop | **Critical** |
| **Audio (SFX + music)** | None (known) | Full BGM per screen, hit/skill/ult SFX, UI clicks, voice | **High** (juice/retention) |
| **VFX / juice polish** | Cinematics done; per-skill flavor pending (#20) | Distinct skill VFX, screen shake, banners, results fanfare | **Medium** |
| **Social** | None | Friends, co-op boss, arena/PvP, leaderboards, guilds, chat | **Medium** (retention, later) |
| **Live-ops scaffolding** | Manual | Mailbox/rewards, push notifications, event scheduler, remote config, version gate | **High** |
| **Account & compliance** | Auth only | Gacha odds disclosure, ToS/privacy, age gate, refund/payment flows | **Critical for launch** (legal) |
| **Mobile / platform** | Desktop-first; mobile pass pending (#20) | Mobile-first, portrait, touch-tuned | **High** (audience is mobile) |
| **Settings / a11y** | Minimal | Audio sliders, language, graphics, data, reduced-motion (partial) | **Medium** |
| **Analytics** | Battle-log dump only | Funnels, retention, spend, balance telemetry | **High** (can't run live-ops blind) |

---

## 4. Add / Change / Organize / Repurpose

**ADD (new systems)**
- Summon/gacha + banner + pity + dupe/limit-break.
- Currencies (soft/premium/stamina/event) + wallet + shop.
- Daily/weekly missions, login calendar, mailbox.
- FTUE tutorial flow.
- Audio system (BGM + SFX bus, per-event hooks).
- Battle pass / monthly card / starter packs.
- Event scheduler + remote config + push notifications.
- Analytics instrumentation.
- Leveling/ascension + stamina + world boss (already planned).

**CHANGE (rework existing)**
- Roster: "all unlocked" → owned/unowned collection gated by acquisition; team select pulls from owned.
- `playerStore` stub → real player profile (wallet, roster ownership, progression, stamina).
- Main menu → live-service hub (dailies, events, banner spotlight, stamina, mailbox badge).
- Battles → award currency/mats/XP on the results screen (results screen doesn't exist yet as a reward surface).
- Mobile-first layout pass (audience reality).

**ORGANIZE (structure for scale + a 3-week cadence)**
- A **content manifest / version file** so a patch = data bump (characters, banners, events, story) without code redeploys where possible.
- Feature-flag / remote-config layer to schedule events and toggle banners.
- Split docs: design specs vs live-ops runbook vs patch-notes changelog.
- Balance data (base stats, drop rates, gacha odds) into reviewable data files, not code.

**REPURPOSE (reuse what's built)**
- Archive/codex → double as the **collection/gacha pool browser** (owned state + "new!" tags).
- Story battles → **also** stamina-gated farmable stages (reuse `startCustomBattle`).
- Battle cinematics/ult cut-ins → **summon reveal** animations (same emit→sequence tech).
- The AI-art pipeline → banner splashes, event CG, boss art (already the engine for it).
- `storyProgress` on `users/{uid}` → the template for stamina/inventory/roster persistence.
- Battle-log event stream (`BattleActionEvent`) → the basis for analytics/telemetry.

---

## 5. Phased roadmap to monetization

**Phase 0 — Foundation (pre-money, makes it a "game")**
Audio (BGM+SFX), FTUE tutorial, mobile pass, real `playerStore` (wallet/roster/progression), results-screen rewards, settings. *Goal: a first-time player has a complete, juicy loop.*

**Phase 1 — Progression & loop**
Character leveling/ascension + stamina + world boss (planned), daily/weekly missions, login calendar, mailbox. *Goal: reasons to return daily.*

**Phase 2 — Acquisition (the monetization core)**
Currencies + summon/gacha + pity + banners + collection ownership + shop. *Goal: the pull→build→clear→earn→pull flywheel.*

**Phase 3 — Commerce**
Premium currency purchase (payment provider), starter/value packs, battle pass, monthly card. **Gate on compliance** (odds disclosure, ToS/privacy, age gate, refunds).

**Phase 4 — Live-ops & social**
Event scheduler + remote config + push, analytics dashboards, then social (friends/co-op/arena/leaderboards/guilds). *Goal: sustain the 3-week cadence + deepen retention.*

---

## 6. Monetization model (recommendation)

Copy the proven **gacha + battle pass + subscription** stack, tuned fair:
- **Premium pulls** on rotating character banners (hard pity + spark, published odds — legally required in many regions).
- **Battle pass** (free + paid track) per event cycle.
- **Monthly card** (daily premium-currency drip) — best value/retention anchor in the genre.
- **Starter & value packs**, cosmetic/QoL (stamina refills, inventory) — avoid hard pay-to-win beyond the genre norm.
- Keep a generous F2P currency faucet (dailies/events/achievements) — retention feeds spend.

**Compliance is a launch blocker, not a nicety:** gacha odds disclosure, ToS + privacy policy, age gate, regional payment/refund handling, and (if targeting minors) stricter rules. Budget legal review before Phase 3.

---

## 7. Instrument before you sell

Can't run a 3-week live-ops cadence blind. Add analytics for: FTUE funnel/drop-off, D1/D7/D30 retention, daily-active loop completion, stamina spend, gacha pull economy, battle balance (win rates, character usage/power), and (Phase 3) ARPU/conversion. The existing `BattleActionEvent` stream is a ready foundation for balance telemetry.

---

## 8. Bottom line

We have the **best-in-class-for-a-solo-project combat core** and almost none of the **service layer**. Priority order that respects dependencies:

1. **Juice + FTUE + mobile** (make it feel like a game),
2. **Progression + daily loop** (make them return),
3. **Acquisition + economy** (the monetization flywheel),
4. **Commerce + compliance** (turn it on, legally),
5. **Live-ops + social** (sustain + grow).

Nothing here touches the combat engine — it's all the wrapper the engine has earned.
