
import AuditLog from "../models/AuditLog.js";

/**
 * Save a security audit log.
 *
 * Do not include passwords, tokens,
 * cookies, or other secrets in details.
 */
export const createAuditLog = async ({
  req,
  action,
  targetType,
  targetId,
  details = {},
  session = null,
}) => {
  if (!req?.user?._id) {
    throw new Error("Audit log actor is required");
  }

  const auditData = {
    actor: req.user._id,
    action,
    targetType,
    targetId,
    details,
    ipAddress: req.ip || null,
    userAgent: req.get("user-agent") || null,
  };

  const options = session ? { session } : {};

  const logs = await AuditLog.create(
    [auditData],
    options
  );

  return logs[0];
};
