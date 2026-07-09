import type { Terra } from "terra-api";

/** Terra's webhook data categories. */
export type DataCategory = keyof Terra.IntegrationProvider.Types;

export interface ProviderPriorityConfig {
  default: readonly string[];
  overrides: Partial<Record<DataCategory, readonly string[]>>;
}

/**
 * Provider priority rankings — higher position = higher priority.
 * Per-category overrides list only providers relevant to that data type.
 * Providers not in any list fall to lowest priority.
 */
export const PROVIDER_PRIORITY: ProviderPriorityConfig = {
  default: [
    "OURA",
    "WHOOP",
    "GARMIN",
    "FITBIT",
    "APPLE",
    "POLAR",
    "COROS",
    "SUUNTO",
    "SAMSUNG",
    "HEALTH_CONNECT",
    "WITHINGS",
    "ULTRAHUMAN",
    "BIOSTRAP",
    "HUAWEI",
    "GOOGLEFIT",
    "GOOGLE",
    "ZEPP",
    "WAHOO",
    "SOMNOFY",
    "AKTIIA",
    "STRAVA",
    "PELOTON",
    "CONCEPT2",
    "ZWIFT",
    "TRAININGPEAKS",
    "MYFITNESSPAL",
    "CRONOMETER",
  ],

  overrides: {
    sleep: [
      "OURA",
      "WHOOP",
      "GARMIN",
      "FITBIT",
      "APPLE",
      "POLAR",
      "SOMNOFY",
      "ULTRAHUMAN",
      "SAMSUNG",
      "HEALTH_CONNECT",
      "BIOSTRAP",
      "HUAWEI",
      "COROS",
    ],

    activity: [
      "GARMIN",
      "SUUNTO",
      "POLAR",
      "COROS",
      "APPLE",
      "WAHOO",
      "STRAVA",
      "FITBIT",
      "SAMSUNG",
      "HEALTH_CONNECT",
      "WHOOP",
      "PELOTON",
      "CONCEPT2",
      "ZWIFT",
      "TRAININGPEAKS",
      "HUAWEI",
      "ZEPP",
      "OURA",
    ],

    daily: [
      "GARMIN",
      "WHOOP",
      "OURA",
      "FITBIT",
      "APPLE",
      "POLAR",
      "COROS",
      "ULTRAHUMAN",
      "SAMSUNG",
      "HEALTH_CONNECT",
      "BIOSTRAP",
      "HUAWEI",
      "ZEPP",
      "GOOGLEFIT",
      "GOOGLE",
    ],

    body: [
      "WITHINGS",
      "OMRON",
      "OMRONUS",
      "INBODY",
      "BODITRAX",
      "GARMIN",
      "FITBIT",
      "ULTRAHUMAN",
      "GOOGLE",
      "GOOGLEFIT",
      "APPLE",
      "SAMSUNG",
      "HEALTH_CONNECT",
    ],

    nutrition: [
      "MYFITNESSPAL",
      "CRONOMETER",
      "FATSECRET",
      "NUTRACHECK",
      "MACROSFIRST",
      "MYMACROS",
      "EATTHISMUCH",
      "WGER",
      "VIRTUAGYM",
    ],

    menstruation: [
      "FLO",
      "CLUE",
      "APPLE",
      "FITBIT",
      "OURA",
      "SAMSUNG",
      "HEALTH_CONNECT",
      "GARMIN",
    ],
  },
};

/* --- */

const FALLBACK_OFFSET = 1000;

export function getProviderRank(
  provider: string,
  category: DataCategory,
): number {
  const overrideList = PROVIDER_PRIORITY.overrides[category];
  if (overrideList) {
    const idx = overrideList.indexOf(provider);
    if (idx >= 0) return idx;
  }
  const defaultIdx = PROVIDER_PRIORITY.default.indexOf(provider);
  if (defaultIdx >= 0) return defaultIdx + FALLBACK_OFFSET;
  return Infinity;
}

export function sortByProviderPriority<T>(
  items: T[],
  getProvider: (item: T) => string,
  category: DataCategory,
): T[] {
  return [...items].sort(
    (a, b) =>
      getProviderRank(getProvider(a), category) -
      getProviderRank(getProvider(b), category),
  );
}

export function getHighestPriorityProvider(
  connectedProviders: string[],
  category: DataCategory,
): string | undefined {
  if (connectedProviders.length === 0) return undefined;
  return [...connectedProviders].sort(
    (a, b) => getProviderRank(a, category) - getProviderRank(b, category),
  )[0];
}
