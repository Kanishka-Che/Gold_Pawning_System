
export function validateNewPassword(password) {
  if (typeof password !== "string") {
    return "Password is required";
  }

  if (password.length < 12) {
    return "Password must contain at least 12 characters";
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return "Password must not exceed 72 UTF-8 bytes";
  }

  if (!password.trim()) {
    return "Password cannot contain only whitespace";
  }

  return null;
}
