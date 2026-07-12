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

export const supplierSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(200, "Name is too long"),
    phone_number: z
      .string()
      .trim()
      .min(5, "Phone number must be at least 5 characters")
      .max(30, "Phone number is too long"),
    address: z
      .string()
      .min(2, "Address must be at least 2 characters")
      .max(500, "Address is too long"),
    supports_delivery: z.boolean(),
    delivery_cost: z
      .number({ error: "Delivery cost must be a number" })
      .min(0, "Delivery cost cannot be negative")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.supports_delivery) {
      if (data.delivery_cost === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Delivery cost is required when delivery is supported",
          path: ["delivery_cost"],
        });
      }
    } else if (data.delivery_cost !== undefined && data.delivery_cost > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Delivery cost must be 0 when delivery is not supported",
        path: ["delivery_cost"],
      });
    }
  });

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const supplierPriceSchema = z.object({
  food_supply_id: z.string().min(1, "Food supply is required"),
  price_amount: z
    .number({ error: "Price amount is required" })
    .int("Price amount must be a whole number")
    .positive("Price amount must be greater than 0"),
  price_quantity: z
    .number({ error: "Price quantity is required" })
    .positive("Price quantity must be greater than 0"),
});

export type SupplierPriceFormValues = z.infer<typeof supplierPriceSchema>;

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export const menuBasicSchema = z.object({
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
});

export const menuCogsSchema = z.object({
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

export const menuSchema = menuBasicSchema.merge(menuCogsSchema);

export type MenuBasicFormValues = z.infer<typeof menuBasicSchema>;
export type MenuCogsFormValues = z.infer<typeof menuCogsSchema>;
export type MenuFormValues = z.infer<typeof menuSchema>;

export const storeSettingsSchema = z.object({
  brand_name: z
    .string()
    .trim()
    .min(1, "Brand name is required")
    .max(200, "Brand name is too long"),
  branch_name: z
    .string()
    .trim()
    .min(1, "Branch name is required")
    .max(200, "Branch name is too long"),
  address: z
    .string()
    .trim()
    .min(1, "Address is required")
    .max(500, "Address is too long"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .max(30, "Phone is too long"),
  thank_you_note: z
    .string()
    .max(500, "Thank you note is too long")
    .optional()
    .or(z.literal("")),
});

export type StoreSettingsFormValues = z.infer<typeof storeSettingsSchema>;

export const purchaseRequestLineItemSchema = z.object({
  food_supply_id: z.string().min(1, "Food supply is required"),
  quantity: z
    .number({ error: "Quantity is required" })
    .positive("Quantity must be greater than 0"),
});

export const purchaseRequestSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  items: z
    .array(purchaseRequestLineItemSchema)
    .min(1, "Add at least one line item"),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .optional()
    .or(z.literal("")),
});

export type PurchaseRequestFormValues = z.infer<typeof purchaseRequestSchema>;
