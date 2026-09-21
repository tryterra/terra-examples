import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { highlight } from "sugar-high";
import { Badge } from "@/client/components/shared/atoms/Badge";
import { Button } from "@/client/components/shared/atoms/Button";
import { Checkbox } from "@/client/components/shared/atoms/Checkbox";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
} from "@/client/components/shared/atoms/Disclosure";
import { toastQueue } from "@/client/components/shared/atoms/Toast";
import { EscalationBanner } from "@/client/components/shared/EscalationBanner";
import { api, unwrap } from "@/client/lib/api";
import { kitResultQuery, type KitResult } from "@/client/lib/queries";
import { formatDateTime } from "@/client/lib/format";

export const Route = createFileRoute("/shop/kits/$orderItemId/result")({
  component: KitResultPage,
});

/** Success branch — the server error responder's widened status leaks the error
 *  envelope into InferResponseType<…,200>. */
type OkKitResult = Exclude<KitResult, { error: string }>;
type Observation = OkKitResult["parsed"]["observations"][number];

const RANGE_BADGE: Record<
  Observation["rangeStatus"],
  { variant: "emphasis" | "warning" | "neutral"; label: string }
> = {
  in_range: { variant: "emphasis", label: "In range" },
  below_range: { variant: "warning", label: "Below range" },
  above_range: { variant: "warning", label: "Above range" },
  unknown: { variant: "neutral", label: "—" },
};

function KitResultPage() {
  const { orderItemId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(kitResultQuery(orderItemId));
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const acknowledge = useMutation({
    mutationFn: () =>
      api.api.shop.kits[":orderItemId"].acknowledge
        .$post({
          param: { orderItemId },
          json: {
            testTakerId: (data as OkKitResult).testTakerId,
            confirmed: true,
          },
        })
        .then((r) => unwrap<{ status?: string }>(r)),
    onSuccess: () => {
      setAcknowledged(true);
      toastQueue.add(
        { title: "Results acknowledged", variant: "default" },
        { timeout: 3000 },
      );
      queryClient.invalidateQueries({ queryKey: ["kit", orderItemId] });
    },
    onError: (e) =>
      toastQueue.add(
        {
          title: "Couldn't acknowledge",
          description: e.message,
          variant: "error",
        },
        { timeout: 6000 },
      ),
  });

  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { parsed, escalation } = data as OkKitResult;

  return (
    <>
      <h1 className="text-3xl font-semibold text-main-black">Your results</h1>

      {escalation && (
        <EscalationBanner
          level={escalation.level ?? ""}
          dueBy={escalation.dueBy ?? undefined}
          showRawLevel={false}
        />
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        <span className="text-lg font-semibold text-main-black">
          {parsed.patientName}
        </span>
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-secondary-text">
          <span>{parsed.panelName}</span>
          <span>Collected {formatDateTime(parsed.collected)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-white p-5">
        <h2 className="mb-2 text-lg font-semibold text-main-black">
          Observations
        </h2>
        <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-3 border-b border-border pb-2 text-xs font-medium text-subtle-text">
          <span>Marker</span>
          <span>Result</span>
          <span>Reference range</span>
          <span />
        </div>
        {parsed.observations.map((o, i) => {
          const badge = RANGE_BADGE[o.rangeStatus];
          return (
            <div
              key={`${o.code}-${i}`}
              className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-3 border-b border-border py-3 text-sm last:border-b-0"
            >
              <span className="font-medium text-main-black">{o.display}</span>
              <span className="text-main-black">
                {o.value ?? "—"}
                {o.value !== undefined && o.unit ? ` ${o.unit}` : ""}
              </span>
              {/* Numeric bounds, not referenceText — some suppliers put the
                  matched band's NAME there ("Low"), which contradicts the
                  derived badge on out-of-range values. */}
              <span className="text-secondary-text">
                {o.low !== undefined || o.high !== undefined
                  ? `${o.low ?? 0} – ${o.high ?? "∞"}`
                  : "—"}
              </span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5">
        {/* Demo flow: in production, acknowledge must be bound to an authenticated end user. */}
        <Checkbox
          isSelected={confirmed}
          onChange={setConfirmed}
          isDisabled={acknowledged}
        >
          I confirm I have received and reviewed these results, including any
          values outside their expected range. This is not medical advice.
        </Checkbox>
        <Button
          isDisabled={!confirmed || acknowledged}
          isPending={acknowledge.isPending}
          onPress={() => acknowledge.mutate()}
        >
          {acknowledged ? "Acknowledged" : "Acknowledge results"}
        </Button>
      </div>

      <Disclosure>
        <DisclosureHeader>Raw result data</DisclosureHeader>
        <DisclosurePanel>
          <pre className="overflow-x-auto rounded-lg bg-bg-grey p-4 text-xs">
            <code
              dangerouslySetInnerHTML={{
                __html: highlight(JSON.stringify(parsed, null, 2)),
              }}
            />
          </pre>
        </DisclosurePanel>
      </Disclosure>
    </>
  );
}
