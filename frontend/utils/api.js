
const API_URL = "http://localhost:5000";

export async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem("sigiri_token");

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}
