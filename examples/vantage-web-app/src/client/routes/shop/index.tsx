import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ToggleButton } from "@/client/components/shared/atoms/ToggleButton";
import { ToggleButtonGroup } from "@/client/components/shared/atoms/ToggleButtonGroup";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import { EmptyState } from "@/client/components/shared/atoms/EmptyState";
import {
  CatalogProduct,
  ProductVariantCards,
} from "@/client/components/pages/shop/catalog";
import { catalogTypesQuery, productsQuery } from "@/client/lib/queries";

export const Route = createFileRoute("/shop/")({ component: ShopCatalog });

function ShopCatalog() {
  const { data: types, isLoading: typesLoading } = useQuery(catalogTypesQuery);
  const [typeId, setTypeId] = useState<number | null>(null);
  const selectedType = typeId ?? types?.[0]?.id ?? null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-main-black">Shop tests</h1>
        <p className="text-base text-secondary-text">
          Order an at-home or lab test kit and track it through to results.
        </p>
      </div>

      {typesLoading ? (
        <Skeleton className="h-10 w-64 rounded-lg" />
      ) : (
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={selectedType != null ? [String(selectedType)] : []}
          onSelectionChange={(keys) => {
            const first = [...keys][0];
            if (first != null) setTypeId(Number(first));
          }}
          className="self-start"
        >
          {(types ?? []).map((t) => (
            <ToggleButton key={t.id} id={String(t.id)}>
              {t.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      {selectedType != null && <ProductGrid typeId={selectedType} />}
    </>
  );
}

function ProductGrid({ typeId }: { typeId: number }) {
  const { data, isLoading } = useQuery(productsQuery(typeId));
  const products = (data as CatalogProduct[] | undefined) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    );
  }
  if (products.length === 0) {
    return <EmptyState>No kits available in this category yet.</EmptyState>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {products.map((p) => (
        <ProductVariantCards key={p.id} product={p} />
      ))}
    </div>
  );
}
