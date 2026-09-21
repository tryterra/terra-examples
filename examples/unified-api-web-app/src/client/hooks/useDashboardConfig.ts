import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/client/lib/api";

export const dashboardConfigQueryOpts = queryOptions({
  queryKey: ["dashboard-config"],
  queryFn: async () => {
    const res = await api.api.users["dashboard-config"].$get();
    if (!res.ok) throw new Error("Failed to load dashboard config");
    return res.json();
  },
});

export function useDashboardConfig() {
  return useQuery(dashboardConfigQueryOpts);
}

export function useUpdateDashboardConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { biomarkers: string[]; scores: string[] }) => {
      const res = await api.api.users["dashboard-config"].$put({
        json: data,
      });
      if (!res.ok) throw new Error("Failed to update dashboard config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-config"] });
    },
  });
}
