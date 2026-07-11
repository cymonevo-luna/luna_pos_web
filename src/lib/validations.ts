import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
});

export const profileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;

export const foodSupplySchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title is too long"),
  description: z
    .string()
    .max(2000, "Description is too long")
    .optional()
    .or(z.literal("")),
  stock_quantity: z
    .number({ error: "Stock quantity is required" })
    .min(0, "Stock quantity cannot be negative"),
  unit: z.enum(["ml", "piece", "gr"], {
    error: "Select a valid unit",
  }),
});

export type FoodSupplyFormValues = z.infer<typeof foodSupplySchema>;
