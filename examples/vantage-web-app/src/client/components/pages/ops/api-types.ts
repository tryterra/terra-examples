/**
 * The shared query aliases in lib/queries resolve to `Success | ErrorBody`
 * unions (the server's error responder returns a computed status code, so
 * Hono can't isolate the 200 arm). `unwrap` throws on non-ok, so at runtime
 * the data is always the success shape — Ok<T> narrows the type to match.
 */
import type {
  Deliveries,
  OpsCatalog,
  OpsOrderDetail,
  OpsOrders,
  OpsResults,
  Overview,
} from "../../../lib/queries";

export type Ok<T> = Exclude<T, { error: string }>;

export type OverviewOk = Ok<Overview>;
export type OrdersOk = Ok<OpsOrders>;
export type OrderDetailOk = Ok<OpsOrderDetail>;
export type DeliveriesOk = Ok<Deliveries>;
export type CatalogOk = Ok<OpsCatalog>;
export type ResultsOk = Ok<OpsResults>;
