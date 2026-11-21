
import LoanSettings from "../models/LoanSettings.js";
import mongoose from "mongoose";
import { createAuditLog } from "../utils/auditLogger.js";

// Allowed settings and their supported values
const allowedFields = {
  interest: [
    "rate",
    "calculationMethod",
    "minimumInterestDays",
    "chargeFullFirstMonth",
  ],
  loan: ["defaultDurationMonths", "maximumLoanAmount"],
  partialPayment: [
  "enabled",
  "allowPartialInterest",
  "allowPartialPrincipal",
  "allocationMethod",
  "minimumAmount",
],
  renewal: [
    "enabled",
    "durationMonths",
    "requireInterestSettlement",
    "renewalFee",
  ],
  overdue: [
    "gracePeriodDays",
    "penaltyEnabled",
    "penaltyRate",
  ],
};

const enumValues = {
  "interest.calculationMethod": ["monthly", "daily"],
  "partialPayment.allocationMethod": [
    "interest_first",
    "principal_first",
  ],
};


const booleanFields = new Set([
  "interest.chargeFullFirstMonth",

  "partialPayment.enabled",
  "partialPayment.allowPartialInterest",
  "partialPayment.allowPartialPrincipal",

  "renewal.enabled",
  "renewal.requireInterestSettlement",

  "overdue.penaltyEnabled",
]);


const integerFields = new Set([
  "interest.minimumInterestDays",
  "loan.defaultDurationMonths",
  "renewal.durationMonths",
  "overdue.gracePeriodDays",
]);

const positiveFields = new Set([
  "loan.defaultDurationMonths",
  "renewal.durationMonths",
]);

function validateUpdates(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error("Invalid settings data");
  }

  const updates = {};

  for (const [section, fields] of Object.entries(body)) {
    if (!Object.hasOwn(allowedFields, section)) {
      throw new Error(`Unknown settings section: ${section}`);
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
        throw new Error(`Unknown setting: ${section}.${field}`);
      }

      const path = `${section}.${field}`;

      if (Object.hasOwn(enumValues, path)) {
        if (!enumValues[path].includes(value)) {
          throw new Error(`Invalid value for ${path}`);
        }
      } else if (booleanFields.has(path)) {
        if (typeof value !== "boolean") {
          throw new Error(`${path} must be true or false`);
        }
      } else {
        const nullable = path === "loan.maximumLoanAmount";

        if (value === null && nullable) {
          updates[path] = null;
          continue;
        }

        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0
        ) {
          throw new Error(
            `${path} must be a non-negative number`
          );
        }

        if (
          integerFields.has(path) &&
          !Number.isInteger(value)
        ) {
          throw new Error(`${path} must be an integer`);
        }

        if (positiveFields.has(path) && value < 1) {
          throw new Error(`${path} must be at least 1`);
        }
      }

      updates[path] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No settings provided");
  }

  return updates;
}

// GET /api/loan-settings
export const getLoanSettings = async (req, res) => {
  try {
    const settings = await LoanSettings.findOne({
      settingsKey: "default",
    });

    return res.json({
      success: true,
      settings,
      configured: Boolean(settings),
    });
  } catch (error) {
    console.error("Get Loan Settings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load loan settings",
    });
  }
};

// PUT /api/loan-settings
export const updateLoanSettings = async (req, res) => {
  let updates;

  try {
    updates = validateUpdates(req.body);
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
      // Read current settings inside transaction
      let currentSettings = await LoanSettings.findOne({
        settingsKey: "default",
      }).session(session);

      // Create default settings if missing
      if (!currentSettings) {
        const created = await LoanSettings.create(
          [{ settingsKey: "default" }],
          { session }
        );

        currentSettings = created[0];
      }

      const previousVersion = currentSettings.version;

      const changes = {};
      const actualUpdates = {};

      // Detect actual field changes
      for (const [path, newValue] of Object.entries(updates)) {
        const oldValue = currentSettings.get(path);

        if (!Object.is(oldValue, newValue)) {
          changes[path] = {
            old: oldValue ?? null,
            new: newValue,
          };

          actualUpdates[path] = newValue;
        }
      }

      // No actual changes
      if (Object.keys(actualUpdates).length === 0) {
        updatedSettings = currentSettings;
        return;
      }

      // Optimistic version check
      updatedSettings = await LoanSettings.findOneAndUpdate(
        {
          _id: currentSettings._id,
          version: previousVersion,
        },
        {
          $set: actualUpdates,
          $inc: { version: 1 },
        },
        {
  returnDocument: "after",
  runValidators: true,
  session,
}
      );

      if (!updatedSettings) {
        const error = new Error(
          "Settings were modified by another request. Please reload and try again."
        );
        error.statusCode = 409;
        throw error;
      }

      // Save audit log in same transaction
      await createAuditLog({
        req,
        action: "LOAN_SETTINGS_UPDATED",
        targetType: "LoanSettings",
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
      message: "Loan settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Update Loan Settings Error:", error);

    if (
      error.statusCode === 409 ||
      error.code === 11000 ||
      error.code === 112 ||
      error.hasErrorLabel?.("TransientTransactionError")
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Loan settings were modified concurrently. Please reload and try again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update loan settings",
    });
  } finally {
    await session.endSession();
  }
};
