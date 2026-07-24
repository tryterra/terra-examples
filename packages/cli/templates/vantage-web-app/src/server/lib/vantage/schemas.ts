/**
 * Named aliases over the generated OpenAPI types (types.gen.ts, produced from
 * the published Vantage spec by `npm run gen:types`). Import types from here,
 * not from the generated file, so call sites stay readable.
 */
import type { components } from "./types.gen";

type S = components["schemas"];

export type ProductType = S["ProductType"];
export type Product = S["Product"];
export type ProductVariant = S["ProductVariant"];
export type CreateOrderRequest = S["CreateOrderRequest"];
export type CreateOrderResponse = S["CreateOrderResponse"];
export type GetOrderResponse = S["GetOrderResponse"];
export type ListOrdersResponse = S["ListOrdersResponse"];
export type OrderSummary = S["OrderSummary"];
export type ListResultsResponse = S["ListResultsResponse"];
export type ResultSummary = S["ResultSummary"];
export type GetResultsURLResponse = S["GetResultsURLResponse"];
export type AcknowledgeResultsResponse = S["AcknowledgeResultsResponse"];
export type ListLabsResponse = S["ListLabsResponse"];
export type PSCLocation = S["PSCLocation"];
export type OverviewResponse = S["OverviewResponse"];
export type WebhookDeliveriesResponse = S["WebhookDeliveriesResponse"];
export type ClientResponse = S["ClientResponse"];
export type SimulateOrderRequest = S["SimulateOrderRequest"];
export type SimulateOrderResponse = S["SimulateOrderResponse"];
export type UpdateCatalogSelectionResponse =
  S["UpdateCatalogSelectionResponse"];
export type ActivationContextDTO = S["ActivationContextDTO"];
export type ActivateKitResponse = S["ActivateKitResponse"];
export type OrderStatusChangedEvent = S["OrderStatusChangedEvent"];
export type OrderItemResultsStatusChangedEvent =
  S["OrderItemResultsStatusChangedEvent"];

/** Union of the two webhook payloads Vantage delivers. */
export type VantageWebhookEvent =
  OrderStatusChangedEvent | OrderItemResultsStatusChangedEvent;

/** All 14 simulate lifecycle events, straight from the spec enum. */
export type SimulateEvent = NonNullable<SimulateOrderRequest["event"]>;
