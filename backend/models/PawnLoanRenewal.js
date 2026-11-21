
import mongoose from "mongoose";

const { Schema } = mongoose;

const pawnLoanRenewalSchema = new Schema(
  {
    pawnLoan: {
      type: Schema.Types.ObjectId,
      ref: "PawnLoan",
      required: true,
      immutable: true,
      index: true,
    },

    // Prevent duplicate renewal transactions
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      minlength: 16,
      maxlength: 100,
      match: /^[A-Za-z0-9_-]+$/,
    },

    previousMaturityDate: {
      type: Date,
      required: true,
      immutable: true,
    },

    newMaturityDate: {
      type: Date,
      required: true,
      immutable: true,
    },

    renewedAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    renewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    // Snapshot of settings used for this renewal
    settingsVersion: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },

    interestSettled: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },

    renewalFeePaid: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validate renewal dates
pawnLoanRenewalSchema.pre("validate", function () {
  if (
    this.previousMaturityDate &&
    this.newMaturityDate &&
    this.newMaturityDate <= this.previousMaturityDate
  ) {
    this.invalidate(
      "newMaturityDate",
      "New maturity date must be after previous maturity date"
    );
  }
});


const isValidMoneyAmount = (value) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return false;
  }

  const cents = Math.round(value * 100);

  return (
    Number.isSafeInteger(cents) &&
    Math.abs(value - cents / 100) <= 1e-8
  );
};

pawnLoanRenewalSchema.pre("validate", function () {
  const moneyFields = [
    "interestSettled",
    "renewalFeePaid",
  ];

  for (const field of moneyFields) {
    const value = this.get(field);

    // Required validation handles missing values.
    if (value == null) {
      continue;
    }

    if (!isValidMoneyAmount(value)) {
      this.invalidate(
        field,
        `${field} must be a valid amount with at most two decimal places`
      );
    }
  }
});


// Loan renewal history
pawnLoanRenewalSchema.index({
  pawnLoan: 1,
  renewedAt: -1,
  _id: -1,
});

const PawnLoanRenewal = mongoose.model(
  "PawnLoanRenewal",
  pawnLoanRenewalSchema
);

export default PawnLoanRenewal;
