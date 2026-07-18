import type {
  FieldPath,
  FieldValues,
  PathValue,
  UseFormRegisterReturn,
  UseFormSetValue,
} from "react-hook-form";
import { toTitleCase } from "./toTitleCase";

export function withTitleCaseOnBlur<
  TFieldValues extends FieldValues,
  TFieldName extends FieldPath<TFieldValues>,
>(
  registration: UseFormRegisterReturn<TFieldName>,
  setValue: UseFormSetValue<TFieldValues>,
  name: TFieldName,
): UseFormRegisterReturn<TFieldName> {
  const { onBlur, ...rest } = registration;

  return {
    ...rest,
    onBlur: async (event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      const normalized = toTitleCase(target.value);
      if (normalized !== target.value) {
        setValue(name, normalized as PathValue<TFieldValues, TFieldName>, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      await onBlur(event);
    },
  };
}
