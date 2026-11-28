export const API_URL =
  "http://localhost:5000";

export async function apiFetch(
  path,
  options = {}
) {
  const headers = new Headers(
    options.headers || {}
  );

  if (
    options.body != null &&
    typeof options.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  return fetch(API_URL + path, {
    ...options,
    credentials: "include",
    headers,
  });
}