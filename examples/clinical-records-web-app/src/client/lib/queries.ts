/**
 * TanStack Query definitions over the typed Hono RPC client. Response types
 * are inferred from the server route chain - no hand-written DTOs.
 */
import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "./api";

export type HealthOk = InferResponseType<typeof api.api.health.$get, 200>;

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: async () => unwrap<HealthOk>(await api.api.health.$get()),
  staleTime: Infinity,
});

export type UsersOk = InferResponseType<typeof api.api.users.$get, 200>;
export type UserRow = UsersOk["users"][number];

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: async () => unwrap<UsersOk>(await api.api.users.$get()),
});

export type UserRecordsOk = InferResponseType<
  (typeof api.api.users)[":userId"]["$get"],
  200
>;
export type RecordItem = UserRecordsOk["records"][number];

export const userRecordsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["users", userId],
    queryFn: async () =>
      unwrap<UserRecordsOk>(
        await api.api.users[":userId"].$get({ param: { userId } }),
      ),
    // Webhooks land server side; poll gently so new records appear.
    refetchInterval: 30_000,
  });
