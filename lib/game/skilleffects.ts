export function applyMechanic(
  type: string,
  damage: number,
  value: number = 0,
  stacks: number = 0,
  targethasBuff: boolean = false,
  targethasDebuff: boolean = false,
  buffDuration: number = 0,
  debuffDuration: number = 0,
  targetdefense: number = 0,
  targetdamageReduction: number = 0,
): number {
  switch (type) {
    case "ignite":
      return damage * (0.1 * stacks);
    case "detonate":
      return damage * (0.2 * stacks);
    case "weakpoint":
      return targethasDebuff ? damage * 3 : damage;
    case "rupture":
      return targethasBuff ? damage * 2 : damage;
    case "pierce":
      return damage * (1 + value / 100);
    default:
      console.warn(`Mechanic "${type}" not found.`);
      return 0;
  }
}
