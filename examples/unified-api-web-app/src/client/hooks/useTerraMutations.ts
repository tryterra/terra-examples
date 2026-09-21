import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";

/* -------------------------------------------------------------------------- */
/*                                  Mutations                                 */
/* -------------------------------------------------------------------------- */

export function useTerraAuthenticate(redirectPath: string) {
  return useMutation({
    mutationFn: async (resource: string) => {
      const origin = window.location.origin;
      const res = await api.api.terra.auth.$post({
        json: {
          resource,
          authSuccessRedirectUrl: `${origin}${redirectPath}?auth=success`,
          authFailureRedirectUrl: `${origin}${redirectPath}?auth=failure`,
        },
      });
      if (!res.ok) throw new Error("Failed to start auth");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.auth_url) {
        window.open(data.auth_url, "_blank");
      }
    },
  });
}

export function useTerraSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.api.terra.connections.sync.$post();
      if (!res.ok) throw new Error("Failed to sync connections");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terra", "connections"] });
    },
  });
}

export function useTerraReconnect(redirectPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      connectionId,
      resource,
    }: {
      connectionId: string;
      resource: string;
    }) => {
      const deleteRes = await api.api.terra.connections[":id"].$delete({
        param: { id: connectionId },
      });
      if (!deleteRes.ok) throw new Error("Failed to remove old connection");

      const origin = window.location.origin;
      const authRes = await api.api.terra.auth.$post({
        json: {
          resource,
          authSuccessRedirectUrl: `${origin}${redirectPath}?auth=success`,
          authFailureRedirectUrl: `${origin}${redirectPath}?auth=failure`,
        },
      });
      if (!authRes.ok) throw new Error("Failed to start auth");
      return authRes.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["terra", "connections"] });
      if (data.auth_url) {
        window.open(data.auth_url, "_blank");
      }
    },
  });
}

export function useTerraDeauthenticate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await api.api.terra.connections[":id"].$delete({
        param: { id: connectionId },
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terra", "connections"] });
    },
  });
}
