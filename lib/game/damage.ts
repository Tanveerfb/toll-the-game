import { log } from "console";
import { Mechanic } from "../../types/mechanic";
import { Passive } from "../../types/passive";
function calculateDamage(
  characteratk: number,
  skilldamage: number,
  mechanics: Mechanic[],
  targetdefense: number,
  enemydamageReduction: number,
) {
  let rawskilldamage = characteratk * skilldamage;
}
