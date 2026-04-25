import { Character } from "@/types/character";

export const CHARACTER_IDS = [
  "batra",
  "duke",
  "gabrist",
  "lyra",
  "master_tao",
  "mustafa",
  "sara",
  "siddiq",
  "yalina"
];

export function getCharacterData(id: string): Character & { id: string } {
  const data = require(`@/data/characters/${id}.json`);
  return { ...data, id };
}

export function getAllCharacters(): (Character & { id: string })[] {
  return CHARACTER_IDS.map(getCharacterData);
}
