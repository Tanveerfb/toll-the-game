# Gacha / Summon Design

> Status: DESIGN IN PROGRESS (Tanveer). Drafted 2026-07-18. Not built.
> Planned since the game's writing began. Part of the monetization core (see PRODUCT_AUDIT.md).

## Rarities
Two tiers: **Premium** and **Standard**. Same on-banner pull rate — the difference is **power, not rarity**: Premium units have **higher base stats and stronger, more elaborate kits** than Standard.

## Free (non-gacha) characters
- **Duke** — starter, given at the beginning.
- **Lyra** — awarded after clearing **Chapter 2** (story reward, not a pull).

## Banner structure
- Each banner runs **3 weeks**.
- Base pattern: **one Premium + one Standard** featured together on the same banner.
- **Collab banners** bundle by IP and can break the 1+1 pattern:
  - **7DS collab:** Meliodas, Ban, Diane — **all Premium**.
  - **HxH collab:** Gon (Premium), Killua (Premium), Leorio (Standard).

### Planned banners (rarity per unit)
| Banner | Premium | Standard |
|---|---|---|
| Batra / Gabrist | Batra | Gabrist |
| Sara / Yalina | Sara | Yalina |
| Mustafa / Siddiq | Mustafa | Siddiq |
| 7DS collab | Meliodas, Ban, Diane | - |
| HxH collab | Gon, Killua | Leorio |

## Rates
- **Featured pull rate depends on unit count, split EQUALLY among featured:**
  - **2 featured units -> 5% total** (2.5% each; e.g. Sara + Yalina banner).
  - **3+ featured units -> 7% total** (~2.33% each; e.g. collab banners).
  - Premium and Standard on the same banner have the **same pull rate** - Premium is a **power/prestige tier, not a rarer pull** (stronger kit / higher investment ceiling; rarity split is NOT a rate difference).
  - Generous vs Hoyo (Genshin 5-star = 0.6%), closer to 7DSGC. Player-friendly.
- **Pity:** **hard pity at 80** (guaranteed featured), **soft pity from 70** (rate ramps toward the cap). Counter **carries over between banners**. On a multi-unit banner the hard-pity unit is **player-picked**.
- **Collab banners:** all featured units on **one banner** at a **constant shared rate** for the full 3-week duration (not staggered).

## Economy & pull system (LOCKED 2026-07-18)
- **Two currencies:** an in-world **money currency** (~rupee; the mora/credits analog, used for ascension/upgrades) and a separate **gacha pull currency** (name TBD - workshop; free + paid).
- **Pull options:** single pull, or a **multi-pull of 11 for the price of 10** (7DSGC-style discount).
- **F2P faucet:** roughly **1-2 free pulls per day** from dailies/events.

---

## LOCKED (2026-07-18)

- **Non-featured pull outcome:** **currency + materials only** (no off-banner characters; every character obtainable only on their banner, and via re-runs).
- **Dupes -> Ultimate Level system** (this IS the "ult level-up" long parked as STATUS open issue #6):
  - Each dupe raises the character's **Ultimate Level**, **max 6**. All characters start at **1/6**.
  - Higher ult level = **higher ult multiplier**, and **additional effects unlock at Lv 4 and/or 6**.
  - Distinct from skill card rank (r1->r3), which drives *skill* multipliers.
- **Currency:** a unique in-world currency, name TBD (Tanveer: maybe rupee-derived).
- **Materials:** themed drops (e.g. flowers, emblems).
- **Ascension cost model:** `[boss signature drop] + [local specialty] + [currency]` per band (may expand). Mirrors Genshin (boss drop + local specialty + coin).
- **Local specialty = broad, theme/backstory-linked per character** (not a strict region system): Duke -> an item found in a village (backstory link); Lyra -> a forest-area item (her first-appearance location). Rest to brainstorm.
- **Skill rank r1->r3 is NOT meta-progression** - it's a battle-internal mechanic (cards enter deck at r1, merge identical cards in-hand mid-fight to rank up, cap r3; `store/gameStore.ts`). No farm/upgrade path needed. Meta axes are only char level + ascension + ult level.

## OPEN (tuning, non-blocking)

1. **Gacha pull-currency name** (workshop).
2. **Per-level leveling fuel** — within a band, does Lv->Lv cost currency only, or currency + a common mat? (ascension band gates are fully specced below.)
3. **Ascension per-band stat-bump distribution** — the +stat granted at each of the 6 ascension unlocks (they sum to take a fully-ascended Lv60 unit to ~3x base; see plan doc).
4. **Ult per-level multiplier step** — how much the ult multiplier rises per level 1->6 (stat-only for now, no special effects).
5. **Local specialty items** for the remaining characters (theme/backstory-linked) — brainstorm.

## RESOLVED
Non-featured pull = currency+mats only; dupes -> Ultimate Level 1/6->6/6 (**stat/multiplier bump only for now**, no Lv4/6 special effects yet; future chars may add them); rate 5% (2 units) / 7% (3+), split equally; **pity 80 hard / 70 soft, carries between banners, hard-pity unit player-picked**; rarity = power-tier not pull-rate (Premium = higher stats + stronger kits); skill rank r1->r3 is an in-battle merge mechanic (not meta); ascension = boss drop + local specialty + currency; local specialty theme-linked per character; free chars Duke (start) + Lyra (Ch2); **pull = single or 11-for-10 multi**; **~1-2 free pulls/day**; collab = one banner, constant shared rate, full duration.

## Reuse notes (from PRODUCT_AUDIT)
- Archive/codex -> gacha pool browser (owned/unowned + "new!").
- Ult cut-in / cinematics tech -> summon reveal animations.
- Art pipeline -> banner splash art.
- `users/{uid}` doc -> roster ownership + wallet + pity counters.
