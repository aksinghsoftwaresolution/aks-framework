function splitWords(value: string): string[] {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\s-]+/g, " ")
    .split(" ")
    .map(word => word.trim())
    .filter(Boolean)
    .map(word => word.toLowerCase());
}

export function toKebabCase(value: string): string {
  return splitWords(value).join("-");
}

export function toPascalCase(value: string): string {
  return splitWords(value)
    .map(
      word =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join("");
}

export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);

  if (pascal.length === 0) {
    return "";
  }

  return (
    pascal.charAt(0).toLowerCase() +
    pascal.slice(1)
  );
}

export interface NormalizedName {
  original: string;
  kebab: string;
  pascal: string;
  camel: string;
}

export function normalizeName(
  value: string,
): NormalizedName {
  const original = value.trim();

  return {
    original,
    kebab: toKebabCase(original),
    pascal: toPascalCase(original),
    camel: toCamelCase(original),
  };
}