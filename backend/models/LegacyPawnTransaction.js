import mongoose from "mongoose";
import { isValidMoney } from "../utils/moneyValidator.js";

const { Schema } = mongoose;

const moneyField = () => ({
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: (value) =>
      isValidMoney(value, { allowZero: true }),
    message: "Invalid monetary amount",
  },
});

const legacyPawnTransactionSchema = new Schema(
  {
    pawnLoan: {
      type: Schema.Types.ObjectId,
      ref: "PawnLoan",
      required: true,
      immutable: true,
    },

    transactionType: {
      type: String,
      enum: ["payment", "renewal"],
      required: true,
      immutable: true,
    },

    // Original historical transaction date
    transactionDate: {
      type: Date,
      required: true,
    },

    // Original order in the historical records
    sequenceNumber: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },

    // Duplicate request protection
    idempotencyKey: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 16,
      maxlength: 100,
      match: /^[A-Za-z0-9_-]+$/,
    },

    // Original receipt or book reference
    historicalReference: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "unknown"],
      default: undefined,
    },

    amount: moneyField(),

    principalPaid: moneyField(),

    interestPaid: moneyField(),

    renewalFeePaid: moneyField(),

    previousMaturityDate: {
      type: Date,
      default: undefined,
    },

    newMaturityDate: {
      type: Date,
      default: undefined,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    importedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    importedAt: {
      type: Date,
      required: true,
      immutable: true,
      default: Date.now,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },

    // Soft removal before migration verification
    status: {
      type: String,
      enum: ["pending", "verified", "voided"],
      default: "pending",
      required: true,
    },

    verifiedAt: {
      type: Date,
      default: undefined,
    },

    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },

    voidedAt: {
      type: Date,
      default: undefined,
    },

    voidedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },

    voidReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

const toCents = (amount) => {
  const [whole, fraction = ""] =
    String(amount).split(".");

  return (
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"))
  );
};

legacyPawnTransactionSchema.pre(
  "validate",
  function () {
    const moneyFields = [
      "amount",
      "principalPaid",
      "interestPaid",
      "renewalFeePaid",
    ];

    const validAmounts = moneyFields.every(
      (field) =>
        isValidMoney(this[field], {
          allowZero: true,
        })
    );

    if (validAmounts) {
      const total =
        toCents(this.principalPaid) +
        toCents(this.interestPaid) +
        toCents(this.renewalFeePaid);

      if (total !== toCents(this.amount)) {
        this.invalidate(
          "amount",
          "Transaction amount does not match its allocation"
        );
      }
    }

    if (
      this.transactionDate &&
      this.importedAt &&
      this.transactionDate > this.importedAt
    ) {
      this.invalidate(
        "transactionDate",
        "Transaction date cannot be after import date"
      );
    }

    if (this.transactionType === "payment") {
      if (!(this.amount > 0)) {
        this.invalidate(
          "amount",
          "Payment amount must be greater than zero"
        );
      }

      if (!this.paymentMethod) {
        this.invalidate(
          "paymentMethod",
          "Payment method is required"
        );
      }

      if (this.renewalFeePaid !== 0) {
        this.invalidate(
          "renewalFeePaid",
          "Payment cannot include a renewal fee"
        );
      }

      if (
        this.previousMaturityDate != null ||
        this.newMaturityDate != null
      ) {
        this.invalidate(
          "newMaturityDate",
          "Payment cannot contain renewal dates"
        );
      }
    }

    if (this.transactionType === "renewal") {
      if (this.principalPaid !== 0) {
        this.invalidate(
          "principalPaid",
          "Renewal cannot contain principal payments"
        );
      }

      if (
        !this.previousMaturityDate ||
        !this.newMaturityDate
      ) {
        this.invalidate(
          "newMaturityDate",
          "Both renewal maturity dates are required"
        );
      }

      if (
        this.previousMaturityDate &&
        this.newMaturityDate &&
        this.newMaturityDate <=
          this.previousMaturityDate
      ) {
        this.invalidate(
          "newMaturityDate",
          "New maturity date must be after previous maturity date"
        );
      }

      if (this.paymentMethod != null) {
        this.invalidate(
          "paymentMethod",
          "Payment method is not supported for renewal records"
        );
      }
    }

    if (this.status === "verified") {
      if (!this.verifiedAt || !this.verifiedBy) {
        this.invalidate(
          "verifiedBy",
          "Verification information is required"
        );
      }
    } else if (
      this.verifiedAt != null ||
      this.verifiedBy != null
    ) {
      this.invalidate(
        "verifiedAt",
        "Only verified transactions can contain verification information"
      );
    }

    if (this.status === "voided") {
      if (
        !this.voidedAt ||
        !this.voidedBy ||
        !this.voidReason?.trim()
      ) {
        this.invalidate(
          "voidReason",
          "Void information is required"
        );
      }
    } else if (
      this.voidedAt != null ||
      this.voidedBy != null ||
      this.voidReason != null
    ) {
      this.invalidate(
        "voidedAt",
        "Only voided transactions can contain void information"
      );
    }
  }
);

// Prevent duplicate import requests
legacyPawnTransactionSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    name: "unique_legacy_transaction_idempotency_key",
  }
);

// Prevent duplicate historical sequence numbers
legacyPawnTransactionSchema.index(
  {
    pawnLoan: 1,
    sequenceNumber: 1,
  },
  {
    unique: true,
    name: "unique_legacy_transaction_sequence",
  }
);

// Historical transaction queries
legacyPawnTransactionSchema.index({
  pawnLoan: 1,
  status: 1,
  transactionDate: 1,
  sequenceNumber: 1,
});

const LegacyPawnTransaction = mongoose.model(
  "LegacyPawnTransaction",
  legacyPawnTransactionSchema
);

export default LegacyPawnTransaction;