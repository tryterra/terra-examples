import { hc } from "hono/client";
import type { AppType } from "@/server/index";

export const api = hc<AppType>(window.location.origin, {
  init: {
    credentials: "include",
  },
});
