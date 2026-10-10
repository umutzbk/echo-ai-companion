/**
 * App-wide flags.
 *
 * IS_TEST = true  → no subscription, no paywall, no usage limits. Everything unlocked.
 *                   (Use while building/testing the MVP.)
 * IS_TEST = false → real entitlement gating: free tier with a daily limit + paywall.
 */
export const IS_TEST = true;
