import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, unwrap } from "../../lib/api";
import { opsCatalogQuery } from "../../lib/queries";
import type { CatalogOk } from "../../components/pages/ops/api-types";
import { Checkbox } from "../../components/shared/atoms/Checkbox";
import { Button } from "../../components/shared/atoms/Button";
import { Modal } from "../../components/shared/atoms/Modal";
import { Dialog, Heading } from "../../components/shared/atoms/Dialog";
import { Skeleton } from "../../components/shared/atoms/Skeleton";
import { EmptyState } from "../../components/shared/atoms/EmptyState";
import { toastQueue } from "../../components/shared/atoms/Toast";

export const Route = createFileRoute("/ops/catalog")({ component: Catalog });

type Product = CatalogOk["products"][number];

function Catalog() {
  const queryClient = useQueryClient();
  const { data: raw, isLoading } = useQuery(opsCatalogQuery);
  const data = raw as CatalogOk | undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const serverEnabled = useMemo(
    () =>
      new Set(
        (data?.products ?? [])
          .filter((p) => p.enabled)
          .map((p) => String(p.id)),
      ),
    [data],
  );
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const selected = draft ?? serverEnabled;
  const dirty =
    draft !== null &&
    (draft.size !== serverEnabled.size ||
      [...draft].some((id) => !serverEnabled.has(id)));

  const mutation = useMutation({
    mutationFn: () =>
      api.api.ops.catalog.selection
        .$put({ json: { productIds: [...selected] } })
        .then((r) => unwrap<unknown>(r)),
    onSuccess: () => {
      toastQueue.add(
        { title: "Catalog saved", variant: "default" },
        { timeout: 3000 },
      );
      setConfirmOpen(false);
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["ops", "catalog"] });
    },
    onError: (err: Error) =>
      toastQueue.add(
        {
          title: "Couldn't save catalog",
          description: err.message,
          variant: "error",
        },
        { timeout: 6000 },
      ),
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDraft(next);
  }

  const typeName = (id: number | undefined) =>
    data?.types.find((t) => t.id === id)?.name ?? "Other";
  const byType = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const p of data?.products ?? []) {
      const key = typeName(p.product_type_id);
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
    }
    return [...groups.entries()];
  }, [data]);

  return (
    <div className="flex max-w-3xl flex-col gap-6 pb-24">
      <h1 className="text-3xl font-semibold text-main-black">Catalog</h1>
      <p className="-mt-4 text-sm text-secondary-text">
        Products enabled here are orderable in your storefront.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (data?.products.length ?? 0) === 0 ? (
        <EmptyState>No products in this catalog.</EmptyState>
      ) : (
        byType.map(([type, products]) => (
          <section key={type} className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-main-black">
              {type}{" "}
              <span className="font-normal text-subtle-text">
                · {products.length}
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {products.map((p) => {
                const id = String(p.id);
                return (
                  <div
                    key={id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border bg-white p-4"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium text-main-black">
                        {p.name}
                      </span>
                      {/* No price here: variant pricing is the sellable
                          truth; curation is about availability, not price. */}
                      {p.variants && (
                        <span className="text-xs text-subtle-text">
                          {p.variants.length} variants
                        </span>
                      )}
                    </div>
                    <Checkbox
                      isSelected={selected.has(id)}
                      onChange={() => toggle(id)}
                      aria-label={`Enable ${p.name}`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <p className="text-sm text-secondary-text">
              Saving replaces your whole catalog — anything not enabled here is
              removed from your storefront.
            </p>
            <Button
              variant="primary"
              size="md"
              onPress={() => setConfirmOpen(true)}
            >
              Save selection
            </Button>
          </div>
        </div>
      )}

      <Modal isOpen={confirmOpen} onOpenChange={setConfirmOpen} isDismissable>
        <Dialog className="flex flex-col gap-4">
          <Heading slot="title">Replace catalog?</Heading>
          <p className="text-sm text-secondary-text">
            This enables {selected.size} product{selected.size === 1 ? "" : "s"}{" "}
            and removes every other product from your storefront. Disabled
            products cannot be ordered.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="md"
              onPress={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              isPending={mutation.isPending}
              onPress={() => mutation.mutate()}
            >
              Save selection
            </Button>
          </div>
        </Dialog>
      </Modal>
    </div>
  );
}
