"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Mail, ShieldCheck, Store } from "lucide-react";
import { loginSchema, type LoginValues } from "@/lib/validations";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import {
  MERCHANT_REQUIRED_CODE,
  type LoginPayload,
} from "@/lib/api/auth";
import type { MerchantChoice } from "@/lib/api/types";
import {
  getAuthenticatedLandingPath,
  resolveUserRoles,
} from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { SocialButtons } from "@/components/auth/social-buttons";

interface LoginFormProps {
  variant?: "user" | "admin";
}

export function LoginForm({ variant = "user" }: LoginFormProps) {
  const isAdmin = variant === "admin";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, logout } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [merchantChoices, setMerchantChoices] = useState<MerchantChoice[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [pendingCredentials, setPendingCredentials] = useState<LoginPayload | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const completeLogin = async (user: Awaited<ReturnType<typeof login>>) => {
    if (isAdmin && !resolveUserRoles(user).includes("admin")) {
      logout();
      toast.error("This account does not have admin access.");
      return;
    }

    toast.success(`Welcome back, ${user.name}`);
    const redirect = searchParams.get("redirect");
    router.push(redirect ?? getAuthenticatedLandingPath(user));
    router.refresh();
  };

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      const payload: LoginPayload = {
        email: values.email,
        password: values.password,
        ...(selectedMerchantId ? { merchant_id: selectedMerchantId } : {}),
      };
      const user = await login(payload);
      setMerchantChoices([]);
      setPendingCredentials(null);
      await completeLogin(user);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === MERCHANT_REQUIRED_CODE &&
        Array.isArray((error.data as { merchants?: MerchantChoice[] })?.merchants)
      ) {
        const merchants = (error.data as { merchants: MerchantChoice[] }).merchants;
        setMerchantChoices(merchants);
        setPendingCredentials({
          email: values.email,
          password: values.password,
        });
        setSelectedMerchantId(merchants[0]?.id ?? "");
        toast.info("Select the merchant you want to sign in to.");
        return;
      }

      const message =
        error instanceof ApiError ? error.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onMerchantSelect = async () => {
    if (!pendingCredentials || !selectedMerchantId) return;
    setSubmitting(true);
    try {
      const user = await login({
        ...pendingCredentials,
        merchant_id: selectedMerchantId,
      });
      setMerchantChoices([]);
      setPendingCredentials(null);
      await completeLogin(user);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {isAdmin && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin access
        </div>
      )}
      <h1 className="text-2xl font-bold tracking-tight">
        {isAdmin ? "Admin Login" : "Welcome Back"}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {isAdmin
          ? "Sign in to the admin console."
          : "Sign in to continue to your account."}
      </p>

      {merchantChoices.length > 0 ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Your account is linked to multiple merchants. Choose one to continue.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="merchant_id">Merchant</Label>
            <div className="relative">
              <Store className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                id="merchant_id"
                value={selectedMerchantId}
                onChange={(event) => setSelectedMerchantId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {merchantChoices.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full"
            isLoading={submitting}
            onClick={() => void onMerchantSelect()}
          >
            Continue
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@email.com"
                className="pl-10"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  toast.info("Password reset is not wired up in this template.")
                }
              >
                Forgot password?
              </button>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={submitting}
          >
            Login
          </Button>
        </form>
      )}

      {!isAdmin && merchantChoices.length === 0 && (
        <>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              or continue with
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <SocialButtons />
        </>
      )}

      {!isAdmin && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            Register your merchant
          </Link>
        </p>
      )}
    </div>
  );
}
