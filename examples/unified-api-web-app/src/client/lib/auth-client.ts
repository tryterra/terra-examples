import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import type { getAuth } from "@/server/lib/auth";

type Auth = ReturnType<typeof getAuth>;

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [emailOTPClient(), inferAdditionalFields<Auth>()],
});

export const { signIn, signOut, useSession, emailOtp } = authClient;
