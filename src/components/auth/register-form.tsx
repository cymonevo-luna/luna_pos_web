"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Mail, User as UserIcon, ShieldCheck } from "lucide-react";
import { registerSchema, type RegisterValues } from "@/lib/validations";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { SocialButtons } from "@/components/auth/social-buttons";

interface RegisterFormProps {
  variant?: "user" | "admin";
}

export function RegisterForm({ variant = "user" }: RegisterFormProps) {
  const isAdmin = variant === "admin";
  const router = useRouter();
  const { register: registerUser, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterValues) => {
    setSubmitting(true);
    try {
      await registerUser(values);
      const user = await login({
        email: values.email,
        password: values.password,
      });
      toast.success("Account created");
      router.push(user.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
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
        {isAdmin ? "Create admin account" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {isAdmin
          ? "Admin roles are granted server-side after sign-up."
          : "Start building in seconds."}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              autoComplete="name"
              placeholder="Alex Johnson"
              className="pl-10"
              {...register("name")}
            />
          </div>
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

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
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
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
          Create account
        </Button>
      </form>

      {!isAdmin && (
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={isAdmin ? "/admin/login" : "/login"}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
