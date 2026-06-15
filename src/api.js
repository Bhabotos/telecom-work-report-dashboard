const API_ORIGIN = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API = `${API_ORIGIN}/api`;

async function request(path, options) {
  try {
    return await fetch(`${API}${path}`, options);
  } catch {
    throw new Error("Cannot connect to the API server. Start the application server and try again.");
  }
}

export function token() {
  return localStorage.getItem("telecom_token");
}

export async function api(path, options = {}) {
  const response = await request(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return response.json();
}

export function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  return params.toString();
}

export async function download(path, filename) {
  const response = await request(path, {
    headers: { Authorization: `Bearer ${token()}` }
  });
  if (!response.ok) throw new Error("Export failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
