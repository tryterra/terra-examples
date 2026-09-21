import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DevicesIcon, DnaIcon, DropIcon } from "@phosphor-icons/react";
import { Badge } from "@/client/components/shared/atoms/Badge";
import { Button } from "@/client/components/shared/atoms/Button";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import { variantsQuery } from "@/client/lib/queries";
import { formatPrice } from "@/client/lib/format";

/** The catalog rows are typed loosely upstream (Record<string, unknown>); these
 *  are the fields the storefront actually renders. */
export interface CatalogProduct {
  id: number;
  name?: string;
  product_type_id?: number;
  base_price_cents?: number;
  currency?: number;
}

// Category glyphs keyed by product type (1 blood, 2 DNA, 3 connected device).
const TYPE_ICONS: Record<number, typeof DropIcon> = {
  1: DropIcon,
  2: DnaIcon,
  3: DevicesIcon,
};
export interface CatalogVariant {
  id: number;
  variant_name?: string;
  variant_defining_attrs?: Record<string, unknown>;
  price_cents?: number;
  currency?: number;
  available_collection_types?: string[];
  supported_ship_to_countries?: string[];
}

const COLLECTION_LABELS: Record<string, string> = {
  AT_HOME: "At home",
  GO_TO_LAB: "At a lab",
};

const countryName = (cc: string) =>
  new Intl.DisplayNames(["en"], { type: "region" }).of(cc) ?? cc;

/** One-line summary of a variant's defining attributes (panel + turnaround). */
function attrsSummary(attrs: Record<string, unknown> | undefined): string {
  if (!attrs) return "";
  const parts: string[] = [];
  if (typeof attrs.panel === "string") parts.push(`${attrs.panel} panel`);
  if (attrs.turnaround_days)
    parts.push(`${attrs.turnaround_days} day turnaround`);
  return parts.join(" · ");
}

function VariantCard({
  product,
  variant,
}: {
  product: CatalogProduct;
  variant: CatalogVariant;
}) {
  const navigate = useNavigate();
  const summary = attrsSummary(variant.variant_defining_attrs);
  const TypeIcon = TYPE_ICONS[product.product_type_id ?? 1] ?? DropIcon;
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-main-purple text-main-black">
          <TypeIcon size={18} weight="duotone" />
        </span>
        <span className="text-base font-semibold text-main-black">
          {variant.variant_name ?? "Kit"}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm text-secondary-text">{product.name}</p>
        {summary && <p className="text-sm text-subtle-text">{summary}</p>}
        <div className="flex flex-wrap gap-2">
          {(variant.available_collection_types ?? []).map((t) => (
            <Badge key={t} variant="neutral">
              {COLLECTION_LABELS[t] ?? t}
            </Badge>
          ))}
          {(variant.supported_ship_to_countries ?? []).map((cc) => (
            <Badge key={cc} variant="neutral">
              {countryName(cc)}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-main-black">
          {formatPrice(variant.price_cents, variant.currency)}
        </span>
        <Button
          variant="secondary"
          size="md"
          onPress={() =>
            navigate({
              to: "/shop/order",
              search: {
                variantId: String(variant.id),
                productId: String(product.id),
              },
            })
          }
        >
          Order kit
        </Button>
      </div>
    </div>
  );
}

/** Fetches one product's variants and emits a VariantCard per variant. Rendered
 *  as a fragment so cards land directly in the parent grid. */
export function ProductVariantCards({ product }: { product: CatalogProduct }) {
  const { data, isLoading } = useQuery(variantsQuery(product.id));
  const variants = (data as CatalogVariant[] | undefined) ?? [];

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </>
    );
  }
  return (
    <>
      {variants.map((v) => (
        <VariantCard key={v.id} product={product} variant={v} />
      ))}
    </>
  );
}
