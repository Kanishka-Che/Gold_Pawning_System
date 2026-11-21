
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import mongoose from "mongoose";
import Session from "../models/Session.js";
import { createAuditLog } from "../utils/auditLogger.js";

// POST /api/users
// Admin only - enforced in userRoutes.js
export const createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body || {};

    // Validate username
    if (
      typeof username !== "string" ||
      !/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username must be 3-30 characters (letters, numbers, . _ -)",
      });
    }

    // Validate password
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 12 characters and at most 72 UTF-8 bytes",
      });
    }

    // Validate role
    if (!["admin", "staff"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be admin or staff",
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

    // Prevent duplicate usernames
    const existingUser = await User.findOne({
      username: normalizedUsername,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Securely hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    
const session = await mongoose.startSession();

let user;

try {
  await session.withTransaction(async () => {
    const createdUsers = await User.create(
      [
        {
          username: normalizedUsername,
          password: hashedPassword,
          role,
          isActive: true,
        },
      ],
      { session }
    );

    user = createdUsers[0];

    await createAuditLog({
      req,
      action: "USER_CREATED",
      targetType: "User",
      targetId: user._id,
      details: {
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      },
      session,
    });
  });
} finally {
  await session.endSession();
}


    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Create User Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};


/**
 * GET /api/users
 * Admin only
 * Get all users without passwords
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("_id username role isActive createdAt updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};


/**
 * PATCH /api/users/:id/status
 * Admin only
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    // Validate user ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Validate status
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent self-deactivation
    if (
      !isActive &&
      String(user._id) === String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    // Prevent deactivating the last active admin
    if (
      !isActive &&
      user.role === "admin" &&
      user.isActive
    ) {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        isActive: true,
      });

      if (activeAdminCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "Cannot deactivate the last active admin",
        });
      }
    }

    // No change needed
    if (user.isActive === isActive) {
      return res.status(200).json({
        success: true,
        message: "User status is already up to date",
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
        },
      });
    }

    
const previousStatus = user.isActive;

const session = await mongoose.startSession();

try {
  await session.withTransaction(async () => {
    user.isActive = isActive;

    await user.save({ session });

    // Revoke active sessions when deactivating
    if (!isActive) {
      await Session.updateMany(
        {
          userId: user._id,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
          },
        },
        { session }
      );
    }

    // Save audit log
    await createAuditLog({
      req,
      action: isActive
        ? "USER_ACTIVATED"
        : "USER_DEACTIVATED",
      targetType: "User",
      targetId: user._id,
      details: {
        username: user.username,
        previousStatus,
        newStatus: isActive,
      },
      session,
    });
  });
} finally {
  await session.endSession();
}


    return res.status(200).json({
      success: true,
      message: isActive
        ? "User activated successfully"
        : "User deactivated successfully",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Update User Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};


/**
 * PATCH /api/users/:id/reset-password
 * Admin only
 */
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 12 ||
      Buffer.byteLength(newPassword, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 12 characters and at most 72 UTF-8 bytes",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Self password changes will use a separate endpoint
    if (String(user._id) === String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Use the change-password endpoint for your own account",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    
const session = await mongoose.startSession();

try {
  await session.withTransaction(async () => {
    // Update password
    const result = await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
        },
      },
      { session }
    );

    if (result.matchedCount !== 1) {
      throw new Error("User not found during password reset");
    }

    // Revoke all existing login sessions
    await Session.updateMany(
      {
        userId: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      },
      { session }
    );

    // Create audit log
    await createAuditLog({
      req,
      action: "USER_PASSWORD_RESET",
      targetType: "User",
      targetId: user._id,
      details: {
        username: user.username,
        resetBy: req.user.username,
        sessionsRevoked: true,
      },
      session,
    });
  });
} finally {
  await session.endSession();
}


    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Existing sessions revoked.",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Reset Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};


/**
 * PATCH /api/users/:id/role
 * Admin only
 */
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (!["admin", "staff"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be admin or staff",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (String(user._id) === String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    if (user.role === role) {
      return res.status(200).json({
        success: true,
        message: "User already has this role",
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
        },
      });
    }

    // Protect the last active admin
    if (
      user.role === "admin" &&
      role === "staff" &&
      user.isActive
    ) {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        isActive: true,
      });

      if (activeAdminCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "Cannot demote the last active admin",
        });
      }
    }

 
const previousRole = user.role;

const session = await mongoose.startSession();

try {
  await session.withTransaction(async () => {
    // Update user role
    user.role = role;
    await user.save({ session });

    // Revoke all existing sessions
    await Session.updateMany(
      {
        userId: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      },
      { session }
    );

    // Save audit log
    await createAuditLog({
      req,
      action: "USER_ROLE_CHANGED",
      targetType: "User",
      targetId: user._id,
      details: {
        username: user.username,
        previousRole,
        newRole: role,
      },
      session,
    });
  });
} finally {
  await session.endSession();
}


    return res.status(200).json({
      success: true,
      message: "User role updated successfully",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Update User Role Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
};
