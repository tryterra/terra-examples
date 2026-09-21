import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import type { MetricKey } from "@/client/lib/metrics/config";

/* -------------------------------------------------------------------------- */
/*                                Query Options                               */
/* -------------------------------------------------------------------------- */

export const terraIntegrationsQueryOpts = queryOptions({
  queryKey: ["terra", "integrations"],
  queryFn: async () => {
    const res = await api.api.terra.integrations.$get();
    if (!res.ok) throw new Error("Failed to load integrations");
    return res.json();
  },
  staleTime: 10 * 60 * 1000,
});

const terraConnectionsQueryOpts = queryOptions({
  queryKey: ["terra", "connections"],
  queryFn: async () => {
    const res = await api.api.terra.connections.$get();
    if (!res.ok) throw new Error("Failed to load connections");
    return res.json();
  },
});

export function terraConnectionQueryOpts(connectionId: string, offset = 0) {
  return queryOptions({
    queryKey: ["terra", "connections", connectionId, { offset }],
    queryFn: async () => {
      const res = await api.api.terra.connections[":id"].$get({
        param: { id: connectionId },
        query: { offset: String(offset) },
      });
      if (!res.ok) throw new Error("Failed to load connection");
      return res.json();
    },
  });
}

function terraDashboardQueryOpts(scoreConnectionId?: string, date?: string) {
  return queryOptions({
    queryKey: ["terra", "dashboard", { scoreConnectionId, date }],
    queryFn: async () => {
      const res = await api.api.terra.dashboard.$get({
        query: { scoreConnectionId, date },
      });
      if (!res.ok) throw new Error("Failed to load health data");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export const terraTrendsAvailableQueryOpts = queryOptions({
  queryKey: ["terra", "trends", "available"],
  queryFn: async () => {
    const res = await api.api.terra.trends.available.$get();
    if (!res.ok) throw new Error("Failed to load available metrics");
    return res.json();
  },
  staleTime: 10 * 60 * 1000,
});

export function terraTrendsQueryOpts(params: {
  metric: MetricKey;
  startDate: string;
  endDate: string;
  scale: "day" | "week" | "month";
}) {
  return queryOptions({
    queryKey: ["terra", "trends", params],
    queryFn: async () => {
      const res = await api.api.terra.trends.$get({ query: params });
      if (!res.ok) throw new Error("Failed to load trend data");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

const ACTIVITIES_PAGE_SIZE = 5;

/* -------------------------------------------------------------------------- */
/*                                    Hooks                                   */
/* -------------------------------------------------------------------------- */

export function useTerraIntegrations(options?: { enabled?: boolean }) {
  return useQuery({
    ...terraIntegrationsQueryOpts,
    ...options,
  });
}

export function useTerraConnections() {
  return useQuery(terraConnectionsQueryOpts);
}

export function useTerraConnection(connectionId: string, offset = 0) {
  return useQuery({
    ...terraConnectionQueryOpts(connectionId, offset),
    placeholderData: (prev) => prev,
  });
}

export function useTerraDashboard(scoreConnectionId?: string, date?: string) {
  return useQuery({
    ...terraDashboardQueryOpts(scoreConnectionId, date),
    placeholderData: (prev) => prev,
  });
}

export function useDashboardActivities() {
  return useInfiniteQuery({
    queryKey: ["terra", "dashboard", "activities"],
    queryFn: async ({ pageParam }) => {
      const res = await api.api.terra.dashboard.activities.$get({
        query: { offset: String(pageParam) },
      });
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.activities.length >= ACTIVITIES_PAGE_SIZE
        ? lastPageParam + ACTIVITIES_PAGE_SIZE
        : undefined,
  });
}

export function useTerraTrendsAvailable() {
  return useQuery(terraTrendsAvailableQueryOpts);
}

export function useTerraTrends(params: {
  metric: MetricKey;
  startDate: string;
  endDate: string;
  scale: "day" | "week" | "month";
}) {
  return useQuery({
    ...terraTrendsQueryOpts(params),
    placeholderData: (prev) => prev,
  });
}
