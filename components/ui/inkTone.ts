/**
 * What a number MEANS, drawn as a fill with ink on it (Shōnen Ink, ruling
 * #154).
 *
 * Under Combat Terminal a gain was green text and a loss red text, typed per
 * screen. On paper a hue does not read as text (docs/design-system.md), so
 * each meaning is a hue behind the number instead, defined once. The growth
 * tabs, the trial road and the clear summaries all say "you gained this" and
 * "you lost this", and now say it the same way.
 */
export const INK_TONE = {
  /** Gained, healed, survived, reached: green. */
  gain: "bg-role-heal/45 px-0.5",
  /** Lost, fallen, spent: red. */
  loss: "bg-destructive/30 px-0.5",
  /** A reward or an unlock: the reward gold. */
  reward: "bg-el-light/55 px-1",
} as const;
