
import mongoose from "mongoose";
import SystemSettings from "../models/SystemSettings.js";
import { createAuditLog } from "../utils/auditLogger.js";


const allowedFields = {
  shop: [
    "name",
    "address",
    "contactNumber",
    "email",
    "registrationNumber",
  ],

  pawnTicket: [
    "title",
    "showTicketTitle",
    "language",

    "showLogo",
    "showShopAddress",
    "showShopContact",

    "logoPosition",
    "logoSize",

    "showCustomerContact",
    "showGoldItemCode",

    "showTermsAndConditions",
    "termsAndConditions",

    "showCustomerSignature",
    "customerSignatureLabel",

    "showAuthorizedSignature",
    "authorizedSignatureLabel",
  ],

  printing: [
    "paperSize",
    "layout",
    "orientation",
    "ticketPosition",
    "marginMm",
    "fontSizePt",
    "copies",
    "showCuttingLine",
  ],
};



const enumValues = {
  "pawnTicket.language": [
    "en",
    "si",
    "both",
  ],

  "pawnTicket.logoPosition": [
    "left",
    "top",
    "right",
  ],

  "pawnTicket.logoSize": [
    "small",
    "medium",
    "large",
  ],

  "printing.paperSize": [
    "A4",
    "A5",
  ],

  "printing.layout": [
    "half_page",
    "full_page",
  ],

  "printing.orientation": [
    "portrait",
    "landscape",
  ],

  "printing.ticketPosition": [
    "top",
    "bottom",
  ],
};



const booleanFields = new Set([
  "pawnTicket.showTicketTitle",

  "pawnTicket.showLogo",
  "pawnTicket.showShopAddress",
  "pawnTicket.showShopContact",

  "pawnTicket.showCustomerContact",
  "pawnTicket.showGoldItemCode",

  "pawnTicket.showTermsAndConditions",

  "pawnTicket.showCustomerSignature",
  "pawnTicket.showAuthorizedSignature",

  "printing.showCuttingLine",
]);


const numberRules = {
  "printing.marginMm": {
    min: 5,
    max: 15,
  },

  "printing.fontSizePt": {
    min: 9,
    max: 14,
  },

  "printing.copies": {
    min: 1,
    max: 3,
  },
};

const stringRules = {
  "shop.name": 150,
  "shop.address": 500,
  "shop.contactNumber": 50,
  "shop.email": 150,
  "shop.registrationNumber": 100,

  "pawnTicket.title": 100,
  "pawnTicket.termsAndConditions": 5000,
  "pawnTicket.customerSignatureLabel": 100,
  "pawnTicket.authorizedSignatureLabel": 100,
};

const requiredStrings = new Set([
  "shop.name",
  "pawnTicket.title",
  "pawnTicket.customerSignatureLabel",
  "pawnTicket.authorizedSignatureLabel",
]);



function validateUpdates(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error("Invalid system settings data");
  }

  const updates = {};

  for (const [section, fields] of Object.entries(body)) {
    if (!Object.hasOwn(allowedFields, section)) {
      throw new Error(
        `Unknown settings section: ${section}`
      );
    }

    if (
      !fields ||
      typeof fields !== "object" ||
      Array.isArray(fields)
    ) {
      throw new Error(`Invalid section: ${section}`);
    }

    for (const [field, value] of Object.entries(fields)) {
      if (!allowedFields[section].includes(field)) {
        throw new Error(
          `Unknown setting: ${section}.${field}`
        );
      }

      const path = `${section}.${field}`;

      // Validate enum values
      if (Object.hasOwn(enumValues, path)) {
        if (!enumValues[path].includes(value)) {
          throw new Error(`Invalid value for ${path}`);
        }

        updates[path] = value;
      }

      // Validate boolean values
      else if (booleanFields.has(path)) {
        if (typeof value !== "boolean") {
          throw new Error(
            `${path} must be true or false`
          );
        }

        updates[path] = value;
      }

      // Validate numeric values
      else if (Object.hasOwn(numberRules, path)) {
        const { min, max } = numberRules[path];

        if (
          !Number.isSafeInteger(value) ||
          value < min ||
          value > max
        ) {
          throw new Error(
            `${path} must be an integer between ${min} and ${max}`
          );
        }

        updates[path] = value;
      }

      // Validate string values
      else if (Object.hasOwn(stringRules, path)) {
        if (typeof value !== "string") {
          throw new Error(`${path} must be a string`);
        }

        const trimmedValue = value.trim();

        if (
          requiredStrings.has(path) &&
          trimmedValue.length === 0
        ) {
          throw new Error(`${path} cannot be empty`);
        }

        if (trimmedValue.length > stringRules[path]) {
          throw new Error(
            `${path} exceeds maximum allowed length`
          );
        }

        if (
          path === "shop.email" &&
          trimmedValue !== "" &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
        ) {
          throw new Error("Invalid shop email address");
        }

        updates[path] = trimmedValue;
      }

      else {
        throw new Error(
          `Unsupported setting: ${path}`
        );
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No settings provided");
  }

  return updates;
}


function validateSettingsCompatibility(settings) {
  const printing = settings.printing;

  if (
    printing.paperSize === "A5" &&
    printing.layout === "half_page"
  ) {
    throw new Error(
      "A5 paper only supports full-page layout"
    );
  }

  if (
    printing.layout === "full_page" &&
    printing.ticketPosition === "bottom"
  ) {
    throw new Error(
      "Bottom position is only available for half-page layout"
    );
  }

  if (
    printing.layout === "full_page" &&
    printing.showCuttingLine
  ) {
    throw new Error(
      "Cutting line is only available for half-page layout"
    );
  }

  if (
    settings.pawnTicket.showLogo &&
    !settings.shop.logoUrl
  ) {
    throw new Error(
      "A shop logo is required before enabling logo display"
    );
  }
}



// GET /api/system-settings
export const getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne({
  settingsKey: "default",
});

    // Return default settings if not configured
    if (!settings) {
      const defaultSettings = new SystemSettings({
        settingsKey: "default",
      });

      return res.status(200).json({
        success: true,
        configured: false,
       settings: {
  shop: defaultSettings.shop,
  pawnTicket: defaultSettings.pawnTicket,
  printing: defaultSettings.printing,
  version: 0,
},
      });
    }

    return res.status(200).json({
      success: true,
      configured: true,
      settings,
    });
  } catch (error) {
    console.error("Get System Settings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load system settings",
    });
  }
};



