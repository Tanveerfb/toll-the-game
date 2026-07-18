"use client";

import React from "react";
import { useRouter } from "next/navigation";
import KitDetails, { type KitPassiveView } from "@/components/game/KitDetails";
import { buildCharacterDamagePreview } from "@/lib/game/damagePreview";
import { buildRankedSkillDescriptions } from "@/lib/game/descriptionTranslator";
import { analyzeKitBalance, type BalanceFlag } from "@/lib/game/balance";
import {
  getAllCharacters,
  getPlayableCharacters,
  registerDraftCharacter,
  type CharacterSkillData,
} from "@/lib/game/characterCatalog";
import {
  ALL_MECHANIC_TYPES,
  MECHANIC_INFO,
  mechanicTemplate,
} from "@/lib/game/mechanicTemplates";
import { useBattleContext } from "@/hooks/BattleProvider";
import {
  asCharacterData,
  blankKit,
  blankSkill,
  validateKit,
  type DraftKit,
  type DraftMechanic,
  type DraftSkill,
} from "@/components/kit-lab/kitDraft";
import type { MechanicType } from "@/types/mechanic";

const COLORS = ["light", "red", "blue", "green", "dark"] as const;
const STAT_MULTS = ["atk", "def", "hp"] as const;
const SKILL_TYPES = ["attack", "buff", "debuff", "stance", "heal", "ultimate"];
const PASSIVE_TRIGGERS = [
  "onBattleStart",
  "aura",
  "always",
  "beforeSkill",
  "afterSkill",
  "onAllySkill",
  "onAttackReceived",
  "onDamageDealt",
  "onNewTurn",
];

const inputCls =
  "w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none";
const labelCls = "text-[11px] uppercase tracking-wide text-zinc-500";
const btnCls =
  "rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:border-amber-500 disabled:opacity-40";
const cardCls = "rounded-lg border border-zinc-800 bg-zinc-950/60 p-3";

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

// --- Mechanic editing -----------------------------------------------------

function MechanicEditor({
  mech,
  onChange,
  onRemove,
}: {
  mech: DraftMechanic;
  onChange: (next: DraftMechanic) => void;
  onRemove: () => void;
}) {
  const keys = Object.keys(mech).filter((k) => k !== "type");
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-amber-400">{mech.type}</span>
        <button
          className="text-xs text-zinc-500 hover:text-red-400"
          onClick={onRemove}
        >
          remove
        </button>
      </div>
      <p className="mb-2 text-[11px] text-zinc-500">
        {MECHANIC_INFO[mech.type as MechanicType]?.desc}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {keys.map((key) => {
          const value = mech[key];
          if (typeof value === "boolean") {
            return (
              <label key={key} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => onChange({ ...mech, [key]: e.target.checked })}
                />
                {key}
              </label>
            );
          }
          if (typeof value === "number") {
            return (
              <Labeled key={key} label={key}>
                <input
                  className={inputCls}
                  type="number"
                  value={value}
                  onChange={(e) =>
                    onChange({ ...mech, [key]: Number(e.target.value) })
                  }
                />
              </Labeled>
            );
          }
          if (typeof value === "string") {
            return (
              <Labeled key={key} label={key}>
                <input
                  className={inputCls}
                  value={value}
                  onChange={(e) => onChange({ ...mech, [key]: e.target.value })}
                />
              </Labeled>
            );
          }
          // array/object -> JSON
          return (
            <Labeled key={key} label={`${key} (json)`}>
              <input
                className={inputCls}
                defaultValue={JSON.stringify(value)}
                onBlur={(e) => {
                  try {
                    onChange({ ...mech, [key]: JSON.parse(e.target.value) });
                  } catch {
                    /* ignore malformed until valid */
                  }
                }}
              />
            </Labeled>
          );
        })}
      </div>
    </div>
  );
}

