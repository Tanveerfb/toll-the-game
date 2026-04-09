import { log } from "console";
import { Mechanic } from "../../types/mechanic";
import { Passive } from "../../types/passive";
import "./skilleffects";
import { applyMechanic } from "./skilleffects";

function calculateDamage(
  characteratk: number,
  skilldamage: number,
  mechanics: Mechanic[],
  targetdefense: number,
  enemydamageReduction: number,
) {
  let damage = characteratk * skilldamage;

  mechanics.forEach((mechanic) => {
    damage += applyMechanic(
      mechanic.type,
      damage,
      mechanic.value,
      mechanic.stacks,
      mechanic.targethasBuff,
      mechanic.targethasDebuff,
      mechanic.buffDuration,
      mechanic.debuffDuration,
      mechanic.targetdefense,
      mechanic.targetdamageReduction,
    );
  });
  return damage;
}
