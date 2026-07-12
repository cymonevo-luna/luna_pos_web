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

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export const menuSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z
    .string()
    .max(2000, "Description is too long")
    .optional()
    .or(z.literal("")),
  category_id: z.string().min(1, "Category is required"),
  photo_url: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value?.trim() || z.string().url().safeParse(value.trim()).success,
      "Enter a valid URL",
    ),
  available_stock: z
    .number({ error: "Available stock is required" })
    .int("Available stock must be a whole number")
    .min(0, "Available stock cannot be negative"),
  sell_price: z
    .number({ error: "Sell price is required" })
    .int("Sell price must be a whole number")
    .positive("Sell price must be greater than 0"),
  recipe_yield: z
    .number({ error: "Recipe yield is required" })
    .int("Recipe yield must be a whole number")
    .min(1, "Recipe yield must be at least 1"),
  margin_percent: z
    .number({ error: "Margin is required" })
    .min(0, "Margin cannot be negative"),
  vat_percent: z
    .number({ error: "VAT is required" })
    .min(0, "VAT cannot be negative"),
});

export type MenuFormValues = z.infer<typeof menuSchema>;
