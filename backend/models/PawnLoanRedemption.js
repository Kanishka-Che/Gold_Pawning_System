
import mongoose from "mongoose";

const { Schema } = mongoose;

const isValidMoney = (value) => {
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

const pawnLoanRedemptionSchema = new Schema(
  {
    pawnLoan: {
      type: Schema.Types.ObjectId,
      ref: "PawnLoan",
      required: true,
      immutable: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      minlength: 16,
      maxlength: 128,
      match: /^[a-zA-Z0-9_-]+$/,
    },

    redeemedAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    redeemedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    settingsVersion: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: "Invalid settings version",
      },
    },

    principalSettled: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isValidMoney,
        message: "Invalid principal settlement amount",
      },
    },

    interestSettled: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isValidMoney,
        message: "Invalid interest settlement amount",
      },
    },

    penaltySettled: {
      type: Number,
      required: true,
      default: 0,
      immutable: true,
      validate: {
        validator: isValidMoney,
        message: "Invalid penalty settlement amount",
      },
    },

    totalSettled: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: isValidMoney,
        message: "Invalid total settlement amount",
      },
    },

    releasedGoldItems: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "GoldItem",
        },
      ],
      required: true,
      immutable: true,
      validate: {
        validator: (items) =>
          Array.isArray(items) &&
          items.length > 0 &&
          items.every((id) =>
            mongoose.isObjectIdOrHexString(id)
          ) &&
          new Set(items.map(String)).size === items.length,
        message:
          "At least one unique released gold item is required",
      },
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

// One successful redemption per pawn loan.
pawnLoanRedemptionSchema.index(
  { pawnLoan: 1 },
  { unique: true }
);

pawnLoanRedemptionSchema.index({
  redeemedAt: -1,
  _id: -1,
});

// Validate settlement consistency.
pawnLoanRedemptionSchema.pre("validate", function () {
  const amounts = [
    this.principalSettled,
    this.interestSettled,
    this.penaltySettled,
    this.totalSettled,
  ];

  if (!amounts.every(isValidMoney)) {
    return;
  }

  const expectedTotalCents =
    BigInt(Math.round(this.principalSettled * 100)) +
    BigInt(Math.round(this.interestSettled * 100)) +
    BigInt(Math.round(this.penaltySettled * 100));

  const actualTotalCents = BigInt(
    Math.round(this.totalSettled * 100)
  );

  if (
    expectedTotalCents >
    BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    this.invalidate(
      "totalSettled",
      "Total settlement exceeds safe monetary range"
    );

    return;
  }

  if (expectedTotalCents !== actualTotalCents) {
    this.invalidate(
      "totalSettled",
      "Total settlement must equal principal, interest and penalty settlement"
    );
  }
});

const PawnLoanRedemption = mongoose.model(
  "PawnLoanRedemption",
  pawnLoanRedemptionSchema
);

export default PawnLoanRedemption;
