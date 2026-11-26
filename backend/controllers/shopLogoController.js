import mongoose from "mongoose";
import { unlink } from "node:fs/promises";
import path from "node:path";
import SystemSettings from "../models/SystemSettings.js";

import {
  saveShopLogo,
  LogoValidationError,
  LOGO_DIRECTORY,
} from "../services/logoStorageService.js";

import {
  createAuditLog,
} from "../utils/auditLogger.js";


// POST /api/system-settings/logo
export const uploadLogo = async (req, res) => {
  let session;
  let savedLogo;
  let updatedSettings;
  let transactionCommitted = false;

  const rawVersion = req.body?.expectedVersion;

  // Validate expected version
  if (
    typeof rawVersion !== "string" ||
    !/^\d+$/.test(rawVersion) ||
    !Number.isSafeInteger(Number(rawVersion))
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid expectedVersion is required.",
    });
  }

  const expectedVersion = Number(rawVersion);

  if (!req.file?.buffer) {
    return res.status(400).json({
      success: false,
      message: "Logo image is required.",
    });
  }

  try {
    // Check current settings before processing image
    const existingSettings =
      await SystemSettings.findOne({
        settingsKey: "default",
      }).lean();

    const currentVersion =
      existingSettings?.version ?? 0;

    if (currentVersion !== expectedVersion) {
      return res.status(409).json({
        success: false,
        message:
          "Settings have changed. Reload before uploading.",
      });
    }

    // Validate, process and save image
    savedLogo = await saveShopLogo(
      req.file.buffer
    );

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      let settings =
        await SystemSettings.findOne({
          settingsKey: "default",
        }).session(session);

      const isNewSettings = !settings;

      const previousVersion =
        settings?.version ?? 0;

      // Recheck version inside transaction
      if (previousVersion !== expectedVersion) {
        const error = new Error(
          "Settings have changed. Reload before uploading."
        );

        error.statusCode = 409;
        throw error;
      }

      if (isNewSettings) {
        settings = new SystemSettings({
          settingsKey: "default",
        });
      }

      const previousLogo =
        settings.shop.logoUrl || "";

      const changes = {
        "shop.logoUrl": {
          old: previousLogo,
          new: savedLogo.logoUrl,
        },
      };

      if (!settings.pawnTicket.showLogo) {
  changes["pawnTicket.showLogo"] = {
    old: false,
    new: true,
  };
}

      // Create initial settings if necessary
      if (isNewSettings) {
        settings.shop.logoUrl =
          savedLogo.logoUrl;

          settings.pawnTicket.showLogo = true;

        settings.updatedBy = req.user._id;

        updatedSettings = await settings.save({
          session,
        });
      } else {
        updatedSettings =
          await SystemSettings.findOneAndUpdate(
            {
              _id: settings._id,
              version: previousVersion,
            },
            {
              $set: {
  "shop.logoUrl": savedLogo.logoUrl,
  "pawnTicket.showLogo": true,
  updatedBy: req.user._id,
},

              $inc: {
                version: 1,
              },
            },
            {
              returnDocument: "after",
              runValidators: true,
              session,
            }
          );

        if (!updatedSettings) {
          const error = new Error(
            "Settings were modified concurrently."
          );

          error.statusCode = 409;
          throw error;
        }
      }

      // Save audit log in same transaction
      await createAuditLog({
        req,

        action: isNewSettings
          ? "SYSTEM_SETTINGS_CREATED"
          : "SYSTEM_SETTINGS_UPDATED",

        targetType: "SystemSettings",
        targetId: updatedSettings._id,

        details: {
          operation: "SHOP_LOGO_UPLOADED",
          previousVersion,
          newVersion: updatedSettings.version,
          changes,
        },

        session,
      });
    });

    transactionCommitted = true;

    return res.status(200).json({
      success: true,
      configured: true,
      message: "Shop logo uploaded successfully.",
      settings: updatedSettings,
    });

    } catch (error) {
    console.error("Upload Shop Logo Error:", error);

    // Remove newly created file if update failed.
    // Keep it if transaction commit outcome is uncertain.
    if (
      savedLogo &&
      !transactionCommitted &&
      !error.hasErrorLabel?.(
        "UnknownTransactionCommitResult"
      )
    ) {
      try {
        await unlink(savedLogo.filePath);
      } catch (cleanupError) {
        console.error(
          "Logo Cleanup Error:",
          cleanupError
        );
      }
    }

    // Invalid image validation errors
    if (error instanceof LogoValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Settings version conflict errors
    if (
      error.statusCode === 409 ||
      error.code === 11000 ||
      error.code === 112 ||
      error.hasErrorLabel?.(
        "TransientTransactionError"
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Settings were modified concurrently. Please reload and try again.",
      });
    }

    // Unexpected server errors
    return res.status(500).json({
      success: false,
      message: "Failed to upload shop logo.",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// GET /api/system-settings/logos/:fileName
export const getShopLogo = async (req, res) => {
  const { fileName } = req.params;

  // Only allow generated logo filenames
  const validFileName =
    /^logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

  if (
    typeof fileName !== "string" ||
    !validFileName.test(fileName)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid logo filename.",
    });
  }

  const filePath = path.join(
    LOGO_DIRECTORY,
    fileName
  );

  res.setHeader(
    "Cache-Control",
    "private, no-store"
  );

  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  return res.sendFile(
    filePath,
    {
      dotfiles: "deny",
      cacheControl: false,
    },
    (error) => {
      if (!error) {
        return;
      }

      if (res.headersSent) {
        return res.end();
      }

      if (
        error.code === "ENOENT" ||
        error.status === 404
      ) {
        return res.status(404).json({
          success: false,
          message: "Shop logo not found.",
        });
      }

      console.error(
        "Get Shop Logo Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load shop logo.",
      });
    }
  );
};

