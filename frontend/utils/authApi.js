import { apiFetch } from "./api.js";

async function authRequest(
  path,
  options = {}
) {
  const response = await apiFetch(
    `/api/auth${path}`,
    options
  );

  let data;

  try {
    data = await response.json();
  } catch {
    const error = new Error(
      "Invalid server response"
    );

    error.status = response.status;
    throw error;
  }

  if (!response.ok || !data?.success) {
    const error = new Error(
      data?.message ||
        "Authentication request failed"
    );

    error.status = response.status;

    throw error;
  }

  return data;
}

export function getMyProfile() {
  return authRequest("/me");
}

export function changeMyPassword(
  passwordData
) {
  return authRequest("/change-password", {
    method: "PATCH",

    body: JSON.stringify(passwordData),
  });
}

export function updateMyProfileImage(file) {
  const formData = new FormData();

  formData.append("profileImage", file);

  return authRequest("/profile-image", {
    method: "POST",
    body: formData,
  });
}

export function removeMyProfileImage() {
  return authRequest("/profile-image", {
    method: "DELETE",
  });
}