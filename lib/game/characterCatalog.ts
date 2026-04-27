import batra from "@/data/characters/batra.json";
import duke from "@/data/characters/duke.json";
import gabrist from "@/data/characters/gabrist.json";
import lyra from "@/data/characters/lyra.json";
import masterTao from "@/data/characters/master_tao.json";
import mustafa from "@/data/characters/mustafa.json";
import sara from "@/data/characters/sara.json";
import siddiq from "@/data/characters/siddiq.json";
import yalina from "@/data/characters/yalina.json";

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
  skills: CharacterSkillData[];
  ultimate?: CharacterSkillData;
  passive?: CharacterPassiveData;
  [key: string]: unknown;
}

const characters = [
  batra,
  duke,
  gabrist,
  lyra,
  masterTao,
  mustafa,
  sara,
  siddiq,
  yalina,
] as CharacterData[];

const characterMap = new Map<string, CharacterData>(
  characters.map((character) => [character.id, character]),
);

export const characterIds = characters.map((character) => character.id);

export function getAllCharacters(): CharacterData[] {
  return characters;
}

export function getCharacterById(id: string): CharacterData | undefined {
  return characterMap.get(id);
}
