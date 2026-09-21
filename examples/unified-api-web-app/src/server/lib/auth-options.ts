import type { BetterAuthOptions } from "better-auth";

export const authOptions = {
  appName: "Terra Demo",
  basePath: "/api/auth",
  user: {
    additionalFields: {
      onboardingStep: {
        type: ["profile", "connect", "completed"] as const,
        required: true,
        defaultValue: "profile",
        input: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
} satisfies Partial<BetterAuthOptions>;
