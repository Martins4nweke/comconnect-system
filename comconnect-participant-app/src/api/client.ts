import { getSessionToken } from "../storage/localStore";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_COMCONNECT_API_BASE_URL ||
  "http://192.168.8.201:3000";

function buildUrl(path: string) {
  const cleanBase = API_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${cleanBase}${cleanPath}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = await getSessionToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const url = buildUrl(path);

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Network request failed. Could not reach ComConnect at ${API_BASE_URL}. Make sure the backend is running and the phone is on the same Wi-Fi.`
    );
  }

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.ok) {
    throw new Error(json?.error || `Request failed: ${response.status}`);
  }

  return json.data as T;
}