function MechanicsList({
  mechanics,
  onChange,
}: {
  mechanics: DraftMechanic[];
  onChange: (next: DraftMechanic[]) => void;
}) {
  const [pick, setPick] = React.useState<MechanicType>("buff");
  return (
    <div className="space-y-2">
      {mechanics.map((m, i) => (
        <MechanicEditor
          key={i}
          mech={m}
          onChange={(next) =>
            onChange(mechanics.map((x, j) => (j === i ? next : x)))
          }
          onRemove={() => onChange(mechanics.filter((_, j) => j !== i))}
        />
      ))}
      <div className="flex gap-2">
        <select
          className={inputCls}
          value={pick}
          onChange={(e) => setPick(e.target.value as MechanicType)}
        >
          {ALL_MECHANIC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          className={btnCls}
          onClick={() =>
            onChange([...mechanics, mechanicTemplate(pick) as DraftMechanic])
          }
        >
          + add
        </button>
      </div>
    </div>
  );
}

// --- Skill editing --------------------------------------------------------

function SkillEditor({
  skill,
  onChange,
  isUlt,
}: {
  skill: DraftSkill;
  onChange: (next: DraftSkill) => void;
  isUlt?: boolean;
}) {
  return (
    <div className={cardCls}>
      <div className="grid grid-cols-2 gap-2">
        <Labeled label="name">
          <input
            className={inputCls}
            value={skill.skillName}
            onChange={(e) => onChange({ ...skill, skillName: e.target.value })}
          />
        </Labeled>
        <Labeled label="type">
          <select
            className={inputCls}
            value={skill.type}
            onChange={(e) => onChange({ ...skill, type: e.target.value })}
          >
            {SKILL_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Labeled>
        <Labeled label="statMultiplier">
          <select
            className={inputCls}
            value={skill.statMultiplier}
            onChange={(e) =>
              onChange({
                ...skill,
                statMultiplier: e.target.value as DraftSkill["statMultiplier"],
              })
            }
          >
            {STAT_MULTS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Labeled>
        {isUlt ? (
          <Labeled label="damage (single)">
            <input
              className={inputCls}
              type="number"
              value={skill.damage ?? 0}
              onChange={(e) =>
                onChange({ ...skill, damage: Number(e.target.value) })
              }
            />
          </Labeled>
        ) : (
          <Labeled label="damageRanked r1/r2/r3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  className={inputCls}
                  type="number"
                  value={skill.damageRanked?.[i] ?? 0}
                  onChange={(e) => {
                    const dr = [...(skill.damageRanked ?? [0, 0, 0])];
                    dr[i] = Number(e.target.value);
                    onChange({ ...skill, damageRanked: dr });
                  }}
                />
              ))}
            </div>
          </Labeled>
        )}
      </div>
      <div className="mt-2">
        <span className={labelCls}>mechanics</span>
        <MechanicsList
          mechanics={skill.mechanics ?? []}
          onChange={(m) => onChange({ ...skill, mechanics: m })}
        />
      </div>
    </div>
  );
}

// --- Right-panel views ----------------------------------------------------

