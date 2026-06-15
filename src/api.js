const API_MAP = [
  { test: (p) => p.startsWith("/auth/login"), to: () => "/auth/login" },
  { test: (p) => p.startsWith("/meta"), to: () => "/api/mock?route=meta" },
  { test: (p) => p.startsWith("/dashboard"), to: () => "/api/mock?route=dashboard" },
  { test: (p) => p.startsWith("/reports/daily/"), to: () => "/api/mock?route=reports-daily" },
  { test: (p) => p.startsWith("/reports/monthly/"), to: () => "/api/mock?route=reports-monthly" },
  { test: (p) => p.startsWith("/reports"), to: () => "/api/mock?route=reports" },
  { test: (p) => p.startsWith("/users"), to: () => "/api/mock?route=users" },
  { test: (p) => p.startsWith("/master"), to: () => "/api/mock?route=master" },
  { test: (p) => p.startsWith("/export"), to: () => "/api/mock?route=export" }
];

function resolveApiPath(path) {
  const match = API_MAP.find((item) => item.test(path));
  return match ? match.to(path) : path;
}

export function token() {
  return localStorage.getItem("telecom_token");
}

export function queryString(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  return search.toString();
}

export async function api(path, options = {}) {
  const url = resolveApiPath(path);

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const savedToken = token();

  if (savedToken) {
    headers.Authorization = `Bearer ${savedToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`API did not return JSON. URL: ${url}. Response: ${text.slice(0, 80)}`);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export async function download(path, filename) {
  const url = resolveApiPath(path);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token() || ""}`
    }
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(objectUrl);
}