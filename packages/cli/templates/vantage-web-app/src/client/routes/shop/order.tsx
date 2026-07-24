import { useMutation, useQuery } from "@tanstack/react-query";
import { PlusIcon, WarningIcon } from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Badge } from "@/client/components/shared/atoms/Badge";
import { Button } from "@/client/components/shared/atoms/Button";
import {
  GridList,
  GridListItem,
} from "@/client/components/shared/atoms/GridList";
import { SearchField } from "@/client/components/shared/atoms/SearchField";
import { Select, SelectItem } from "@/client/components/shared/atoms/Select";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import { TextField } from "@/client/components/shared/atoms/TextField";
import { toastQueue } from "@/client/components/shared/atoms/Toast";
import { type CatalogVariant } from "@/client/components/pages/shop/catalog";
import { api, unwrap, type ApiErrorBody } from "@/client/lib/api";
import { labsQuery, patientsQuery, variantsQuery } from "@/client/lib/queries";
import { formatPrice } from "@/client/lib/format";

interface OrderSearch {
  variantId?: string;
  productId?: string;
}

export const Route = createFileRoute("/shop/order")({
  // TanStack Router parses numeric-looking params into numbers — coerce back
  // to strings (Vantage IDs are strings; see AGENTS.md).
  validateSearch: (search: Record<string, unknown>): OrderSearch => ({
    variantId: search.variantId != null ? String(search.variantId) : undefined,
    productId: search.productId != null ? String(search.productId) : undefined,
  }),
  component: OrderPage,
});

type CollectionType = "AT_HOME" | "GO_TO_LAB";

interface AddressSuggestion {
  label: string;
  address_line_1: string;
  city: string;
  administrative_area: string;
  postal_code: string;
  country_code: string;
}

/** "US" → "United States"; falls back to the code for anything unmapped. */
const countryName = (cc: string) =>
  new Intl.DisplayNames(["en"], { type: "region" }).of(cc) ?? cc;

// Stripe-style: call the fields what locals call them.
const POSTAL_BY_COUNTRY: Record<string, { label: string; example: string }> = {
  US: { label: "ZIP code", example: "90210" },
  PH: { label: "ZIP code", example: "1000" },
  GB: { label: "Postcode", example: "SW1A 2AA" },
  AU: { label: "Postcode", example: "2000" },
  NZ: { label: "Postcode", example: "6011" },
  NL: { label: "Postcode", example: "1012 AB" },
  IE: { label: "Eircode", example: "D02 X285" },
  IN: { label: "PIN code", example: "110001" },
  BR: { label: "CEP", example: "01310-100" },
};
const postalField = (cc: string) =>
  POSTAL_BY_COUNTRY[cc.toUpperCase()] ?? { label: "Postal code", example: "" };

const REGION_LABEL_BY_COUNTRY: Record<string, string> = {
  US: "State",
  CA: "Province",
  AU: "State / territory",
  GB: "County",
  IE: "County",
  JP: "Prefecture",
};
const regionLabel = (cc: string) =>
  REGION_LABEL_BY_COUNTRY[cc.toUpperCase()] ?? "State / region";

interface Lab {
  code: string;
  name: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    administrative_area?: string;
    country_code?: string;
    postal_code?: string;
  };
  distance?: number;
}

const patientFormSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Use E.164 format, e.g. +14155551234"),

  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  genderAtBirth: z.enum(["male", "female"]),
});
type PatientForm = z.infer<typeof patientFormSchema>;

const EMPTY_PATIENT: PatientForm = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  dateOfBirth: "",
  genderAtBirth: "male",
};

interface AddressForm {
  address_line_1: string;
  address_line_2: string;
  city: string;
  administrative_area: string;
  country_code: string;
  postal_code: string;
}
const EMPTY_ADDRESS: AddressForm = {
  address_line_1: "",
  address_line_2: "",
  city: "",
  administrative_area: "",
  country_code: "US",
  postal_code: "",
};

