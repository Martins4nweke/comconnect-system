export function requireString(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}

export function requireObject(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function optionalStatus(value: unknown, allowed: string[], fallback: string) {
  const status = String(value ?? fallback);
  return allowed.includes(status) ? status : fallback;
}