// DELETE /api/system-settings/logo
export const removeLogo = async (req, res) => {
  let session;
  let updatedSettings;
  let configured = false;
  let logoRemoved = false;

  const expectedVersion = req.body?.expectedVersion;

  // Validate expected version
  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid expectedVersion is required.",
    });
  }

  try {
    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      logoRemoved = false;

      const settings =
        await SystemSettings.findOne({
          settingsKey: "default",
        }).session(session);

      const previousVersion =
        settings?.version ?? 0;

      configured = Boolean(settings);

      // Prevent concurrent settings updates
      if (previousVersion !== expectedVersion) {
        const error = new Error(
          "Settings have changed. Reload before removing the logo."
        );

        error.statusCode = 409;
        throw error;
      }

      // Settings not configured yet
      if (!settings) {
        const defaultSettings = new SystemSettings({
          settingsKey: "default",
        });

        updatedSettings = {
          shop: defaultSettings.shop,
          pawnTicket: defaultSettings.pawnTicket,
          printing: defaultSettings.printing,
          version: 0,
        };

        return;
      }

      const previousLogo =
        settings.shop.logoUrl || "";

      const previousShowLogo =
        settings.pawnTicket.showLogo;

      // Nothing to remove
      if (!previousLogo && !previousShowLogo) {
        updatedSettings = settings;
        return;
      }

      const changes = {};

      if (previousLogo) {
        changes["shop.logoUrl"] = {
          old: previousLogo,
          new: "",
        };
      }

      if (previousShowLogo) {
        changes["pawnTicket.showLogo"] = {
          old: true,
          new: false,
        };
      }

      // Remove logo reference and disable display
      updatedSettings =
        await SystemSettings.findOneAndUpdate(
          {
            _id: settings._id,
            version: previousVersion,
          },
          {
            $set: {
              "shop.logoUrl": "",
              "pawnTicket.showLogo": false,
              updatedBy: req.user._id,
            },

            $inc: {
              version: 1,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

      if (!updatedSettings) {
        const error = new Error(
          "Settings were modified concurrently."
        );

        error.statusCode = 409;
        throw error;
      }

      // Save audit log in same transaction
      await createAuditLog({
        req,

        action: "SYSTEM_SETTINGS_UPDATED",

        targetType: "SystemSettings",
        targetId: updatedSettings._id,

        details: {
          operation: "SHOP_LOGO_REMOVED",
          previousVersion,
          newVersion: updatedSettings.version,
          changes,
        },

        session,
      });

      logoRemoved = true;
    });

    return res.status(200).json({
      success: true,
      configured,
      message: logoRemoved
        ? "Shop logo removed successfully."
        : "No shop logo to remove.",
      settings: updatedSettings,
    });

  } catch (error) {
    console.error("Remove Shop Logo Error:", error);

    if (
      error.statusCode === 409 ||
      error.code === 11000 ||
      error.code === 112 ||
      error.hasErrorLabel?.(
        "TransientTransactionError"
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Settings were modified concurrently. Please reload and try again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to remove shop logo.",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};