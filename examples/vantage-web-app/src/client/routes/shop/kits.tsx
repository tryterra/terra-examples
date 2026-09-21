import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router";
import { CaretRightIcon } from "@phosphor-icons/react";
import {
  GridList,
  GridListItem,
} from "@/client/components/shared/atoms/GridList";
import { Select, SelectItem } from "@/client/components/shared/atoms/Select";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import { EmptyState } from "@/client/components/shared/atoms/EmptyState";
import { patientStatusLabel } from "@/client/components/shared/StatusBadge";
import { kitDisplayName } from "@/client/components/pages/shop/kit-name";
import {
  catalogTypesQuery,
  kitsQuery,
  patientsQuery,
  type Kits,
} from "@/client/lib/queries";
import { formatRelativeTime } from "@/client/lib/format";

/** Success branch — the server error responder's widened status leaks the error
 *  envelope into InferResponseType<…,200>. */
type OkKits = Exclude<Kits, { error: string }>;

interface KitsSearch {
  patientId?: string;
}

export const Route = createFileRoute("/shop/kits")({
  validateSearch: (search: Record<string, unknown>): KitsSearch => ({
    patientId: search.patientId != null ? String(search.patientId) : undefined,
  }),
  component: KitsPage,
});

function KitsPage() {
  const { patientId } = Route.useSearch();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const { data: patients } = useQuery(patientsQuery);

  // Detail / result render as nested children through this route's Outlet.
  if (matchRoute({ to: "/shop/kits/$orderItemId", fuzzy: true }))
    return <Outlet />;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-main-black">Your kits</h1>
        <p className="text-base text-secondary-text">
          Track each kit from delivery through to results.
        </p>
      </div>

      <Select
        label="Patient"
        placeholder="Select a patient"
        selectedKey={patientId ?? null}
        onSelectionChange={(key) =>
          navigate({
            to: "/shop/kits",
            search: { patientId: key ? String(key) : undefined },
          })
        }
        items={patients ?? []}
      >
        {(p) => (
          <SelectItem id={p.id} textValue={`${p.firstName} ${p.lastName}`}>
            {p.firstName} {p.lastName}
          </SelectItem>
        )}
      </Select>

      {patientId ? (
        <KitList patientId={patientId} />
      ) : (
        <EmptyState>Select a patient to see their kits.</EmptyState>
      )}
    </>
  );
}

function KitList({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(kitsQuery(patientId));
  const { data: types } = useQuery(catalogTypesQuery);
  const kits = (data as OkKits | undefined)?.kits ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }
  if (kits.length === 0) {
    return <EmptyState>No kits yet for this patient.</EmptyState>;
  }

  return (
    <GridList
      aria-label="Your kits"
      onAction={(key) =>
        navigate({
          to: "/shop/kits/$orderItemId",
          params: { orderItemId: String(key) },
        })
      }
    >
      {kits.map((kit) => {
        const status = kit.item?.results_status || kit.order_status || "";
        return (
          <GridListItem
            key={kit.mapping.orderItemId}
            id={kit.mapping.orderItemId}
            textValue={kitDisplayName(kit.item?.product_type_id, types)}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-medium text-main-black">
                {kitDisplayName(kit.item?.product_type_id, types)}
              </span>
              <span className="text-sm text-subtle-text">
                {patientStatusLabel(status)} · ordered{" "}
                {formatRelativeTime(kit.mapping.createdAt)}
              </span>
            </div>
            <CaretRightIcon size={20} className="text-subtle-text" />
          </GridListItem>
        );
      })}
    </GridList>
  );
}
