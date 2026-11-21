
const API_URL = "http://localhost:5000";

export async function apiFetch(path, options = {}) {
  return fetch(API_URL + path, {
    ...options,
    credentials: "include",
    headers: new Headers(options.headers || {}),
  });
}
