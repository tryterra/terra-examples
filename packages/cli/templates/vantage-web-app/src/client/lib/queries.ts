/**
 * One queryOptions factory family per Vantage resource — both personas
 * consume these with different args; never duplicate a fetcher per persona.
 */
import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "./api";
import type { InferResponseType } from "hono/client";

export type OpsConfig = InferResponseType<typeof api.api.ops.config.$get>;
export type OpsOrders = InferResponseType<typeof api.api.ops.orders.$get, 200>;
export type OpsOrderDetail = InferResponseType<
  (typeof api.api.ops.orders)[":orderId"]["$get"],
  200
>;
export type Kits = InferResponseType<typeof api.api.shop.kits.$get, 200>;
export type KitDetail = InferResponseType<
  (typeof api.api.shop.kits)[":orderItemId"]["$get"],
  200
>;
export type KitResult = InferResponseType<
  (typeof api.api.shop.kits)[":orderItemId"]["result"]["$get"],
  200
>;
export type Inbox = InferResponseType<typeof api.api.ops.inbox.$get, 200>;
export type Deliveries = InferResponseType<
  typeof api.api.ops.deliveries.$get,
  200
>;
export type Overview = InferResponseType<typeof api.api.ops.overview.$get, 200>;
export type OpsCatalog = InferResponseType<
  typeof api.api.ops.catalog.$get,
  200
>;

export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: () => api.api.ops.config.$get().then((r) => unwrap<OpsConfig>(r)),
  staleTime: Infinity,
});

export const catalogTypesQuery = queryOptions({
  queryKey: ["catalog", "types"],
  queryFn: () =>
    api.api.shop.catalog.types
      .$get()
      .then((r) =>
        unwrap<Array<{ id: number; name: string; description: string }>>(r),
      ),
  staleTime: 60_000,
});

export const productsQuery = (typeId: number) =>
  queryOptions({
    queryKey: ["catalog", "products", typeId],
    queryFn: () =>
      api.api.shop.catalog.products
        .$get({ query: { typeId: String(typeId) } })
        .then((r) => unwrap<Array<Record<string, unknown>>>(r)),
    staleTime: 60_000,
  });

export const variantsQuery = (productId: number) =>
  queryOptions({
    queryKey: ["catalog", "variants", productId],
    queryFn: () =>
      api.api.shop.catalog.variants
        .$get({ query: { productId: String(productId) } })
        .then((r) => unwrap<Array<Record<string, unknown>>>(r)),
    staleTime: 60_000,
  });

export const labsQuery = (zip: string) =>
  queryOptions({
    queryKey: ["labs", zip],
    queryFn: () =>
      api.api.shop.labs
        .$get({ query: { zip } })
        .then((r) => unwrap<{ labs: Array<Record<string, unknown>> }>(r)),
    enabled: /^\d{5}(-\d{4})?$/.test(zip),
  });

export const patientsQuery = queryOptions({
  queryKey: ["patients"],
  queryFn: () =>
    api.api.shop.patients.$get().then((r) =>
      unwrap<
        Array<{
          id: string;
          firstName: string;
          lastName: string;
          email: string;
        }>
      >(r),
    ),
});

export const kitsQuery = (patientId: string) =>
  queryOptions({
    queryKey: ["kits", patientId],
    queryFn: () =>
      api.api.shop.kits
        .$get({ query: { patientId } })
        .then((r) => unwrap<Kits>(r)),
    refetchInterval: 10_000, // polling default — webhooks are the upgrade
  });

export const kitDetailQuery = (orderItemId: string) =>
  queryOptions({
    queryKey: ["kit", orderItemId],
    queryFn: () =>
      api.api.shop.kits[":orderItemId"]
        .$get({ param: { orderItemId } })
        .then((r) => unwrap<KitDetail>(r)),
    refetchInterval: 10_000,
  });

export const kitResultQuery = (orderItemId: string) =>
  queryOptions({
    queryKey: ["kit", orderItemId, "result"],
    queryFn: () =>
      api.api.shop.kits[":orderItemId"].result
        .$get({ param: { orderItemId } })
        .then((r) => unwrap<KitResult>(r)),
  });

export const opsOrdersQuery = (filters: {
  cursor?: string;
  status?: string;
  collectionType?: "AT_HOME" | "GO_TO_LAB";
  missing?: boolean;
}) =>
  queryOptions({
    queryKey: ["ops", "orders", filters],
    queryFn: () =>
      api.api.ops.orders
        .$get({
          query: {
            cursor: filters.cursor,
            status: filters.status,
            collectionType: filters.collectionType,
            missing: filters.missing ? "true" : undefined,
          },
        })
        .then((r) => unwrap<OpsOrders>(r)),
    placeholderData: (prev) => prev,
  });

export const opsOrderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["ops", "order", orderId],
    queryFn: () =>
      api.api.ops.orders[":orderId"]
        .$get({ param: { orderId } })
        .then((r) => unwrap<OpsOrderDetail>(r)),
    refetchInterval: 10_000,
  });

export const overviewQuery = queryOptions({
  queryKey: ["ops", "overview"],
  queryFn: () => api.api.ops.overview.$get().then((r) => unwrap<Overview>(r)),
  refetchInterval: 30_000,
});

export const inboxQuery = queryOptions({
  queryKey: ["ops", "inbox"],
  queryFn: () => api.api.ops.inbox.$get().then((r) => unwrap<Inbox>(r)),
  refetchInterval: 5_000,
});

export const deliveriesQuery = (outcome?: string) =>
  queryOptions({
    queryKey: ["ops", "deliveries", outcome],
    queryFn: () =>
      api.api.ops.deliveries
        .$get({ query: { outcome: outcome as never, cursor: undefined } })
        .then((r) => unwrap<Deliveries>(r)),
    refetchInterval: 15_000,
  });

export const webhookUrlQuery = queryOptions({
  queryKey: ["ops", "webhook-url"],
  queryFn: () =>
    api.api.ops["webhook-url"]
      .$get()
      .then((r) => unwrap<{ client_id?: string; webhook_url?: string }>(r)),
});

export const opsCatalogQuery = queryOptions({
  queryKey: ["ops", "catalog"],
  queryFn: () => api.api.ops.catalog.$get().then((r) => unwrap<OpsCatalog>(r)),
});

export type OpsResults = InferResponseType<
  typeof api.api.ops.results.$get,
  200
>;

export const opsResultsQuery = (status?: string) =>
  queryOptions({
    queryKey: ["ops", "results", status],
    queryFn: () =>
      api.api.ops.results
        .$get({ query: { status, cursor: undefined } })
        .then((r) => unwrap<OpsResults>(r)),
    refetchInterval: 15_000,
  });
