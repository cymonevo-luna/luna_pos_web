export function formatCogsMarginPercent(value: number): string {
  return `${Number(value).toFixed(2)}%`;
}

export function formatNullableCogsMarginPercent(
  value: number | null | undefined,
): string {
  if (value == null) return "—";
  return formatCogsMarginPercent(value);
}
