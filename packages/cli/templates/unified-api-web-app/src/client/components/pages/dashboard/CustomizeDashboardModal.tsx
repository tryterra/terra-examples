import { useState, useRef, useEffect } from "react";
import { Button } from "@/client/components/shared/atoms/Button";
import { Checkbox } from "@/client/components/shared/atoms/Checkbox";
import { CheckboxGroup } from "@/client/components/shared/atoms/CheckboxGroup";
import { Dialog, Heading } from "@/client/components/shared/atoms/Dialog";
import { Modal } from "@/client/components/shared/atoms/Modal";
import { toastQueue } from "@/client/components/shared/atoms/Toast";
import {
  useDashboardConfig,
  useUpdateDashboardConfig,
} from "@/client/hooks/useDashboardConfig";
import { CUSTOMIZABLE_SCORES } from "@/client/lib/dashboard/config";
import { METRICS, DASHBOARD_BIOMARKERS } from "@/client/lib/metrics/config";
import type { Icon } from "@phosphor-icons/react";

const ALL_SCORE_KEYS = CUSTOMIZABLE_SCORES.map((s) => s.key);
const ALL_BIOMARKER_KEYS = [...DASHBOARD_BIOMARKERS];

function CardCheckbox({
  value,
  title,
  icon: IconComponent,
}: {
  value: string;
  title: string;
  icon: Icon;
}) {
  return (
    <Checkbox value={value} variant="card">
      <IconComponent size={20} className="text-emphasis" />
      <span className="flex-1 text-base font-medium text-main-black">
        {title}
      </span>
    </Checkbox>
  );
}

/* -------------------------------- Scores modal -------------------------------- */

export function CustomizeScoresModal({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useDashboardConfig();
  const updateConfig = useUpdateDashboardConfig();

  const savedScores = data?.dashboardConfig?.scores ?? ALL_SCORE_KEYS;
  const savedBiomarkers =
    data?.dashboardConfig?.biomarkers ?? ALL_BIOMARKER_KEYS;

  const [selectedScores, setSelectedScores] = useState<string[]>(savedScores);

  const prevOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      setSelectedScores(savedScores);
    }
    prevOpen.current = isOpen;
  }, [isOpen, savedScores]);

  function handleSave(close: () => void) {
    updateConfig.mutate(
      { biomarkers: savedBiomarkers, scores: selectedScores },
      {
        onSuccess: () => close(),
        onError: () =>
          toastQueue.add(
            { title: "Failed to save scores", variant: "error" },
            { timeout: 3000 },
          ),
      },
    );
  }

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog className="flex max-h-[80vh] flex-col gap-6">
        {({ close }) => (
          <>
            <div className="flex flex-col gap-2">
              <Heading slot="title">Customize scores</Heading>
              <p className="text-base text-secondary-text">
                Choose which scores appear on your dashboard.
              </p>
            </div>

            <div className="-mx-6 flex flex-1 flex-col overflow-y-auto px-6 py-1">
              <CheckboxGroup
                value={selectedScores}
                onChange={setSelectedScores}
                aria-label="Scores"
              >
                <div className="flex flex-col gap-2">
                  {CUSTOMIZABLE_SCORES.map((score) => (
                    <CardCheckbox
                      key={score.key}
                      value={score.key}
                      title={score.title}
                      icon={score.icon}
                    />
                  ))}
                </div>
              </CheckboxGroup>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="quiet"
                className="rounded-full"
                onPress={close}
                size="md"
              >
                Cancel
              </Button>
              <Button
                isPending={updateConfig.isPending}
                onPress={() => handleSave(close)}
                size="md"
              >
                Save
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Modal>
  );
}

/* ------------------------------ Biomarkers modal ------------------------------ */

export function CustomizeBiomarkersModal({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useDashboardConfig();
  const updateConfig = useUpdateDashboardConfig();

  const savedScores = data?.dashboardConfig?.scores ?? ALL_SCORE_KEYS;
  const savedBiomarkers =
    data?.dashboardConfig?.biomarkers ?? ALL_BIOMARKER_KEYS;

  const [selectedBiomarkers, setSelectedBiomarkers] =
    useState<string[]>(savedBiomarkers);

  const prevOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      setSelectedBiomarkers(savedBiomarkers);
    }
    prevOpen.current = isOpen;
  }, [isOpen, savedBiomarkers]);

  function handleSave(close: () => void) {
    updateConfig.mutate(
      { biomarkers: selectedBiomarkers, scores: savedScores },
      {
        onSuccess: () => close(),
        onError: () =>
          toastQueue.add(
            { title: "Failed to save biomarkers", variant: "error" },
            { timeout: 3000 },
          ),
      },
    );
  }

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog className="flex max-h-[80vh] flex-col gap-6">
        {({ close }) => (
          <>
            <div className="flex flex-col gap-2">
              <Heading slot="title">Customize biomarkers</Heading>
              <p className="text-base text-secondary-text">
                Choose which biomarkers appear on your dashboard.
              </p>
            </div>

            <div className="-mx-6 flex flex-1 flex-col overflow-y-auto px-6 py-1">
              <CheckboxGroup
                value={selectedBiomarkers}
                onChange={setSelectedBiomarkers}
                aria-label="Biomarkers"
              >
                <div className="flex flex-col gap-2">
                  {DASHBOARD_BIOMARKERS.map((key) => {
                    const metric = METRICS[key];
                    return (
                      <CardCheckbox
                        key={key}
                        value={key}
                        title={metric.title}
                        icon={metric.icon}
                      />
                    );
                  })}
                </div>
              </CheckboxGroup>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="quiet"
                className="rounded-full"
                onPress={close}
                size="md"
              >
                Cancel
              </Button>
              <Button
                isPending={updateConfig.isPending}
                onPress={() => handleSave(close)}
                size="md"
              >
                Save
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Modal>
  );
}
