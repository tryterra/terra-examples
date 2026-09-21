import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CaretRightIcon, PlusIcon, WatchIcon } from "@phosphor-icons/react";
import { Badge } from "../../components/shared/atoms/Badge";
import { Button } from "../../components/shared/atoms/Button";
import { Dialog, Heading } from "../../components/shared/atoms/Dialog";
import { Form } from "../../components/shared/atoms/Form";
import {
  GridList,
  GridListItem,
} from "../../components/shared/atoms/GridList";
import { Modal } from "../../components/shared/atoms/Modal";
import { SearchField } from "../../components/shared/atoms/SearchField";
import { Select, SelectItem } from "../../components/shared/atoms/Select";
import { Skeleton } from "../../components/shared/atoms/Skeleton";
import { TextField } from "../../components/shared/atoms/TextField";
import { toastQueue } from "../../components/shared/atoms/Toast";
import { Meta } from "../../components/shared/Meta";
import { api, unwrap } from "../../lib/api";
import {
  analysisQuery,
  patientsQuery,
  type AnalysisOk,
  type PatientRow,
} from "../../lib/queries";
import { ageFromDob, capitalize, formatDate } from "../../lib/format";

export const Route = createFileRoute("/patients/")({
  component: PatientsPage,
});

/** Flagged values + no draw for 6 months = monitoring gap worth surfacing. */
const RETEST_MONTHS = 6;
function isRetestOverdue(p: PatientRow): boolean {
  if (!p.lastReportDate) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETEST_MONTHS);
  return new Date(p.lastReportDate) < cutoff;
}

/** Engine-flagged lab count (deduped by label) — the triage signal. */
function flaggedCount(analysis: AnalysisOk | undefined): number | null {
  if (!analysis) return null;
  const labels = analysis.domains
    .flatMap((d) => d.contributions)
    .filter((c) => c.kind === "lab" && c.severity !== "normal")
    .map((c) => c.label);
  return new Set(labels).size;
}