function SimulatorView({ kit }: { kit: DraftKit }) {
  const rows = React.useMemo(() => {
    try {
      return buildCharacterDamagePreview(asCharacterData(kit));
    } catch {
      return [];
    }
  }, [kit]);

  return (
    <div className="space-y-1 text-sm">
      {rows.length === 0 ? (
        <p className="text-zinc-500">No damage rows (add skills with damage).</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1">Ability</th>
              <th>Rank</th>
              <th>Mult</th>
              <th>Scenario</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800">
                <td className="py-1">{r.abilityName}</td>
                <td>{r.rankLabel}</td>
                <td>{r.multiplierLabel}</td>
                <td>{r.scenarioLabel}</td>
                <td className="text-amber-300">{r.resultLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BalanceView({ kit }: { kit: DraftKit }) {
  const flags: BalanceFlag[] = React.useMemo(() => {
    const roster = getPlayableCharacters().filter((c) => c.id !== kit.id);
    try {
      return analyzeKitBalance(asCharacterData(kit), roster);
    } catch {
      return [];
    }
  }, [kit]);

  if (flags.length === 0) {
    return <p className="text-sm text-emerald-400">No balance flags. Looks on-curve.</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {flags.map((f, i) => (
        <li
          key={i}
          className={`rounded border p-2 ${
            f.severity === "error"
              ? "border-red-800 bg-red-950/40 text-red-300"
              : "border-amber-800 bg-amber-950/30 text-amber-300"
          }`}
        >
          <span className="font-mono text-[11px] uppercase">{f.severity}</span>{" "}
          {f.message}
        </li>
      ))}
    </ul>
  );
}

function DescriptionsView({ kit }: { kit: DraftKit }) {
  const data = asCharacterData(kit);
  const all: CharacterSkillData[] = [
    ...data.skills,
    ...(data.ultimate ? [data.ultimate] : []),
  ];
  return (
    <div className="space-y-3 text-sm">
      {all.map((s, i) => (
        <div key={i} className={cardCls}>
          <p className="mb-1 font-semibold text-amber-300">{s.skillName}</p>
          {buildRankedSkillDescriptions(s).map((d, r) => (
            <p key={r} className="text-xs text-zinc-300">
              <span className="text-zinc-500">R{r + 1}:</span> {d}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- New-mechanic brief ---------------------------------------------------

function BriefForm({ onSaved }: { onSaved: (msg: string) => void }) {
  const [brief, setBrief] = React.useState<Record<string, string>>({});
  const field = (k: string, label: string, area = false) => (
    <Labeled label={label}>
      {area ? (
        <textarea
          className={inputCls}
          rows={2}
          value={brief[k] ?? ""}
          onChange={(e) => setBrief({ ...brief, [k]: e.target.value })}
        />
      ) : (
        <input
          className={inputCls}
          value={brief[k] ?? ""}
          onChange={(e) => setBrief({ ...brief, [k]: e.target.value })}
        />
      )}
    </Labeled>
  );
  return (
    <div className="space-y-2">
      {field("name", "mechanic name")}
      {field("trigger", "trigger (when it fires)")}
      {field("rule", "rule + numbers", true)}
      {field("stacking", "stacking")}
      {field("duration", "duration")}
      {field("removal", "removed by")}
      {field("notes", "notes", true)}
      <button
        className={btnCls}
        onClick={async () => {
          const res = await fetch("/api/kit-lab", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "saveBrief", brief }),
          });
          const json = await res.json();
          onSaved(
            res.ok
              ? `Saved brief -> docs/proposed-mechanics/${json.slug}.md`
              : `Error: ${json.error}`,
          );
        }}
      >
        Save brief
      </button>
    </div>
  );
}

// --- Main -----------------------------------------------------------------

export default function KitLab() {
  const router = useRouter();
  const { startCustomBattle } = useBattleContext();
  const [kit, setKit] = React.useState<DraftKit>(blankKit());
  const [tab, setTab] = React.useState<
    "preview" | "descriptions" | "sim" | "balance" | "brief"
  >("preview");
  const [ids, setIds] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<string>("");
  const [enemyId, setEnemyId] = React.useState<string>("raider");

  const update = (partial: Partial<DraftKit>) =>
    setKit((k) => ({ ...k, ...partial }));

  React.useEffect(() => {
    fetch("/api/kit-lab")
      .then((r) => r.json())
      .then((j) => setIds(j.ids ?? []))
      .catch(() => setIds([]));
  }, []);

  const validation = validateKit(kit);
  const allChars = getAllCharacters();

  async function loadKit(id: string) {
    if (!id) return;
    const r = await fetch(`/api/kit-lab?id=${id}`);
    const j = await r.json();
    if (j.kit) {
      setKit({
        skills: [blankSkill("Skill 1"), blankSkill("Skill 2")],
        ...j.kit,
      });
      setStatus(`Loaded ${id}`);
    }
  }

  async function save() {
    const res = await fetch("/api/kit-lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveKit", kit: asCharacterData(kit) }),
    });
    const json = await res.json();
    if (res.ok) {
      setStatus(`Saved data/characters/${json.id}.json`);
      setIds((prev) => (prev.includes(json.id) ? prev : [...prev, json.id].sort()));
    } else {
      setStatus(`Save failed: ${(json.issues ?? [json.error]).join(" | ")}`);
    }
  }

  function testInBattle() {
    if (!validation.ok) {
      setStatus("Fix validation before testing in battle.");
      return;
    }
    registerDraftCharacter(asCharacterData(kit));
    startCustomBattle([{ id: kit.id }], [{ id: enemyId }]);
    router.push("/practice");
  }

  const previewData = asCharacterData(kit);

  return (
    <div className="mx-auto max-w-7xl p-4 text-zinc-100">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-bold text-amber-400">Kit Lab</h1>
        <select
          className={inputCls + " max-w-40"}
          defaultValue=""
          onChange={(e) => loadKit(e.target.value)}
        >
          <option value="">Load existing…</option>
          {ids.map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
        <button className={btnCls} onClick={() => setKit(blankKit())}>
          New
        </button>
        <button
          className={btnCls}
          disabled={!validation.ok}
          onClick={save}
        >
          Save
        </button>
        <div className="flex items-center gap-1">
          <button className={btnCls} disabled={!validation.ok} onClick={testInBattle}>
            Test in Battle vs
          </button>
          <select
            className={inputCls + " max-w-36"}
            value={enemyId}
            onChange={(e) => setEnemyId(e.target.value)}
          >
            {allChars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <span
          className={`ml-auto text-xs ${
            validation.ok ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          {validation.ok ? "valid kit" : `${validation.issues.length} issue(s)`}
        </span>
      </div>

      {status ? (
        <p className="mb-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
          {status}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-3">
          <div className={cardCls}>
            <div className="grid grid-cols-2 gap-2">
              <Labeled label="id">
                <input
                  className={inputCls}
                  value={kit.id}
                  onChange={(e) => update({ id: e.target.value })}
                />
              </Labeled>
              <Labeled label="name">
                <input
                  className={inputCls}
                  value={kit.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </Labeled>
              <Labeled label="color">
                <select
                  className={inputCls}
                  value={kit.color}
                  onChange={(e) =>
                    update({ color: e.target.value as DraftKit["color"] })
                  }
                >
                  {COLORS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="tags (comma)">
                <input
                  className={inputCls}
                  value={(kit.tags ?? []).join(", ")}
                  onChange={(e) =>
                    update({
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Labeled>
              <Labeled label="atk">
                <input
                  className={inputCls}
                  type="number"
                  value={kit.atk}
                  onChange={(e) => update({ atk: Number(e.target.value) })}
                />
              </Labeled>
              <Labeled label="def">
                <input
                  className={inputCls}
                  type="number"
                  value={kit.def}
                  onChange={(e) => update({ def: Number(e.target.value) })}
                />
              </Labeled>
              <Labeled label="hp">
                <input
                  className={inputCls}
                  type="number"
                  value={kit.hp}
                  onChange={(e) => update({ hp: Number(e.target.value) })}
                />
              </Labeled>
              <div className="flex items-end gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={kit.storyOnly ?? false}
                    onChange={(e) => update({ storyOnly: e.target.checked })}
                  />
                  storyOnly
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={kit.tier === "elite"}
                    onChange={(e) =>
                      update({ tier: e.target.checked ? "elite" : undefined })
                    }
                  />
                  elite
                </label>
              </div>
            </div>
            <div className="mt-2">
              <Labeled label="lore">
                <textarea
                  className={inputCls}
                  rows={2}
                  value={kit.lore ?? ""}
                  onChange={(e) => update({ lore: e.target.value })}
                />
              </Labeled>
            </div>
          </div>

          {kit.skills.map((s, i) => (
            <SkillEditor
              key={i}
              skill={s}
              onChange={(next) =>
                update({ skills: kit.skills.map((x, j) => (j === i ? next : x)) })
              }
            />
          ))}

          {/* Ultimate */}
          {kit.ultimate ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className={labelCls}>ultimate</span>
                <button
                  className="text-xs text-zinc-500 hover:text-red-400"
                  onClick={() => update({ ultimate: undefined })}
                >
                  remove ult
                </button>
              </div>
              <SkillEditor
                skill={kit.ultimate}
                isUlt
                onChange={(next) => update({ ultimate: next })}
              />
            </div>
          ) : (
            <button
              className={btnCls}
              onClick={() =>
                update({
                  ultimate: {
                    ...blankSkill("Ultimate"),
                    type: "ultimate",
                    damage: 400,
                    damageRanked: undefined,
                  },
                })
              }
            >
              + add ultimate
            </button>
          )}

          {/* Passive */}
          {kit.passive ? (
            <div className={cardCls}>
              <div className="mb-1 flex items-center justify-between">
                <span className={labelCls}>passive</span>
                <button
                  className="text-xs text-zinc-500 hover:text-red-400"
                  onClick={() => update({ passive: undefined })}
                >
                  remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Labeled label="name">
                  <input
                    className={inputCls}
                    value={kit.passive.name}
                    onChange={(e) =>
                      update({
                        passive: { ...kit.passive!, name: e.target.value },
                      })
                    }
                  />
                </Labeled>
                <Labeled label="trigger">
                  <select
                    className={inputCls}
                    value={kit.passive.trigger}
                    onChange={(e) =>
                      update({
                        passive: { ...kit.passive!, trigger: e.target.value },
                      })
                    }
                  >
                    {PASSIVE_TRIGGERS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Labeled>
              </div>
              <div className="mt-2">
                <Labeled label="description">
                  <input
                    className={inputCls}
                    value={kit.passive.description}
                    onChange={(e) =>
                      update({
                        passive: {
                          ...kit.passive!,
                          description: e.target.value,
                        },
                      })
                    }
                  />
                </Labeled>
              </div>
              <div className="mt-2">
                <span className={labelCls}>mechanics</span>
                <MechanicsList
                  mechanics={kit.passive.mechanics ?? []}
                  onChange={(m) =>
                    update({ passive: { ...kit.passive!, mechanics: m } })
                  }
                />
              </div>
            </div>
          ) : (
            <button
              className={btnCls}
              onClick={() =>
                update({
                  passive: {
                    name: "Passive",
                    description: "TODO",
                    trigger: "always",
                    mechanics: [],
                  },
                })
              }
            >
              + add passive
            </button>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {(["preview", "descriptions", "sim", "balance", "brief"] as const).map(
              (t) => (
                <button
                  key={t}
                  className={`rounded px-3 py-1 text-xs ${
                    tab === t
                      ? "bg-amber-500 text-zinc-950"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ),
            )}
          </div>

          <div className={cardCls + " min-h-64"}>
            {!validation.ok && tab !== "brief" ? (
              <div className="mb-3 rounded border border-amber-800 bg-amber-950/30 p-2 text-xs text-amber-300">
                {validation.issues.slice(0, 6).map((i, k) => (
                  <p key={k}>{i}</p>
                ))}
              </div>
            ) : null}

            {tab === "preview" ? (
              <KitDetails
                skills={previewData.skills}
                ultimate={previewData.ultimate}
                passive={previewData.passive as unknown as KitPassiveView | undefined}
              />
            ) : null}
            {tab === "descriptions" ? <DescriptionsView kit={kit} /> : null}
            {tab === "sim" ? <SimulatorView kit={kit} /> : null}
            {tab === "balance" ? <BalanceView kit={kit} /> : null}
            {tab === "brief" ? (
              <div>
                <p className="mb-2 text-xs text-zinc-400">
                  Capture a NEW mechanic as a brief for Claude to implement.
                  Saves to docs/proposed-mechanics/.
                </p>
                <BriefForm onSaved={setStatus} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
