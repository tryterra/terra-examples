import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DialogTrigger, Dialog, Heading } from "react-aria-components";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Form } from "@/client/components/shared/atoms/Form";
import { TextField } from "@/client/components/shared/atoms/TextField";
import { NumberField } from "@/client/components/shared/atoms/NumberField";
import { Select, SelectItem } from "@/client/components/shared/atoms/Select";
import { Button } from "@/client/components/shared/atoms/Button";
import { Modal } from "@/client/components/shared/atoms/Modal";
import { api } from "@/client/lib/api";
import { queryClient } from "@/client/lib/query-client";
import { profileQueryOpts } from "@/client/hooks/useUserQueries";
import { authClient, useSession } from "@/client/lib/auth-client";
import { toastQueue } from "@/client/components/shared/atoms/Toast";
import { SettingsPageSkeleton } from "@/client/components/shared/molecules/SettingsPageSkeleton";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  loader: () => {
    queryClient.prefetchQuery(profileQueryOpts);
  },
});

function SettingsPage() {
  const {
    data: profile,
    dataUpdatedAt,
    isPending,
  } = useQuery(profileQueryOpts);
  const { refetch: refetchSession } = useSession();

  const [accountChanged, setAccountChanged] = useState(false);
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>(
    {},
  );
  const [profileChanged, setProfileChanged] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>(
    {},
  );

  const accountMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.api.users.account.$put({ json: { name } });
      if (!res.ok) throw new Error("Failed to update name");
    },
    onMutate: async (newName) => {
      await queryClient.cancelQueries({ queryKey: ["profile"] });
      const previous = queryClient.getQueryData(profileQueryOpts.queryKey);
      queryClient.setQueryData(profileQueryOpts.queryKey, (old) =>
        old ? { ...old, name: newName } : old,
      );
      return { previous };
    },
    onError: (_err, _newName, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileQueryOpts.queryKey, context.previous);
      }
      toastQueue.add(
        { title: "Something went wrong", variant: "error" },
        { timeout: 3000 },
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await authClient.getSession({
        query: { disableCookieCache: true },
      });
      refetchSession();
      setAccountChanged(false);
      toastQueue.add(
        { title: "Account updated", variant: "success" },
        { timeout: 3000 },
      );
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: {
      age: number | null;
      gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN" | null;
      heightCm: number | null;
      weightKg: number | null;
      lifestyleGoals: string | null;
    }) => {
      const res = await api.api.users.profile.$put({ json: data });
      if (!res.ok) throw new Error("Failed to update profile");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setProfileChanged(false);
      toastQueue.add(
        { title: "Profile updated", variant: "success" },
        { timeout: 3000 },
      );
    },
    onError: () => {
      toastQueue.add(
        { title: "Something went wrong", variant: "error" },
        { timeout: 3000 },
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.users.account.$delete();
      if (!res.ok) throw new Error("Failed to delete account");
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.replace("/login");
    },
    onError: () => {
      toastQueue.add(
        { title: "Something went wrong", variant: "error" },
        { timeout: 3000 },
      );
    },
  });

  if (isPending || !profile) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="flex justify-center py-32 px-4">
      <div className="flex flex-col gap-16 w-2xl">
        <h1 className="text-4xl font-semibold text-main-black leading-none">
          Settings
        </h1>

        {/* Account information */}
        <section className="flex flex-col gap-8">
          <h2 className="text-lg font-semibold text-main-black leading-none">
            Account information
          </h2>
          <Form
            key={`account-${dataUpdatedAt}`}
            action={(formData: FormData) => {
              setAccountErrors({});
              const name = (formData.get("name") as string)?.trim();
              if (!name) {
                setAccountErrors({ name: "Name is required" });
                return;
              }
              accountMutation.mutate(name);
            }}
            validationErrors={accountErrors}
            onChange={() => setAccountChanged(true)}
            className="flex flex-col gap-8"
          >
            <TextField
              name="name"
              label="Name"
              defaultValue={profile.name ?? ""}
              isRequired
            />
            <TextField
              label="Email"
              defaultValue={profile.email ?? ""}
              isReadOnly
            />
            <Button
              type="submit"
              variant="primary"
              isDisabled={!accountChanged}
              isPending={accountMutation.isPending}
              className="w-full"
            >
              Update
            </Button>
          </Form>
        </section>

        {/* Additional information */}
        <section className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-main-black leading-none">
              Additional information
            </h2>
            <p className="text-base text-secondary-text">
              Help our AI provide health insights tailored to you.
            </p>
          </div>
          <Form
            action={(formData: FormData) => {
              setProfileErrors({});
              const ageRaw = formData.get("age") as string;
              const heightRaw = formData.get("heightCm") as string;
              const weightRaw = formData.get("weightKg") as string;
              const gender = (formData.get("gender") as string) || null;
              const lifestyleGoals =
                (formData.get("lifestyleGoals") as string)?.trim() || null;
              profileMutation.mutate({
                age: ageRaw ? Number(ageRaw) : null,
                gender: gender as
                  | "MALE"
                  | "FEMALE"
                  | "OTHER"
                  | "UNKNOWN"
                  | null,
                heightCm: heightRaw ? Number(heightRaw) : null,
                weightKg: weightRaw ? Number(weightRaw) : null,
                lifestyleGoals,
              });
            }}
            validationErrors={profileErrors}
            onChange={() => setProfileChanged(true)}
            className="flex flex-col gap-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                name="age"
                label="Age"
                defaultValue={profile.age ?? undefined}
                minValue={1}
                maxValue={150}
              />
              <Select
                name="gender"
                label="Gender"
                placeholder="Select gender"
                defaultValue={profile.gender ?? undefined}
                onChange={() => setProfileChanged(true)}
              >
                <SelectItem id="MALE">Male</SelectItem>
                <SelectItem id="FEMALE">Female</SelectItem>
                <SelectItem id="OTHER">Other</SelectItem>
                <SelectItem id="UNKNOWN">Prefer not to say</SelectItem>
              </Select>
              <NumberField
                name="heightCm"
                label="Height (cm)"
                defaultValue={profile.heightCm ?? undefined}
                minValue={1}
                maxValue={300}
              />
              <NumberField
                name="weightKg"
                label="Weight (kg)"
                defaultValue={profile.weightKg ?? undefined}
                minValue={1}
                maxValue={500}
              />
            </div>
            <TextField
              name="lifestyleGoals"
              label="Lifestyle and goals"
              description="The more context you provide, the better our AI can coach you."
              defaultValue={profile.lifestyleGoals ?? ""}
              placeholder="I work a desk job but hit the gym 3x a week. I struggle with consistent sleep and want to focus on heart health..."
              rows={4}
            />
            <Button
              type="submit"
              variant="primary"
              isDisabled={!profileChanged}
              isPending={profileMutation.isPending}
              className="w-full"
            >
              Update
            </Button>
          </Form>
        </section>

        {/* Danger zone */}
        <section className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-main-black leading-none">
              Danger zone
            </h2>
            <p className="text-base text-secondary-text">
              This action is irreversible. Your account and its associated data
              will be deleted.
            </p>
          </div>
          <DialogTrigger>
            <Button
              variant="destructive"
              className="w-full rounded-full h-12 text-base font-semibold"
            >
              Delete my account
            </Button>
            <Modal isDismissable>
              <Dialog className="p-6 outline-none">
                {({ close }) => (
                  <div className="flex flex-col gap-6">
                    <Heading
                      slot="title"
                      className="text-xl font-semibold text-main-black mt-0"
                    >
                      Delete your account?
                    </Heading>
                    <p className="text-base text-secondary-text">
                      This will permanently delete your account and all
                      associated data. This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="secondary"
                        onPress={close}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        isPending={deleteMutation.isPending}
                        onPress={() =>
                          deleteMutation.mutate(undefined, {
                            onSuccess: () => close(),
                          })
                        }
                        className="flex-1"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Dialog>
            </Modal>
          </DialogTrigger>
        </section>
      </div>
    </div>
  );
}
