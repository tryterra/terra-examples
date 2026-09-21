import { ArrowLeftIcon } from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/client/components/shared/atoms/Button";
import { Form } from "@/client/components/shared/atoms/Form";
import { Link } from "@/client/components/shared/atoms/Link";
import { TextField } from "@/client/components/shared/atoms/TextField";
import { toastQueue } from "@/client/components/shared/atoms/Toast";
import { Navbar } from "@/client/components/shared/molecules/Navbar";
import { emailOtp } from "@/client/lib/auth-client";
import { api } from "@/client/lib/api";

export const Route = createFileRoute("/_public/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await api.api.users.exists.$get({ query: { email } });
      if (!res.ok) throw new Error("Failed to check user");
      const { exists } = await res.json();
      if (exists) {
        setErrors({ email: "An account with this email already exists" });
        return;
      }

      const result = await emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        setErrors({ email: result.error.message ?? "Failed to send code" });
        return;
      }

      navigate({ to: "/verify", search: { email, name } });
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

  return (
    <main className="flex min-h-screen flex-col items-center bg-bg-grey">
      <Navbar
        left={
          <Link to="/" variant="button-quiet">
            <ArrowLeftIcon size={16} weight="bold" />
            Back
          </Link>
        }
      />
      <Form
        onSubmit={handleSendOtp}
        validationErrors={errors}
        className="w-full max-w-96 flex-1 justify-center gap-8 px-4"
      >
        <h1 className="text-center text-4xl font-semibold leading-none text-main-black">
          Sign up
        </h1>

        <div className="flex flex-col gap-8">
          <TextField
            name="name"
            label="Name"
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={setName}
            isRequired
          />

          <TextField
            name="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            isRequired
          />
        </div>

        <div className="flex flex-col items-center gap-4">
          <Button type="submit" className="w-full" isPending={loading}>
            Continue
          </Button>
          <p className="text-base">
            <span className="text-subtle-text">Already have an account? </span>
            <Link to="/login" variant="primary">
              Log in
            </Link>
          </p>
        </div>
      </Form>
    </main>
  );
}
