
import mongoose from "mongoose";

const loanSettingsSchema = new mongoose.Schema(
  {
    // Only one active settings configuration per shop
    settingsKey: {
      type: String,
      default: "default",
      unique: true,
      immutable: true,
    },

    // Interest Settings
    interest: {
      rate: {
        type: Number,
        default: 0,
        min: 0,
      },
      calculationMethod: {
        type: String,
        enum: ["monthly", "daily"],
        default: "monthly",
      },

principalCalculationMethod: {
  type: String,
  enum: [
    "original_principal",
    "remaining_principal",
  ],
  default: undefined,
},


      minimumInterestDays: {
        type: Number,
        default: 0,
        min: 0,
      },
      chargeFullFirstMonth: {
        type: Boolean,
        default: false,
      },
    },

    // Loan Settings
    loan: {
      defaultDurationMonths: {
        type: Number,
        default: 6,
        min: 1,
      },
      maximumLoanAmount: {
        type: Number,
        default: null,
        min: 0,
      },
    },

    
    // Partial Payment Settings
    partialPayment: {
      enabled: {
        type: Boolean,
        default: false,
      },

      // Allow paying only part of the outstanding interest
      allowPartialInterest: {
        type: Boolean,
        default: false,
      },

      // Allow paying only part of the outstanding principal
      allowPartialPrincipal: {
        type: Boolean,
        default: false,
      },

      allocationMethod: {
        type: String,
        enum: ["interest_first", "principal_first"],
        default: "interest_first",
      },

      minimumAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },


    // Renewal Settings
    renewal: {
      enabled: {
        type: Boolean,
        default: false,
      },
      durationMonths: {
        type: Number,
        default: 6,
        min: 1,
      },
      requireInterestSettlement: {
        type: Boolean,
        default: true,
      },
      renewalFee: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // Redemption Settings
redemption: {
  enabled: {
    type: Boolean,
    default: false,
  },

  allowEarlyRedemption: {
    type: Boolean,
    default: false,
  },

  allowOverdueRedemption: {
    type: Boolean,
    default: false,
  },

  includeOverduePenalties: {
    type: Boolean,
    default: false,
  },

  requireCustomerVerification: {
    type: Boolean,
    default: true,
  },

  requireAdminApproval: {
    type: Boolean,
    default: true,
  },
},

   // Overdue Settings
overdue: {
  gracePeriodDays: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isSafeInteger,
      message:
        "Grace period must be a valid whole number",
    },
  },

  penaltyEnabled: {
    type: Boolean,
    default: false,
  },

  penaltyRate: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message:
        "Penalty rate must be a finite number",
    },
  },
},

    // Settings revision for future audit/history
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

export default mongoose.model("LoanSettings", loanSettingsSchema);
