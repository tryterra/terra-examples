/**
 * Webhook destination config. Sandbox and production each hold their OWN
 * webhook URL — register per environment. The URL must be HTTPS; PATCHing an
 * empty string clears it (and stops delivery).
 */
import type { VantageClient } from "./client";
import type { ClientResponse } from "./schemas";

export function getWebhookUrl(client: VantageClient): Promise<ClientResponse> {
  return client.get("/clients/webhook-url") as Promise<ClientResponse>;
}

export function setWebhookUrl(
  client: VantageClient,
  webhookUrl: string,
): Promise<ClientResponse> {
  return client.patch("/clients/webhook-url", {
    webhook_url: webhookUrl,
  }) as Promise<ClientResponse>;
}
