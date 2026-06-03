export function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

export function truncateText(value?: string | null, max = 80) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
