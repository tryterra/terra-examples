/**
 * Catalog: product types → products → variants, plus per-client curation.
 *
 * The catalog is three levels deep; the thing you order is a VARIANT
 * (variant_id + quantity). A variant advertises which collection methods it
 * supports in available_collection_types ("AT_HOME" / "GO_TO_LAB").
 */
import type { VantageClient } from "./client";
import type {
  Product,
  ProductType,
  ProductVariant,
  UpdateCatalogSelectionResponse,
} from "./schemas";

export function listProductTypes(
  client: VantageClient,
): Promise<ProductType[]> {
  return client.get("/products") as Promise<ProductType[]>;
}

export async function listProducts(
  client: VantageClient,
  productTypeId: number,
  opts: { showAll?: boolean } = {},
): Promise<Product[]> {
  const products = (await client.get(`/products/${productTypeId}`, {
    show_all: opts.showAll,
  })) as Product[];
  return products.map(normalizeProductCurrency);
}

export function listVariants(
  client: VantageClient,
  productId: number,
  opts: { showAll?: boolean } = {},
): Promise<ProductVariant[]> {
  return client.get(`/products/${productId}/variants`, {
    show_all: opts.showAll,
  }) as Promise<ProductVariant[]>;
}

/**
 * Curate which products your catalog serves. FULL-SET write: listed products
 * become enabled, every other product is disabled — and disabled products
 * cannot be ordered (403).
 */
export function setCatalogSelection(
  client: VantageClient,
  productIds: string[],
): Promise<UpdateCatalogSelectionResponse> {
  return client.put("/products/selection", {
    product_ids: productIds,
  }) as Promise<UpdateCatalogSelectionResponse>;
}

/**
 * Product-level `currency` currently serializes the internal enum INDEX
 * (0=unspecified, 1=USD, 2=EUR, 3=GBP) instead of the ISO-4217 numeric code
 * the variants use. Normalize so callers only ever see ISO numeric.
 * Fix tracked upstream in the Vantage API; delete this when it ships.
 */
const CURRENCY_INDEX_TO_ISO: Record<number, number> = {
  1: 840,
  2: 978,
  3: 826,
};
function normalizeProductCurrency(product: Product): Product {
  const c = product.currency as unknown as number;
  if (c !== undefined && c < 100 && CURRENCY_INDEX_TO_ISO[c]) {
    return {
      ...product,
      currency: CURRENCY_INDEX_TO_ISO[c] as Product["currency"],
    };
  }
  return product;
}

/** Format integer cents + ISO-4217 numeric currency for display. */
export function formatPrice(cents: number, isoNumericCurrency: number): string {
  const code =
    { 840: "USD", 978: "EUR", 826: "GBP" }[isoNumericCurrency] ?? "USD";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
  }).format(cents / 100);
}
