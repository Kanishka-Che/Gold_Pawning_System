
import mongoose from "mongoose";

const { Schema } = mongoose;

const pawnPaymentSchema = new Schema(
  {
    // Related pawn loan
    pawnLoan: {
      type: Schema.Types.ObjectId,
      ref: "PawnLoan",
      required: true,
      immutable: true,
      index: true,
    },


    // Unique identifier for one payment request.
    // Retries must reuse the same key.
    idempotencyKey: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 16,
      maxlength: 100,
      match: /^[A-Za-z0-9_-]+$/,
    },


    // Total payment received (LKR)
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      immutable: true,
    },

    // Amount allocated to interest
    interestPaid: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },

    // Amount allocated to principal
    principalPaid: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },

    // Payment method
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer"],
      required: true,
      immutable: true,
    },

    // Date and time payment was received
    paidAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    // User who recorded the payment
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    // Optional reference or note
    reference: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validate payment allocation
pawnPaymentSchema.pre("validate", function () {
  if (
    this.amount == null ||
    this.interestPaid == null ||
    this.principalPaid == null
  ) {
    return;
  }

  const amountCents = Math.round(this.amount * 100);

  const interestCents = Math.round(
    this.interestPaid * 100
  );

  const principalCents = Math.round(
    this.principalPaid * 100
  );

  const values = [
    this.amount,
    this.interestPaid,
    this.principalPaid,
  ];

  const cents = [
    amountCents,
    interestCents,
    principalCents,
  ];

  const validAmounts = values.every(
    (value, index) =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      Number.isSafeInteger(cents[index]) &&
      Math.abs(value - cents[index] / 100) <= 1e-8
  );

  if (!validAmounts) {
    this.invalidate(
      "amount",
      "Payment amounts must have at most two decimal places"
    );
    return;
  }

  if (interestCents + principalCents !== amountCents) {
    this.invalidate(
      "amount",
      "Interest paid plus principal paid must equal payment amount"
    );
  }

});

// Loan payment history index
pawnPaymentSchema.index({
  pawnLoan: 1,
  paidAt: -1,
  _id: -1,
});

// Prevent duplicate payment requests
pawnPaymentSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    name: "unique_pawn_payment_idempotency_key",
  }
);

// Create Mongoose model
const PawnPayment = mongoose.model(
  "PawnPayment",
  pawnPaymentSchema
);

export default PawnPayment;

