
import { apiFetch } from "./api.js";

async function userRequest(path, options = {}) {
  const response = await apiFetch(
    `/api/users${path}`,
    options
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid server response");
  }

  if (!response.ok || !data.success) {
    const error = new Error(
      data.message || "User request failed"
    );

    error.status = response.status;

    throw error;
  }

  return data;
}

export function getUsers() {
  return userRequest("");
}

export function createUser(userData) {
  return userRequest("", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export function updateUserStatus(id, isActive) {
  return userRequest(
    `/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }
  );
}

export function updateUserRole(id, role) {
  return userRequest(
    `/${encodeURIComponent(id)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }
  );
}

export function resetUserPassword(id, newPassword) {
  return userRequest(
    `/${encodeURIComponent(id)}/reset-password`,
    {
      method: "PATCH",
      body: JSON.stringify({ newPassword }),
    }
  );
}