function PatientsPage() {
  const navigate = useNavigate();
  const rosterQ = useQuery(patientsQuery);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const roster = rosterQ.data?.patients ?? [];

  // Per-patient analysis for triage — small rosters, and the server caches
  // everything underneath, so the fan-out is cheap.
  const analysisQs = useQueries({
    queries: roster.map((p) => ({
      ...analysisQuery(p.id),
      retry: false,
    })),
  });
  const flaggedById = new Map<string, number | null>(
    roster.map((p, i) => [p.id, flaggedCount(analysisQs[i]?.data)]),
  );

  const patients = roster
    .filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${p.firstName} ${p.lastName} ${p.referenceId}`
        .toLowerCase()
        .includes(q);
    })
    // Triage order: most flagged first, then most recent report.
    .sort(
      (a, b) =>
        (flaggedById.get(b.id) ?? 0) - (flaggedById.get(a.id) ?? 0) ||
        (b.lastReportDate ?? "").localeCompare(a.lastReportDate ?? ""),
    );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-main-black">Patients</h1>
        <Button
          variant="primary"
          className="shrink-0 whitespace-nowrap"
          onPress={() => setAddOpen(true)}
        >
          <PlusIcon size={18} weight="bold" /> Add patient
        </Button>
      </div>

      <SearchField
        aria-label="Search patients"
        placeholder="Search by name or reference ID…"
        value={search}
        onChange={setSearch}
        className="max-w-md"
      />

      {rosterQ.isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <p className="text-sm text-subtle-text">
          {search
            ? "No patients match your search."
            : "No patients yet - add one, or run the seed script."}
        </p>
      ) : (
        <GridList
          aria-label="Patients"
          onAction={(key) =>
            navigate({
              to: "/patients/$patientId",
              params: { patientId: String(key) },
            })
          }
        >
          {patients.map((p) => (
            <PatientRowItem
              key={p.id}
              patient={p}
              flagged={flaggedById.get(p.id) ?? null}
              retestOverdue={
                (flaggedById.get(p.id) ?? 0) > 0 && isRetestOverdue(p)
              }
            />
          ))}
        </GridList>
      )}

      <AddPatientModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function PatientRowItem({
  patient: p,
  flagged,
  retestOverdue,
}: {
  patient: PatientRow;
  flagged: number | null;
  retestOverdue: boolean;
}) {
  const providers = p.connections.map((c) => c.provider);
  return (
    <GridListItem id={p.id} textValue={`${p.firstName} ${p.lastName}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate font-medium text-main-black">
          {p.firstName} {p.lastName}
        </span>
        <div className="flex flex-wrap items-start gap-x-6">
          <Meta label="Age">{ageFromDob(p.dateOfBirth)}</Meta>
          <Meta label="Sex">{capitalize(p.sex)}</Meta>
          <Meta label="Reference ID" mono>
            {p.referenceId}
          </Meta>
        </div>
      </div>
      {/* Fixed-width trailing columns so rows align regardless of content */}
      <div className="w-36 shrink-0">
        <Meta label="Review">
          {flagged == null ? (
            "-"
          ) : flagged > 0 ? (
            <span className="flex flex-col items-start gap-1">
              <Badge variant="warning">{flagged} flagged</Badge>
              {retestOverdue && (
                <Badge variant="warning">Retest overdue</Badge>
              )}
            </span>
          ) : (
            <Badge variant="neutral">Clear</Badge>
          )}
        </Meta>
      </div>
      <div className="hidden w-32 shrink-0 sm:block">
        <Meta label="Last report">
          {p.lastReportDate ? formatDate(p.lastReportDate) : "None yet"}
        </Meta>
      </div>
      <div className="hidden w-44 shrink-0 md:block">
        <Meta label="Wearable">
          {providers.length > 0 ? (
            <Badge variant="emphasis">
              <WatchIcon size={14} weight="bold" />
              {providers.map(capitalize).join(", ")}
            </Badge>
          ) : (
            <Badge variant="neutral">Not connected</Badge>
          )}
        </Meta>
      </div>
      <CaretRightIcon size={20} className="shrink-0 text-subtle-text" />
    </GridListItem>
  );
}

function AddPatientModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [sex, setSex] = useState<"male" | "female">("female");
  const create = useMutation({
    mutationFn: async (form: FormData) =>
      unwrap(
        await api.api.patients.$post({
          json: {
            firstName: String(form.get("firstName") ?? ""),
            lastName: String(form.get("lastName") ?? ""),
            dateOfBirth: String(form.get("dateOfBirth") ?? ""),
            sex,
          },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      toastQueue.add({ title: "Patient added" });
      onClose();
    },
    onError: (err) => toastQueue.add({ title: err.message }),
  });

  return (
    <Modal isOpen={open} onOpenChange={(v) => !v && onClose()} isDismissable>
      <Dialog>
        <Heading slot="title">Add patient</Heading>
        <Form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(new FormData(e.currentTarget));
          }}
        >
          <TextField name="firstName" label="First name" isRequired autoFocus />
          <TextField name="lastName" label="Last name" isRequired />
          <TextField
            name="dateOfBirth"
            label="Date of birth"
            placeholder="YYYY-MM-DD"
            isRequired
            // Reference ranges are demographic — DOB and sex drive the
            // age/sex context Terra applies to lab results.
            pattern="\d{4}-\d{2}-\d{2}"
          />
          <Select
            label="Sex"
            selectedKey={sex}
            onSelectionChange={(k) => setSex(k as "male" | "female")}
          >
            <SelectItem id="female">Female</SelectItem>
            <SelectItem id="male">Male</SelectItem>
          </Select>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onPress={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isDisabled={create.isPending}
            >
              {create.isPending ? "Adding…" : "Add patient"}
            </Button>
          </div>
        </Form>
      </Dialog>
    </Modal>
  );
}
