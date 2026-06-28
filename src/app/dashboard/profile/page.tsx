"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { profileSchema, type ProfileValues } from "@/lib/validations";
import { useAuth } from "@/lib/auth/context";
import { usersApi } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  { label: "Projects", value: "12" },
  { label: "Tasks", value: "48" },
  { label: "Completed", value: "85%" },
];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "" },
  });

  useEffect(() => {
    if (user) reset({ name: user.name });
  }, [user, reset]);

  if (!user) return null;

  const onSubmit = async (values: ProfileValues) => {
    setSubmitting(true);
    try {
      await usersApi.update(user.id, values);
      await refreshUser();
      toast.success("Profile updated");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Avatar name={user.name} className="h-20 w-20" textClassName="text-2xl" />
          <div>
            <p className="flex items-center justify-center gap-2 text-lg font-semibold">
              {user.name}
              <Badge variant={user.role === "admin" ? "success" : "secondary"}>
                {user.role}
              </Badge>
            </p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="mt-2 grid w-full grid-cols-3 divide-x divide-border rounded-2xl bg-muted/50 py-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Member since</Label>
              <p className="text-sm text-muted-foreground">
                {formatDate(user.created_at)}
              </p>
            </div>
            <Button type="submit" isLoading={submitting}>
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
