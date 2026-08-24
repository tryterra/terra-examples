import {
  createFileRoute,
  Link,
  Outlet,
  useMatchRoute,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CaretLeftIcon, PlugIcon, WatchIcon } from "@phosphor-icons/react";
import { Badge } from "../../../components/shared/atoms/Badge";
import { Button } from "../../../components/shared/atoms/Button";
import { Skeleton } from "../../../components/shared/atoms/Skeleton";
import { Meta, MetaRow } from "../../../components/shared/Meta";
import { toastQueue } from "../../../components/shared/atoms/Toast";
import { api, unwrap } from "../../../lib/api";
import { healthQuery, patientQuery } from "../../../lib/queries";
import { ageFromDob, capitalize } from "../../../lib/format";

export const Route = createFileRoute("/patients/$patientId")({
  component: PatientLayout,
});

function PatientLayout() {
  const { patientId } = Route.useParams();
  const patientQ = useQuery(patientQuery(patientId));
  const healthQ = useQuery(healthQuery);
  const p = patientQ.data?.patient;
  // Contextual back link: sub-pages go back to the patient overview,
  // the overview itself goes back to the roster.
  const matchRoute = useMatchRoute();
  const onOverview = Boolean(matchRoute({ to: "/patients/$patientId" }));

  const connect = useMutation({
    mutationFn: async () =>
      unwrap<{ url: string }>(
        await api.api.patients[":id"]["widget-session"].$post({
          param: { id: patientId },
        }),
      ),
    onSuccess: ({ url }) => {
      // The Terra widget redirects back to this patient page when done.
      window.location.href = url;
    },
    onError: (err) => toastQueue.add({ title: err.message, variant: "error" }),
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        {onOverview ? (
          <Link
            to="/patients"
            className="flex items-center gap-1 text-sm text-subtle-text hover:text-main-black"
          >
            <CaretLeftIcon size={14} /> Patients
          </Link>
        ) : (
          <Link
            to="/patients/$patientId"
            params={{ patientId }}
            className="flex items-center gap-1 text-sm text-subtle-text hover:text-main-black"
          >
            <CaretLeftIcon size={14} />
            {p ? `${p.firstName} ${p.lastName}` : "Overview"}
          </Link>
        )}
        {patientQ.isLoading || !p ? (
          <Skeleton className="h-12 w-80" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl font-semibold text-main-black">
                {p.firstName} {p.lastName}
              </h1>
              <MetaRow>
                <Meta label="Age">{ageFromDob(p.dateOfBirth)}</Meta>
                <Meta label="Sex">{capitalize(p.sex)}</Meta>
                <Meta label="Reference ID" mono>
                  {p.referenceId}
                </Meta>
              </MetaRow>
            </div>
            <div className="flex items-center gap-3">
              {p.connections.length > 0 ? (
                <Badge variant="emphasis">
                  <WatchIcon size={14} weight="bold" />
                  {p.connections
                    .map((c) => capitalize(c.provider.toLowerCase()))
                    .join(", ")}
                </Badge>
              ) : (
                <Button
                  variant="secondary"
                  onPress={() => connect.mutate()}
                  isDisabled={connect.isPending || healthQ.data?.demo === true}
                >
                  <PlugIcon size={18} />
                  {healthQ.data?.demo
                    ? "Connect (needs credentials)"
                    : connect.isPending
                      ? "Opening…"
                      : "Connect wearable"}
                </Button>
              )}
            </div>
          </div>
        )}
      </header>
      <Outlet />
    </div>
  );
}
