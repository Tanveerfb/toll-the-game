/**
 * Sentry configuration, in one place.
 *
 * **Inert without a DSN**, matching how `lib/firebase.ts` treats its own env:
 * the game runs identically with no Sentry account, and nothing is sent
 * anywhere. That is not a placeholder — it is the correct default for a repo
 * that anyone can clone, and it is what makes it safe to wire this in before
 * anyone has signed up for anything.
 *
 * Set `NEXT_PUBLIC_SENTRY_DSN` in the Vercel project to turn it on.
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

/** Whether to initialise at all. */
export const sentryEnabled = SENTRY_DSN.length > 0;

/**
 * Shared init options.
 *
 * `tracesSampleRate` is 0: performance tracing is what burns a free-tier quota
 * fastest, and Vercel Speed Insights already reports Core Web Vitals from real
 * devices. What Sentry is here for is the thing nothing else catches — an
 * exception on a player's phone, which is otherwise completely invisible.
 */
export const sentryOptions = {
  dsn: SENTRY_DSN,
  tracesSampleRate: 0,
  // The free tier is 5k events/month. A single reproducible crash in a battle
  // loop could spend that in an afternoon, so identical events are collapsed
  // rather than each one being sent.
  sendDefaultPii: false,
  enabled: sentryEnabled,
};