// PUT /api/system-settings
export const updateSystemSettings = async (req, res) => {
  let updates;
  let expectedVersion;

  // Validate request
  try {
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      throw new Error("Invalid system settings data");
    }

    const {
      expectedVersion: requestedVersion,
      ...settingsBody
    } = req.body;

    if (
  !Number.isSafeInteger(requestedVersion) ||
  requestedVersion < 0
) {
  throw new Error(
    "A valid expectedVersion is required"
  );
}

    expectedVersion = requestedVersion;
    updates = validateUpdates(settingsBody);

  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  const session = await mongoose.startSession();

  let updatedSettings;

  try {
    await session.withTransaction(async () => {
      // Load current settings
      let currentSettings =
        await SystemSettings.findOne({
          settingsKey: "default",
        }).session(session);

      const isNewSettings = !currentSettings;

      // Prepare default settings if missing
      if (isNewSettings) {
        currentSettings = new SystemSettings({
          settingsKey: "default",
        });
      }

      const previousVersion = isNewSettings
  ? 0
  : currentSettings.version;

      // Prevent overwriting newer settings
      if (previousVersion !== expectedVersion) {
        const error = new Error(
          "Settings have changed. Reload before saving."
        );

        error.statusCode = 409;
        throw error;
      }

      const changes = {};
      const actualUpdates = {};

      // Detect actual changes
      for (const [path, newValue] of Object.entries(
        updates
      )) {
        const oldValue = currentSettings.get(path);

        if (!Object.is(oldValue, newValue)) {
          changes[path] = {
            old: oldValue ?? null,
            new: newValue,
          };

          actualUpdates[path] = newValue;
        }

        currentSettings.set(path, newValue);
      }

      // Validate combined settings
      try {
        validateSettingsCompatibility(currentSettings);

        await currentSettings.validate();

      } catch (error) {
        error.statusCode = 400;
        throw error;
      }

      // Create first settings record
      if (isNewSettings) {
        currentSettings.updatedBy = req.user._id;

        updatedSettings = await currentSettings.save({
          session,
        });

        await createAuditLog({
          req,
          action: "SYSTEM_SETTINGS_CREATED",
          targetType: "SystemSettings",
          targetId: updatedSettings._id,
          details: {
            version: updatedSettings.version,
            changes,
          },
          session,
        });

        return;
      }

      // Avoid unnecessary version increments
      if (Object.keys(actualUpdates).length === 0) {
        updatedSettings = currentSettings;
        return;
      }

      // Update with optimistic version protection
      updatedSettings =
        await SystemSettings.findOneAndUpdate(
          {
            _id: currentSettings._id,
            version: previousVersion,
          },
          {
            $set: {
              ...actualUpdates,
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
          "Settings were modified concurrently. Reload and try again."
        );

        error.statusCode = 409;
        throw error;
      }

      // Save audit log in the same transaction
      await createAuditLog({
        req,
        action: "SYSTEM_SETTINGS_UPDATED",
        targetType: "SystemSettings",
        targetId: updatedSettings._id,

        details: {
          previousVersion,
          newVersion: updatedSettings.version,
          changes,
        },

        session,
      });
    });

    return res.status(200).json({
      success: true,
      configured: true,
      message: "System settings saved successfully",
      settings: updatedSettings,
    });

  } catch (error) {
    console.error(
      "Update System Settings Error:",
      error
    );

    if (
      error.statusCode === 400 ||
      error.name === "ValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

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
      message: "Failed to save system settings",
    });

  } finally {
    await session.endSession();
  }
};


// GET /api/system-settings/printing
export const getPrintingSettings = async (req, res) => {
  try {
   const savedSettings = await SystemSettings.findOne({
  settingsKey: "default",
})
  .select("shop pawnTicket printing version -_id");

    const settings =
      savedSettings ||
      new SystemSettings({
        settingsKey: "default",
      });

    return res.status(200).json({
      success: true,
      configured: Boolean(savedSettings),

      settings: {
        shop: settings.shop,
        pawnTicket: settings.pawnTicket,
        printing: settings.printing,
       version: savedSettings ? settings.version : 0,
      },
    });

  } catch (error) {
    console.error(
      "Get Printing Settings Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load printing settings",
    });
  }
};
