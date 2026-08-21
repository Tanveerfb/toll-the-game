import * as Sentry from "@sentry/nextjs";

import { sentryEnabled, sentryOptions } from "@/lib/sentry";

/**
 * Browser-side error reporting.
 *
 * This is the half that matters: the game is a phone game, and a crash on
 * someone's phone is otherwise entirely invisible — no console to read, no
 * report, just a player who stops playing.
 *
 * Does nothing without `NEXT_PUBLIC_SENTRY_DSN`. See `lib/sentry.ts`.
 */
if (sentryEnabled) {
  Sentry.init(sentryOptions);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
