import { ArrowLeftIcon } from "@phosphor-icons/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/client/components/shared/atoms/Button";
import { Form } from "@/client/components/shared/atoms/Form";
import { Link } from "@/client/components/shared/atoms/Link";
import { TextField } from "@/client/components/shared/atoms/TextField";
import { toastQueue } from "@/client/components/shared/atoms/Toast";
import { Navbar } from "@/client/components/shared/molecules/Navbar";
import { signIn, emailOtp } from "@/client/lib/auth-client";

type VerifySearch = { email: string; name?: string };

export const Route = createFileRoute("/_public/verify")({
  validateSearch: (search: Record<string, unknown>): VerifySearch => {
    if (!search.email || typeof search.email !== "string") {
      throw redirect({ to: "/login" });
    }
    return {
      email: search.email,
      name: typeof search.name === "string" ? search.name : undefined,
    };
  },
  component: VerifyPage,
});

function VerifyPage() {
  const { email, name } = Route.useSearch();
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const result = await signIn.emailOtp({
        email,
        otp,
        ...(name && { name }),
      });

      if (result.error) {
        setErrors({ otp: result.error.message ?? "Invalid code" });
        return;
      }

      navigate({ to: "/dashboard" });
    } catch {
      toastQueue.add(
        {
          title: "Something went wrong",
          description: "Please try again.",
          variant: "error",
        },
        { timeout: 5000 },
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setErrors({});
    setResending(true);

    try {
      const result = await emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        setErrors({ otp: result.error.message ?? "Failed to resend code" });
      }
    } catch {
      toastQueue.add(
        {
          title: "Something went wrong",
          description: "Please try again.",
          variant: "error",
        },
        { timeout: 5000 },
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-bg-grey">
      <Navbar
        left={
          <Link to={name ? "/register" : "/login"} variant="button-quiet">
            <ArrowLeftIcon size={16} weight="bold" />
            Back
          </Link>
        }
      />
      <Form
        onSubmit={handleVerify}
        validationErrors={errors}
        className="w-full max-w-96 flex-1 justify-center gap-8 px-4"
      >
        <div className="flex flex-col gap-4 text-center">
          <h1 className="text-4xl font-semibold leading-none text-main-black">
            Enter the code
          </h1>
          <p className="text-base text-secondary-text">
            Enter the verification code we just sent to{" "}
            <span className="font-semibold">{email}</span>
          </p>
        </div>

        <TextField
          name="otp"
          label="Code"
          type="text"
          inputMode="numeric"
          placeholder="123456"
          value={otp}
          onChange={setOtp}
          isRequired
          autoFocus
        />

        <div className="flex flex-col items-center gap-4">
          <Button type="submit" className="w-full" isPending={loading}>
            Continue
          </Button>
          <Button
            type="button"
            variant="inline"
            isDisabled={resending}
            onPress={handleResend}
          >
            {resending ? "Sending..." : "Resend code"}
          </Button>
        </div>
      </Form>
    </main>
  );
}
