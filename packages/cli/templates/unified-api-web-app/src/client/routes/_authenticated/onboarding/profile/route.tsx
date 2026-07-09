import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Form } from "@/client/components/shared/atoms/Form";
import { TextField } from "@/client/components/shared/atoms/TextField";
import { NumberField } from "@/client/components/shared/atoms/NumberField";
import { Select, SelectItem } from "@/client/components/shared/atoms/Select";
import { Button } from "@/client/components/shared/atoms/Button";
import { api } from "@/client/lib/api";
import { authClient } from "@/client/lib/auth-client";

export const Route = createFileRoute("/_authenticated/onboarding/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [age, setAge] = useState<number | undefined>();
  const [gender, setGender] = useState<string>("");
  const [heightCm, setHeightCm] = useState<number | undefined>();
  const [weightKg, setWeightKg] = useState<number | undefined>();
  const [lifestyleGoals, setLifestyleGoals] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      if (!age || !gender || !heightCm || !weightKg) {
        const fieldErrors: Record<string, string> = {};
        if (!age) fieldErrors.age = "Age is required";
        if (!gender) fieldErrors.gender = "Gender is required";
        if (!heightCm) fieldErrors.heightCm = "Height is required";
        if (!weightKg) fieldErrors.weightKg = "Weight is required";
        setErrors(fieldErrors);
        return;
      }

      const res = await api.api.onboarding.profile.$post({
        json: {
          age,
          gender: gender as "MALE" | "FEMALE" | "OTHER" | "UNKNOWN",
          heightCm,
          weightKg,
          lifestyleGoals: lifestyleGoals || undefined,
        },
      });

      if (!res.ok) {
        setErrors({ form: "Failed to save profile. Please try again." });
        return;
      }

      await authClient.getSession({
        query: { disableCookieCache: true },
      });
      navigate({ to: "/onboarding/connect" });
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-bg-grey px-4 py-32">
      <Form
        onSubmit={handleSubmit}
        validationErrors={errors}
        className="flex w-full max-w-2xl flex-col gap-16"
      >
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold leading-none text-main-black">
            Help us get to know you
          </h1>
          <p className="text-base text-secondary-text">
            Tell us a bit about yourself so our AI can provide health insights
            tailored specifically to you.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold leading-none text-main-black">
              Your details
            </h2>
            <p className="text-base text-secondary-text">
              Basic stats help our AI set your health baseline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberField
              name="age"
              label="Age"
              value={age}
              onChange={(v) => setAge(Number.isNaN(v) ? undefined : v)}
              minValue={1}
              maxValue={150}
            />

            <Select
              name="gender"
              label="Gender"
              placeholder="Select gender"
              value={gender || null}
              onChange={(key) => setGender(key as string)}
            >
              <SelectItem id="MALE">Male</SelectItem>
              <SelectItem id="FEMALE">Female</SelectItem>
              <SelectItem id="OTHER">Other</SelectItem>
              <SelectItem id="UNKNOWN">Prefer not to say</SelectItem>
            </Select>

            <NumberField
              name="heightCm"
              label="Height (cm)"
              value={heightCm}
              onChange={(v) => setHeightCm(Number.isNaN(v) ? undefined : v)}
              minValue={1}
              maxValue={300}
            />

            <NumberField
              name="weightKg"
              label="Weight (kg)"
              value={weightKg}
              onChange={(v) => setWeightKg(Number.isNaN(v) ? undefined : v)}
              minValue={1}
              maxValue={500}
            />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold leading-none text-main-black">
              Lifestyle and goals
            </h2>
            <p className="text-base text-secondary-text">
              The more context you provide, the better our AI can coach you.
            </p>
          </div>

          <TextField
            name="lifestyleGoals"
            value={lifestyleGoals}
            onChange={setLifestyleGoals}
            placeholder="I work a desk job but hit the gym 3x a week. I struggle with consistent sleep and want to focus on heart health..."
            rows={4}
            aria-label="Lifestyle and goals"
          />
        </div>

        {errors.form && <p className="text-sm text-failure">{errors.form}</p>}

        <Button type="submit" isPending={isSubmitting} className="w-full">
          Save and continue
        </Button>
      </Form>
    </main>
  );
}
