"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  User as UserIcon,
} from "lucide-react";
import {
  merchantRegisterSchema,
  type MerchantRegisterValues,
} from "@/lib/validations";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import { getAuthenticatedLandingPath } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const API_FIELD_MAP: Partial<
  Record<keyof MerchantRegisterValues, keyof MerchantRegisterValues>
> = {
  merchant_name: "merchant_name",
  address: "address",
  phone: "phone",
  admin_email: "admin_email",
  admin_name: "admin_name",
  admin_password: "admin_password",
};

export function MerchantRegisterForm() {
  const router = useRouter();
  const { registerMerchant } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MerchantRegisterValues>({
    resolver: zodResolver(merchantRegisterSchema),
  });

  const applyServerErrors = (fields: Record<string, string>) => {
    for (const [key, message] of Object.entries(fields)) {
      const field = API_FIELD_MAP[key as keyof MerchantRegisterValues];
      if (field) {
        setError(field, { message });
      }
    }
  };

  const onSubmit = async (values: MerchantRegisterValues) => {
    setSubmitting(true);
    try {
      const user = await registerMerchant({
        merchant_name: values.merchant_name,
        address: values.address,
        phone: values.phone,
        admin_email: values.admin_email,
        admin_name: values.admin_name,
        admin_password: values.admin_password,
      });
      toast.success("Merchant registered successfully");
      router.push(getAuthenticatedLandingPath(user));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setError("admin_email", {
            message:
              error.message || "An account with this email already exists",
          });
          return;
        }
        if (error.status === 422 && error.fields) {
          applyServerErrors(error.fields);
          return;
        }
        toast.error(error.message);
        return;
      }
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        Register your merchant
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Create your business profile and founding admin account.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="merchant_name">Merchant Name</Label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="merchant_name"
              autoComplete="organization"
              placeholder="Luna Cafe"
              className="pl-10"
              {...register("merchant_name")}
            />
          </div>
          {errors.merchant_name && (
            <p className="text-sm text-destructive">
              {errors.merchant_name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="address"
              autoComplete="street-address"
              placeholder="123 Main Street"
              className="pl-10"
              {...register("address")}
            />
          </div>
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+62 812 3456 7890"
              className="pl-10"
              {...register("phone")}
            />
          </div>
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin_email">Admin Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin_email"
              type="email"
              autoComplete="email"
              placeholder="owner@example.com"
              className="pl-10"
              {...register("admin_email")}
            />
          </div>
          {errors.admin_email && (
            <p className="text-sm text-destructive">
              {errors.admin_email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin_name">Admin Name</Label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin_name"
              autoComplete="name"
              placeholder="Alex Johnson"
              className="pl-10"
              {...register("admin_name")}
            />
          </div>
          {errors.admin_name && (
            <p className="text-sm text-destructive">
              {errors.admin_name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin_password">Admin Password</Label>
          <PasswordInput
            id="admin_password"
            autoComplete="new-password"
            placeholder="••••••••••"
            {...register("admin_password")}
          />
          {errors.admin_password && (
            <p className="text-sm text-destructive">
              {errors.admin_password.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm_password">Confirm Password</Label>
          <PasswordInput
            id="confirm_password"
            autoComplete="new-password"
            placeholder="••••••••••"
            {...register("confirm_password")}
          />
          {errors.confirm_password && (
            <p className="text-sm text-destructive">
              {errors.confirm_password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          isLoading={submitting}
        >
          Register merchant
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
