import mongoose from "mongoose";
import path from "node:path";

import User from "../models/User.js";
import Session from "../models/Session.js";

import {
  createAuditLog,
} from "../utils/auditLogger.js";

import {
  saveProfileImage,
  deleteProfileImage,
  isValidProfileFileName,
  ProfileImageValidationError,
  PROFILE_DIRECTORY,
} from "../services/profileImageStorageService.js";

function accountResponse(user) {
  return {
    id: user._id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    profileImage: user.profileImage || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getActiveAccount(req, session) {
  const activeSession = await Session.findOne({
    userId: req.user._id,
    sessionId: req.sessionId,
    revokedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
  }).session(session);

  if (!activeSession) {
    throw requestError(
      "Session expired. Please login again.",
      401
    );
  }

  const user = await User.findOne({
    _id: req.user._id,
    isActive: true,
  }).session(session);

  if (!user) {
    throw requestError(
      "Account is unavailable.",
      401
    );
  }

  return user;
}

// POST /api/auth/profile-image

export const updateOwnProfileImage = async (
  req,
  res
) => {
  let session;
  let savedImage;
  let previousImage;
  let updatedUser;
  let committed = false;

  try {
    savedImage = await saveProfileImage(
      req.file.buffer
    );

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const user = await getActiveAccount(
        req,
        session
      );

      previousImage =
        user.profileImage || null;

      user.profileImage = savedImage.fileName;

      updatedUser = await user.save({
        session,
      });

      await createAuditLog({
        req,
        action: "USER_PROFILE_IMAGE_UPDATED",
        targetType: "User",
        targetId: user._id,

        details: {
          username: user.username,
          replacedExistingImage:
            Boolean(previousImage),
        },

        session,
      });
    });

    committed = true;

    if (
      previousImage &&
      previousImage !== savedImage.fileName
    ) {
      await deleteProfileImage(previousImage);
    }

    return res.status(200).json({
      success: true,
      message:
        "Profile image updated successfully.",
      user: accountResponse(updatedUser),
    });

  } catch (error) {
    if (
      savedImage &&
      !committed &&
      !error.hasErrorLabel?.(
        "UnknownTransactionCommitResult"
      )
    ) {
      await deleteProfileImage(
        savedImage.fileName
      );
    }

    if (
      error instanceof ProfileImageValidationError
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.statusCode === 401) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Update Profile Image Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update profile image.",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// DELETE /api/auth/profile-image

export const removeOwnProfileImage = async (
  req,
  res
) => {
  let session;
  let previousImage;
  let updatedUser;

  try {
    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const user = await getActiveAccount(
        req,
        session
      );

      previousImage =
        user.profileImage || null;

      if (!previousImage) {
        updatedUser = user;
        return;
      }

      user.profileImage = null;

      updatedUser = await user.save({
        session,
      });

      await createAuditLog({
        req,
        action: "USER_PROFILE_IMAGE_REMOVED",
        targetType: "User",
        targetId: user._id,

        details: {
          username: user.username,
        },

        session,
      });
    });

    if (previousImage) {
      await deleteProfileImage(previousImage);
    }

    return res.status(200).json({
      success: true,
      message: previousImage
        ? "Profile image removed successfully."
        : "No profile image to remove.",

      user: accountResponse(updatedUser),
    });

  } catch (error) {
    if (error.statusCode === 401) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Remove Profile Image Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,
      message: "Failed to remove profile image.",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// GET /api/auth/profile-images/:fileName

export const getProfileImage = async (
  req,
  res
) => {
  try {
    const { fileName } = req.params;

    if (!isValidProfileFileName(fileName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile image.",
      });
    }

    const filter = {
      profileImage: fileName,
    };

    // Staff can only access their own image.
    // Admin can view images in User Management.

    if (req.user.role !== "admin") {
      filter._id = req.user._id;
    }

    const owner = await User.exists(filter);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Profile image not found.",
      });
    }

    res.setHeader(
      "Cache-Control",
      "private, no-store"
    );

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.type("image/webp");

    return res.sendFile(
      path.join(
        PROFILE_DIRECTORY,
        fileName
      ),
      {
        dotfiles: "deny",
        cacheControl: false,
      },
      (error) => {
        if (!error) return;

        if (res.headersSent) {
          return res.end();
        }

        const status =
          error.code === "ENOENT" ||
          error.status === 404
            ? 404
            : 500;

        res.status(status).json({
          success: false,
          message:
            status === 404
              ? "Profile image not found."
              : "Failed to load profile image.",
        });
      }
    );

  } catch (error) {
    console.error(
      "Get Profile Image Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load profile image.",
    });
  }
};