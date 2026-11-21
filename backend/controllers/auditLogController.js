
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";

// GET /api/audit-logs
// Admin only
export const getAuditLogs = async (req, res) => {
  try {
    const {
      action,
      username,
      startDate,
      endDate,
    } = req.query;

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const filter = {};

    // Filter by action
    const allowedActions = [
      "USER_CREATED",
      "USER_ACTIVATED",
      "USER_DEACTIVATED",
      "USER_ROLE_CHANGED",
      "USER_PASSWORD_RESET",
      "LOAN_SETTINGS_UPDATED",
      "GOLD_ITEM_CREATED",
"GOLD_ITEM_UPDATED",
"PAWN_LOAN_CREATED",
"PAWN_LOAN_ACTIVATED",
    ];

    if (action !== undefined) {
      if (
        typeof action !== "string" ||
        !allowedActions.includes(action)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid audit action",
        });
      }

      filter.action = action;
    }

    // Filter by username
    if (username !== undefined) {
      if (
        typeof username !== "string" ||
        !/^[a-zA-Z0-9._-]{3,30}$/.test(username)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid username",
        });
      }

      const user = await User.findOne({
        username: username.toLowerCase(),
      }).select("_id");

      if (!user) {
        return res.status(200).json({
          success: true,
          total: 0,
          page,
          limit,
          totalPages: 0,
          logs: [],
        });
      }

      filter.actor = user._id;
    }

    // Filter by UTC date range
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    const parseDate = (value) => {
      if (
        typeof value !== "string" ||
        !datePattern.test(value)
      ) {
        return null;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      ) {
        return null;
      }

      return date;
    };

    const start = startDate
      ? parseDate(startDate)
      : null;

    const end = endDate
      ? parseDate(endDate)
      : null;

    if (
      (startDate !== undefined && !start) ||
      (endDate !== undefined && !end)
    ) {
      return res.status(400).json({
        success: false,
        message: "Dates must use YYYY-MM-DD format",
      });
    }

    if (start && end && start > end) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date",
      });
    }

    if (start || end) {
      filter.createdAt = {};

      if (start) {
        filter.createdAt.$gte = start;
      }

      if (end) {
        const exclusiveEnd = new Date(end);
        exclusiveEnd.setUTCDate(
          exclusiveEnd.getUTCDate() + 1
        );

        filter.createdAt.$lt = exclusiveEnd;
      }
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actor", "username role")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs,
    });
  } catch (error) {
    console.error("Get Audit Logs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
};
