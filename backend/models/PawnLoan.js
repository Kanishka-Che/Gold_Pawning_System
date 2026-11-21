
import mongoose from "mongoose";

const { Schema } = mongoose;

const pawnLoanSchema = new Schema(
  {
    loanNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      immutable: true,
      index: true,
    },

    goldItems: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "GoldItem",
        },
      ],
      validate: {
        validator: (items) =>
          Array.isArray(items) &&
          items.length > 0 &&
          new Set(items.map(String)).size === items.length,
        message:
          "At least one unique gold item is required",
      },
    },

    principalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },


    // Incremented atomically whenever a payment
    // affecting this loan is successfully recorded.
    // Used for concurrent payment protection.
    paymentVersion: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },


    currency: {
      type: String,
      enum: ["LKR"],
      default: "LKR",
      immutable: true,
    },

    interestRate: {
      type: Number,
      required: true,
      min: 0,
    },

    issueDate: {
      type: Date,
      required: true,
    },

    maturityDate: {
      type: Date,
      required: true,
    },

    
status: {
  type: String,
  enum: [
    "draft",
    "active",
    "redeemed",
    "closed",
    "cancelled",
  ],
  default: "draft",
},


    settingsVersion: {
      type: Number,
      required: true,
      min: 1,
    },

    settingsSnapshot: {
      interest: {
        rate: Number,
        calculationMethod: String,

principalCalculationMethod: {
  type: String,
  enum: [
    "original_principal",
    "remaining_principal",
  ],
  default: undefined,
},


        minimumInterestDays: Number,
        chargeFullFirstMonth: Boolean,
      },

      loan: {
        defaultDurationMonths: Number,
        maximumLoanAmount: Number,
      },

      
partialPayment: {
  enabled: {
    type: Boolean,
    default: false,
  },

  allowPartialInterest: {
    type: Boolean,
    default: false,
  },

  allowPartialPrincipal: {
    type: Boolean,
    default: false,
  },

  allocationMethod: {
    type: String,
    enum: ["interest_first", "principal_first"],
  },

  minimumAmount: {
    type: Number,
    min: 0,
  },
},


      renewal: {
        enabled: Boolean,
        durationMonths: Number,
        requireInterestSettlement: Boolean,
        renewalFee: Number,
      },

      overdue: {
        gracePeriodDays: Number,
        penaltyEnabled: Boolean,
        penaltyRate: Number,
      },
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    redeemedAt: {
      type: Date,
      default: null,
    },


cancelledAt: {
  type: Date,
  default: null,
},

cancelledBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},


  },
  {
    timestamps: true,
  }
);

// Validate loan dates
pawnLoanSchema.pre("validate", function () {
  if (
    this.issueDate &&
    this.maturityDate &&
    this.maturityDate <= this.issueDate
  ) {
    this.invalidate(
      "maturityDate",
      "Maturity date must be after issue date"
    );
  }
});

// Helpful indexes
pawnLoanSchema.index({
  customer: 1,
  createdAt: -1,
});

pawnLoanSchema.index({
  status: 1,
  maturityDate: 1,
});

const PawnLoan = mongoose.model(
  "PawnLoan",
  pawnLoanSchema
);

export default PawnLoan;
