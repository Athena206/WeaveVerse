const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";
const API_ORIGIN = new URL(API_BASE, "http://127.0.0.1").origin;

export function uploadUrl(filename) {
  return `${API_ORIGIN}/uploads/${filename}`;
}

export async function apiRequest(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot reach the store API. Start Flask after configuring MySQL.",
    );
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `The request failed (${response.status}).`);
  }
  return body;
}
