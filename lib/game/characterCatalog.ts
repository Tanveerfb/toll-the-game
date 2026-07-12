import ban from "@/data/characters/ban.json";
import batra from "@/data/characters/batra.json";
import diane from "@/data/characters/diane.json";
import duke from "@/data/characters/duke.json";
import gabrist from "@/data/characters/gabrist.json";
import gon from "@/data/characters/gon.json";
import killua from "@/data/characters/killua.json";
import leorio from "@/data/characters/leorio.json";
import lyra from "@/data/characters/lyra.json";
import masterTao from "@/data/characters/master_tao.json";
import meliodas from "@/data/characters/meliodas.json";
import mustafa from "@/data/characters/mustafa.json";
import raider from "@/data/characters/raider.json";
import roadBandit from "@/data/characters/road_bandit.json";
import sara from "@/data/characters/sara.json";
import seras from "@/data/characters/seras.json";
import siddiq from "@/data/characters/siddiq.json";
import wildBeast from "@/data/characters/wild_beast.json";
import yalina from "@/data/characters/yalina.json";
import { validateCharacters } from "@/lib/game/characterSchema";

export type CharacterColor = "light" | "red" | "blue" | "green" | "dark";

export interface CharacterSkillData {
  skillName: string;
  characterId: string;
  type: string;
  statMultiplier: string;
  description?: string;
  damageRanked?: number[];
  damage?: number;
  mechanics?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CharacterPassiveData {
  name: string;
  description: string;
  trigger: string;
  mechanics?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CharacterData {
  id: string;
  name: string;
  color: CharacterColor;
  atk: number;
  def: number;
  hp: number;
  tags?: string[];
  lore?: string;
  /** Story-mode enemies: excluded from the practice roster and archive */
  storyOnly?: boolean;
  skills: CharacterSkillData[];
  ultimate?: CharacterSkillData;
  passive?: CharacterPassiveData;
  [key: string]: unknown;
}

const rawCharacters = [
  ban,
  batra,
  diane,
  duke,
  gabrist,
  gon,
  killua,
  leorio,
  lyra,
  masterTao,
  meliodas,
  mustafa,
  raider,
  roadBandit,
  sara,
  seras,
  siddiq,
  wildBeast,
  yalina,
];

// Fail loudly at load time on malformed kit JSON (typo'd fields, wrong
// color, missing rank arrays) instead of crashing mid-battle.
validateCharacters(rawCharacters);

const characters = rawCharacters as CharacterData[];

const characterMap = new Map<string, CharacterData>(
  characters.map((character) => [character.id, character]),
);

export const characterIds = characters.map((character) => character.id);

export function getAllCharacters(): CharacterData[] {
  return characters;
}

/** Roster shown in team select and the archive — story-only enemies hidden */
export function getPlayableCharacters(): CharacterData[] {
  return characters.filter((character) => character.storyOnly !== true);
}

export function getCharacterById(id: string): CharacterData | undefined {
  return characterMap.get(id);
}
