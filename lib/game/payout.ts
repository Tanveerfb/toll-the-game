/**
 * A bundle of loot handed to the player in one go — the general shape any
 * reward source pays out through `playerStore.grantPayout`.
 *
 * Materials are an open map rather than fixed keys, so a source can pay any
 * material without the store learning a new field. The world boss has its own
 * fixed-key shape (`WorldBossRewards`) because its drop table is authored that
 * way; this is everything else. Bureau Orders are the one caller today.
 *
 * This was `StoryPayout` until story mode was removed on 2026-09-26. Orders
 * had been paying out through the story reward action since they were built.
 */
export interface Payout {
  gems: number;
  coin: number;
  permanentTicket: number;
  materials: Record<string, number>;
  accountXp: number;
}
