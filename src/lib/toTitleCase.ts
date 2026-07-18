/**
 * Mirror backend textutil.ToTitleCase: trim, collapse whitespace, then title-case
 * each word using English rules.
 */
export function toTitleCase(value: string): string {
  const words = value.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return "";

  return words
    .map((word) => {
      const lower = word.toLocaleLowerCase("en");
      return lower.charAt(0).toLocaleUpperCase("en") + lower.slice(1);
    })
    .join(" ");
}
