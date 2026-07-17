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

export const merchantRegisterSchema = z
  .object({
    merchant_name: z
      .string()
      .trim()
      .min(1, "Merchant name is required")
      .max(200, "Merchant name is too long"),
    address: z
      .string()
      .trim()
      .min(1, "Address is required")
      .max(500, "Address is too long"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .max(30, "Phone number is too long"),
    admin_email: z.string().email("Enter a valid email address"),
    admin_name: z
      .string()
      .trim()
      .min(2, "Admin name must be at least 2 characters")
      .max(120, "Admin name is too long"),
    admin_password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password is too long"),
    confirm_password: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.admin_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type MerchantRegisterValues = z.infer<typeof merchantRegisterSchema>;

export const cookingMeasurementSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  conversion_quantity: z
    .string()
    .trim()
    .min(1, "Conversion is required")
    .refine((value) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0;
    }, "Conversion must be greater than 0"),
});

export const foodSupplySchema = z
  .object({
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
    cooking_measurements: z.array(cookingMeasurementSchema),
  })
  .superRefine((data, ctx) => {
    const seen = new Map<string, number>();
    data.cooking_measurements.forEach((measurement, index) => {
      const normalized = measurement.name.trim().toLowerCase();
      if (!normalized) return;
      const firstIndex = seen.get(normalized);
      if (firstIndex !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Measurement name must be unique",
          path: ["cooking_measurements", index, "name"],
        });
        const alreadyFlaggedFirst = ctx.issues.some(
          (issue) =>
            issue.path?.[0] === "cooking_measurements" &&
            issue.path?.[1] === firstIndex &&
            issue.path?.[2] === "name",
        );
        if (!alreadyFlaggedFirst) {
          ctx.addIssue({
            code: "custom",
            message: "Measurement name must be unique",
            path: ["cooking_measurements", firstIndex, "name"],
          });
        }
      } else {
        seen.set(normalized, index);
      }
    });
  });

export type CookingMeasurementFormValues = z.infer<
  typeof cookingMeasurementSchema
>;
export type FoodSupplyFormValues = z.infer<typeof foodSupplySchema>;

export const branchAssetSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title is too long"),
  description: z
    .string()
    .max(2000, "Description is too long")
    .optional()
    .or(z.literal("")),
  quantity: z
    .number({ error: "Quantity is required" })
    .min(0, "Quantity cannot be negative"),
  price_amount: z
    .number({ error: "Price is required" })
    .int("Price must be a whole number")
    .min(0, "Price cannot be negative"),
  photo_url: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value?.trim() || z.string().url().safeParse(value.trim()).success,
      "Enter a valid URL",
    ),
});

export type BranchAssetFormValues = z.infer<typeof branchAssetSchema>;

const recurringExpenseTimeSchema = z.object({
  hour: z
    .number({ error: "Hour is required" })
    .int("Hour must be a whole number")
    .min(0, "Hour must be between 0 and 23")
    .max(23, "Hour must be between 0 and 23"),
  minute: z
    .number({ error: "Minute is required" })
    .int("Minute must be a whole number")
    .min(0, "Minute must be between 0 and 59")
    .max(59, "Minute must be between 0 and 59"),
  second: z
    .number({ error: "Second is required" })
    .int("Second must be a whole number")
    .min(0, "Second must be between 0 and 59")
    .max(59, "Second must be between 0 and 59"),
});

const recurringExpenseScheduleSchema = z
  .object({
    interval: z.enum(["DATE", "DAY", "DAILY"], {
      error: "Select a valid interval",
    }),
    value: z
      .number({ error: "Value must be a number" })
      .int("Value must be a whole number")
      .optional(),
    time: recurringExpenseTimeSchema,
  })
  .superRefine((data, ctx) => {
    if (data.interval === "DATE") {
      if (data.value === undefined || Number.isNaN(data.value)) {
        ctx.addIssue({
          code: "custom",
          message: "Day of month is required",
          path: ["value"],
        });
        return;
      }
      if (data.value < 1 || data.value > 31) {
        ctx.addIssue({
          code: "custom",
          message: "Day of month must be between 1 and 31",
          path: ["value"],
        });
      }
      return;
    }

    if (data.interval === "DAY") {
      if (data.value === undefined || Number.isNaN(data.value)) {
        ctx.addIssue({
          code: "custom",
          message: "Weekday is required",
          path: ["value"],
        });
        return;
      }
      if (data.value < 1 || data.value > 7) {
        ctx.addIssue({
          code: "custom",
          message: "Weekday must be between 1 and 7",
          path: ["value"],
        });
      }
    }
  });

export const recurringExpenseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title is too long"),
  description: z
    .string()
    .max(2000, "Description is too long")
    .optional()
    .or(z.literal("")),
  amount: z
    .number({ error: "Amount is required" })
    .int("Amount must be a whole number")
    .min(1, "Amount must be at least 1"),
  is_active: z.boolean(),
  recurring: recurringExpenseScheduleSchema,
});

export type RecurringExpenseFormValues = z.infer<typeof recurringExpenseSchema>;

export const expenseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title is too long"),
  description: z
    .string()
    .max(2000, "Description is too long")
    .optional()
    .or(z.literal("")),
  amount: z
    .number({ error: "Amount is required" })
    .int("Amount must be a whole number")
    .min(1, "Amount must be at least 1"),
  receipt_url: z.string().optional().or(z.literal("")),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

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

export const staffSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK must be exactly 16 digits"),
  ktp_photo_url: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value?.trim() || z.string().url().safeParse(value.trim()).success,
      "Enter a valid URL",
    ),
  address: z
    .string()
    .min(2, "Address must be at least 2 characters")
    .max(500, "Address is too long"),
  job_title: z
    .string()
    .min(2, "Job title must be at least 2 characters")
    .max(120, "Job title is too long"),
  salary_amount: z
    .union([z.nan(), z.undefined(), z.number()])
    .transform((value) =>
      value === undefined || Number.isNaN(value) ? undefined : value,
    )
    .refine(
      (value) => value === undefined || Number.isInteger(value),
      "Salary must be a whole number",
    )
    .refine(
      (value) => value === undefined || value >= 0,
      "Salary cannot be negative",
    ),
  benefits: z
    .string()
    .max(2000, "Benefits is too long")
    .optional()
    .or(z.literal("")),
});

export type StaffFormValues = z.infer<typeof staffSchema>;

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

export const productionRequestLineItemSchema = z.object({
  menu_id: z.string().min(1, "Menu is required"),
  quantity: z
    .number({ error: "Quantity is required" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than 0"),
});

export const productionRequestFormSchema = z.object({
  items: z
    .array(productionRequestLineItemSchema)
    .min(1, "Add at least one line item"),
  notes: z
    .string()
    .max(2000, "Notes are too long")
    .optional()
    .or(z.literal("")),
});

export type ProductionRequestFormValues = z.infer<
  typeof productionRequestFormSchema
>;

const assignableRoleSchema = z.enum(
  ["admin", "manager", "cashier", "operational"],
  { error: "Select a valid role" },
);

export const adminUserCreateSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
  roles: z
    .array(assignableRoleSchema)
    .min(1, "Select at least one role"),
});

export type AdminUserCreateFormValues = z.infer<typeof adminUserCreateSchema>;

export const adminUserRolesSchema = z.object({
  roles: z
    .array(assignableRoleSchema)
    .min(1, "Select at least one role"),
});

export type AdminUserRolesFormValues = z.infer<typeof adminUserRolesSchema>;