/** Case-insensitive match of a server invalidFields.field to an address input. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const ADDRESS_FIELD_BY_NORM: Record<string, keyof AddressForm> = {
  addressline1: "address_line_1",
  addressline2: "address_line_2",
  city: "city",
  administrativearea: "administrative_area",
  countrycode: "country_code",
  postalcode: "postal_code",
};

function OrderPage() {
  const { variantId, productId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: variants, isLoading: variantsLoading } = useQuery({
    ...variantsQuery(Number(productId)),
    enabled: productId != null && !Number.isNaN(Number(productId)),
  });
  const variant = ((variants as CatalogVariant[] | undefined) ?? []).find(
    (v) => String(v.id) === variantId,
  );

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — patient + collection
  const [patientId, setPatientId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [collectionType, setCollectionType] = useState<CollectionType | null>(
    null,
  );
  const [zip, setZip] = useState("");
  const [lab, setLab] = useState<Lab | null>(null);

  // Step 2 — address + submit
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [reference] = useState(
    () =>
      `EXAPP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  // One key per order attempt: a retry of THIS attempt replays instead of
  // double-ordering. (reference stays the reconciliation key.)
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof AddressForm, string>>
  >({});
  const [otherErrors, setOtherErrors] = useState<string[]>([]);
  const [reconcile, setReconcile] = useState(false);
  const [retryable, setRetryable] = useState(false);

  const supported = variant?.available_collection_types ?? [];

  const createOrder = useMutation({
    mutationFn: () =>
      api.api.shop.orders
        .$post({
          json: {
            patientId: patientId!,
            variantId: variantId!,
            collectionType: collectionType!,
            address,
            ...(collectionType === "GO_TO_LAB" && lab
              ? {
                  requestedLab: {
                    code: lab.code,
                    postal_code: lab.address?.postal_code,
                  },
                }
              : {}),
            clientOrderReferenceId: reference,
            idempotencyKey,
          },
        })
        .then((r) => unwrap<{ order_id: string }>(r)),
    onSuccess: () => {
      toastQueue.add(
        { title: "Order placed", variant: "default" },
        { timeout: 3000 },
      );
      navigate({
        to: "/shop/kits",
        search: { patientId: patientId ?? undefined },
      });
    },
    onError: (e) => handleOrderError(e),
  });

  const reconcileCheck = useMutation({
    mutationFn: () =>
      api.api.shop.orders["by-reference"]
        .$get({ query: { reference } })
        .then((r) => unwrap<{ order: unknown }>(r)),
    onSuccess: ({ order }) => {
      if (order) {
        toastQueue.add(
          { title: "Order was placed", variant: "default" },
          { timeout: 3000 },
        );
        navigate({
          to: "/shop/kits",
          search: { patientId: patientId ?? undefined },
        });
      } else {
        setReconcile(false);
        setRetryable(true);
        setOtherErrors([
          "No order found for this attempt — it's safe to retry.",
        ]);
      }
    },
    onError: (e) =>
      toastQueue.add(
        {
          title: "Couldn't check order status",
          description: (e as Error).message,
          variant: "error",
        },
        { timeout: 6000 },
      ),
  });

  function resetErrors() {
    setFieldErrors({});
    setOtherErrors([]);
    setReconcile(false);
    setRetryable(false);
  }

  function handleOrderError(e: unknown) {
    resetErrors();
    const err = e as Error & { status?: number; body?: ApiErrorBody };
    if (err.status === 400 && err.body?.invalidFields?.length) {
      const fe: Partial<Record<keyof AddressForm, string>> = {};
      const other: string[] = [];
      for (const f of err.body.invalidFields) {
        const key = ADDRESS_FIELD_BY_NORM[norm(f.field)];
        if (key) fe[key] = f.message;
        else other.push(`${f.field}: ${f.message}`);
      }
      setFieldErrors(fe);
      setOtherErrors(other);
    } else if (err.status === 402) {
      setOtherErrors([
        "Payment couldn't be authorized — nothing was charged. Check the payment details and try again.",
      ]);
      setRetryable(true);
    } else if (
      !err.body ||
      err.body.category === "upstream" ||
      err.body.category === "network"
    ) {
      // Ambiguous — the order may have been created. Reconcile before retrying.
      setReconcile(true);
    } else {
      setOtherErrors([err.message]);
      setRetryable(true);
    }
  }

  if (variantsLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (!variant)
    return (
      <p className="text-base text-secondary-text">
        This kit is no longer available. Head back to the shop to pick another.
      </p>
    );

  const canContinue =
    Boolean(patientId) &&
    Boolean(collectionType) &&
    (collectionType === "AT_HOME" || Boolean(lab));

  function goToAddress() {
    if (lab?.address) {
      setAddress({
        address_line_1: lab.address.address_line_1 ?? "",
        address_line_2: lab.address.address_line_2 ?? "",
        city: lab.address.city ?? "",
        administrative_area: lab.address.administrative_area ?? "",
        country_code: lab.address.country_code ?? "US",
        postal_code: lab.address.postal_code ?? "",
      });
    }
    setStep(2);
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-main-black">Order kit</h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base text-secondary-text">
            {variant.variant_name} ·{" "}
            {formatPrice(variant.price_cents, variant.currency)}
          </p>
          {(variant.supported_ship_to_countries ?? []).map((cc) => (
            <Badge key={cc} variant="neutral">
              {countryName(cc)}
            </Badge>
          ))}
        </div>
      </div>

      {step === 1 ? (
        <>
          <PatientStep
            patientId={patientId}
            onSelect={setPatientId}
            creating={creating}
            setCreating={setCreating}
          />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-main-black">
              How would you like to collect your sample?
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <OptionCard
                title="At home"
                description="A kit ships to you; collect your sample and post it back."
                selected={collectionType === "AT_HOME"}
                disabled={!supported.includes("AT_HOME")}
                onSelect={() => {
                  setCollectionType("AT_HOME");
                  setLab(null);
                }}
              />
              <OptionCard
                title="At a lab"
                description="Visit a nearby lab to have your sample drawn."
                selected={collectionType === "GO_TO_LAB"}
                disabled={!supported.includes("GO_TO_LAB")}
                onSelect={() => setCollectionType("GO_TO_LAB")}
              />
            </div>
          </section>

          {collectionType === "GO_TO_LAB" && (
            <LabPicker
              zip={zip}
              setZip={setZip}
              selected={lab}
              onSelect={setLab}
            />
          )}

          <div className="flex justify-end">
            <Button isDisabled={!canContinue} onPress={goToAddress}>
              Continue
            </Button>
          </div>
        </>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-main-black">
              {collectionType === "GO_TO_LAB"
                ? "Confirm the lab address"
                : "Where should we ship your kit?"}
            </h2>

            {otherErrors.length > 0 && (
              <div className="flex gap-3 rounded-xl border border-warning bg-warning-bg p-4 text-sm text-warning">
                <WarningIcon size={24} weight="bold" className="shrink-0" />
                <div className="flex flex-col gap-1">
                  {otherErrors.map((m, i) => (
                    <span key={i} className={i === 0 ? "font-semibold" : ""}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <AddressFields
              address={address}
              setAddress={setAddress}
              errors={fieldErrors}
              allowedCountries={variant.supported_ship_to_countries}
            />
          </section>

          <div className="flex items-center justify-between">
            <Button variant="secondary" onPress={() => setStep(1)}>
              Back
            </Button>
            {reconcile ? (
              <Button
                variant="secondary"
                isPending={reconcileCheck.isPending}
                onPress={() => reconcileCheck.mutate()}
              >
                Check if the order went through
              </Button>
            ) : (
              <Button
                isPending={createOrder.isPending}
                onPress={() => createOrder.mutate()}
              >
                {retryable ? "Retry order" : "Place order"}
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function PatientStep({
  patientId,
  onSelect,
  creating,
  setCreating,
}: {
  patientId: string | null;
  onSelect: (id: string) => void;
  creating: boolean;
  setCreating: (v: boolean) => void;
}) {
  const { data: patients } = useQuery(patientsQuery);
  const [form, setForm] = useState<PatientForm>(EMPTY_PATIENT);
  const [errors, setErrors] = useState<
    Partial<Record<keyof PatientForm, string>>
  >({});

  const createPatient = useMutation({
    mutationFn: (body: PatientForm) =>
      api.api.shop.patients
        .$post({ json: body })
        .then((r) => unwrap<{ id: string }>(r)),
    onSuccess: ({ id }) => {
      setCreating(false);
      setForm(EMPTY_PATIENT);
      setErrors({});
      onSelect(id);
    },
    onError: (e) =>
      toastQueue.add(
        {
          title: "Couldn't add patient",
          description: (e as Error).message,
          variant: "error",
        },
        { timeout: 6000 },
      ),
  });

  function submit() {
    const parsed = patientFormSchema.safeParse(form);
    if (!parsed.success) {
      const fe: Partial<Record<keyof PatientForm, string>> = {};
      for (const issue of parsed.error.issues)
        fe[issue.path[0] as keyof PatientForm] = issue.message;
      setErrors(fe);
      return;
    }
    createPatient.mutate(parsed.data);
  }

  const set = (k: keyof PatientForm) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-main-black">
        Who is this test for?
      </h2>

      {!creating ? (
        <>
          <Select
            aria-label="Patient"
            placeholder="Select a patient"
            selectedKey={patientId}
            onSelectionChange={(key) => onSelect(String(key))}
            items={patients ?? []}
          >
            {(p) => (
              <SelectItem id={p.id} textValue={`${p.firstName} ${p.lastName}`}>
                {p.firstName} {p.lastName}
              </SelectItem>
            )}
          </Select>
          <Button
            variant="quiet"
            size="md"
            className="self-start whitespace-nowrap"
            onPress={() => setCreating(true)}
          >
            <PlusIcon size={16} weight="bold" /> Add a new patient
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="First name"
              value={form.firstName}
              onChange={set("firstName")}
              isInvalid={!!errors.firstName}
              errorMessage={errors.firstName}
            />
            <TextField
              label="Last name"
              value={form.lastName}
              onChange={set("lastName")}
              isInvalid={!!errors.lastName}
              errorMessage={errors.lastName}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              isInvalid={!!errors.email}
              errorMessage={errors.email}
            />
            <TextField
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              onChange={set("dateOfBirth")}
              isInvalid={!!errors.dateOfBirth}
              errorMessage={errors.dateOfBirth}
            />
            <TextField
              label="Phone number"
              type="tel"
              placeholder="+14155551234"
              value={form.phoneNumber}
              onChange={set("phoneNumber")}
              isInvalid={!!errors.phoneNumber}
              errorMessage={errors.phoneNumber}
            />
            <Select
              label="Sex at birth"
              selectedKey={form.genderAtBirth}
              onSelectionChange={(key) => set("genderAtBirth")(String(key))}
            >
              <SelectItem id="male">Male</SelectItem>
              <SelectItem id="female">Female</SelectItem>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="md"
              isPending={createPatient.isPending}
              onPress={submit}
            >
              Save patient
            </Button>
            <Button
              variant="quiet"
              size="md"
              onPress={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function OptionCard({
  title,
  description,
  selected,
  disabled,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition outline-blue-600 outline-offset-2 focus-visible:outline-2 ${
        disabled
          ? "cursor-not-allowed border-border bg-white opacity-50"
          : selected
            ? "border-emphasis-secondary bg-emphasis-bg"
            : "border-border bg-white hover:bg-hover-grey"
      }`}
    >
      <span className="text-base font-semibold text-main-black">{title}</span>
      <span className="text-sm text-secondary-text">
        {disabled ? "Not available for this kit" : description}
      </span>
    </button>
  );
}

function LabPicker({
  zip,
  setZip,
  selected,
  onSelect,
}: {
  zip: string;
  setZip: (v: string) => void;
  selected: Lab | null;
  onSelect: (l: Lab) => void;
}) {
  const { data, isFetching } = useQuery(labsQuery(zip));
  const labs = (data?.labs as Lab[] | undefined) ?? [];

  return (
    <section className="flex flex-col gap-3">
      <SearchField
        aria-label="ZIP code"
        placeholder="Enter a ZIP code"
        value={zip}
        onChange={setZip}
      />
      {isFetching ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : labs.length > 0 ? (
        <GridList
          aria-label="Nearby labs"
          selectionMode="single"
          selectedKeys={selected ? [selected.code] : []}
          onSelectionChange={(keys) => {
            const code = [...keys][0];
            const hit = labs.find((l) => l.code === code);
            if (hit) onSelect(hit);
          }}
        >
          {labs.map((l) => (
            <GridListItem key={l.code} id={l.code} textValue={l.name}>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-medium text-main-black">
                  {l.name}
                </span>
                <span className="text-sm text-subtle-text">
                  {[l.address?.address_line_1, l.address?.city]
                    .filter(Boolean)
                    .join(", ")}
                  {l.distance != null ? ` · ${l.distance.toFixed(1)} mi` : ""}
                </span>
              </div>
            </GridListItem>
          ))}
        </GridList>
      ) : null}
    </section>
  );
}

function AddressFields({
  address,
  setAddress,
  errors,
  allowedCountries,
}: {
  address: AddressForm;
  setAddress: (a: AddressForm) => void;
  errors: Partial<Record<keyof AddressForm, string>>;
  /** From the variant's supported_ship_to_countries — gate, don't discover at checkout. */
  allowedCountries?: string[];
}) {
  const set = (k: keyof AddressForm) => (v: string) =>
    setAddress({ ...address, [k]: v });

  // Default to the variant's country so labels (ZIP vs Postcode) start right.
  useEffect(() => {
    if (
      allowedCountries?.length &&
      !allowedCountries.includes(address.country_code)
    ) {
      setAddress({ ...address, country_code: allowedCountries[0] });
    }
  }, [allowedCountries]);

  // Debounced, best-effort suggestions (Google Places when the server has a
  // key, free Photon/OSM otherwise). Street picks fill the whole form;
  // postal picks fill the code plus its city/region/country.
  const street = useSuggest("street", allowedCountries);
  const postal = useSuggest("postal", allowedCountries);

  function pickStreet(sug: AddressSuggestion) {
    setAddress({
      ...address,
      address_line_1: sug.address_line_1,
      city: sug.city,
      administrative_area: sug.administrative_area,
      postal_code: sug.postal_code,
      country_code: sug.country_code || address.country_code,
    });
    street.clear();
  }

  function pickPostal(sug: AddressSuggestion) {
    setAddress({
      ...address,
      postal_code: sug.postal_code,
      city: sug.city || address.city,
      administrative_area:
        sug.administrative_area || address.administrative_area,
      country_code: sug.country_code || address.country_code,
    });
    postal.clear();
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="relative sm:col-span-2">
        <TextField
          label="Address line 1"
          placeholder="Start typing a street address, e.g. 10 Downing Street"
          autoComplete="address-line1"
          value={address.address_line_1}
          onChange={(v) => {
            set("address_line_1")(v);
            street.onQuery(v);
          }}
          isInvalid={!!errors.address_line_1}
          errorMessage={errors.address_line_1}
        />
        <SuggestList suggestions={street.suggestions} onPick={pickStreet} />
      </div>
      <div className="sm:col-span-2">
        <TextField
          label="Address line 2"
          placeholder="Flat, unit, floor (optional)"
          autoComplete="address-line2"
          value={address.address_line_2}
          onChange={set("address_line_2")}
          isInvalid={!!errors.address_line_2}
          errorMessage={errors.address_line_2}
        />
      </div>
      <TextField
        label="City"
        autoComplete="address-level2"
        value={address.city}
        onChange={set("city")}
        isInvalid={!!errors.city}
        errorMessage={errors.city}
      />
      <TextField
        label={regionLabel(address.country_code)}
        value={address.administrative_area}
        onChange={set("administrative_area")}
        isInvalid={!!errors.administrative_area}
        errorMessage={errors.administrative_area}
      />
      {allowedCountries?.length ? (
        <Select
          label="Country"
          selectedKey={
            allowedCountries.includes(address.country_code)
              ? address.country_code
              : null
          }
          onSelectionChange={(k) => set("country_code")(String(k))}
        >
          {allowedCountries.map((cc) => (
            <SelectItem key={cc} id={cc}>
              {countryName(cc)}
            </SelectItem>
          ))}
        </Select>
      ) : (
        <TextField
          label="Country code"
          placeholder="2-letter, e.g. US"
          value={address.country_code}
          onChange={set("country_code")}
          isInvalid={!!errors.country_code}
          errorMessage={errors.country_code}
        />
      )}
      <div className="relative">
        <TextField
          label={postalField(address.country_code).label}
          placeholder={
            postalField(address.country_code).example
              ? `e.g. ${postalField(address.country_code).example}`
              : undefined
          }
          autoComplete="postal-code"
          value={address.postal_code}
          onChange={(v) => {
            set("postal_code")(v);
            postal.onQuery(v);
          }}
          isInvalid={!!errors.postal_code}
          errorMessage={errors.postal_code}
        />
        <SuggestList suggestions={postal.suggestions} onPick={pickPostal} />
      </div>
    </div>
  );
}

function useSuggest(kind: "street" | "postal", allowedCountries?: string[]) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function onQuery(v: string) {
    clearTimeout(timer.current);
    // Postal codes are short — suggest from 2 chars; streets need more signal.
    if (v.trim().length < (kind === "postal" ? 2 : 4)) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/shop/address-suggest?q=${encodeURIComponent(v)}&kind=${kind}${
            allowedCountries?.length
              ? `&countries=${allowedCountries.join(",")}`
              : ""
          }`,
        );
        setSuggestions(res.ok ? await res.json() : []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  return { suggestions, onQuery, clear: () => setSuggestions([]) };
}

function SuggestList({
  suggestions,
  onPick,
}: {
  suggestions: AddressSuggestion[];
  onPick: (sug: AddressSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-white shadow-card">
      {suggestions.map((sug) => (
        <button
          key={sug.label}
          type="button"
          className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-main-black outline-blue-600 outline-offset-[-2px] hover:bg-hover-grey focus-visible:outline-2"
          onClick={() => onPick(sug)}
        >
          {sug.label}
        </button>
      ))}
    </div>
  );
}
