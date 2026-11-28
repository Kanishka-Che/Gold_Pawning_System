
import mongoose from "mongoose";
import { isValidMoney } from "../utils/moneyValidator.js";

const { Schema } = mongoose;

// Opening balance for existing pawn loans
const openingBalanceSchema = new Schema(
  {
    asOfDate: {
      type: Date,
      required: true,
    },

    principalPaid: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) =>
          isValidMoney(value, { allowZero: true }),
        message: "Invalid paid principal amount",
      },
    },

    outstandingPrincipal: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) =>
          isValidMoney(value, { allowZero: true }),
        message: "Invalid outstanding principal amount",
      },
    },

    outstandingInterest: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) =>
          isValidMoney(value, { allowZero: true }),
        message: "Invalid outstanding interest amount",
      },
    },
  },
  {
    _id: false,
  }
);

const pawnLoanSchema = new Schema(
  {
    // Identify new and existing pawn loans
recordSource: {
  type: String,
  enum: ["new", "legacy"],
  default: "new",
  required: true,
  immutable: true,
},

// Original pawn ticket number from old records
legacyTicketNumber: {
  type: String,
  trim: true,
  uppercase: true,
  maxlength: 100,
  immutable: true,
  default: undefined,
},

// Reference to old book, page or document
legacyReference: {
  type: String,
  trim: true,
  maxlength: 500,
  default: undefined,
},

// Historical data migration method
legacyHistoryMode: {
  type: String,
  enum: ["full_history", "opening_balance"],
  immutable: true,
  default: undefined,
},

// Date the old record was imported
importedAt: {
  type: Date,
  immutable: true,
  default: undefined,
},

// Admin who imported the record
importedBy: {
  type: Schema.Types.ObjectId,
  ref: "User",
  immutable: true,
  default: undefined,
},

// Verified financial balance at migration date
openingBalance: {
  type: openingBalanceSchema,
  default: undefined,
},

// Opening balance revision for concurrent update protection
openingBalanceVersion: {
  type: Number,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: "Invalid opening balance version",
  },
  default: undefined,
},

// Date the opening balance was verified
openingBalanceVerifiedAt: {
  type: Date,
  default: undefined,
},

// Administrator who verified the opening balance
openingBalanceVerifiedBy: {
  type: Schema.Types.ObjectId,
  ref: "User",
  default: undefined,
},

// Historical transaction revision
legacyHistoryVersion: {
  type: Number,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: "Invalid historical transaction version",
  },
  default: undefined,
},

// Date the historical transactions were verified
legacyHistoryVerifiedAt: {
  type: Date,
  default: undefined,
},

// Administrator who verified the history
legacyHistoryVerifiedBy: {
  type: Schema.Types.ObjectId,
  ref: "User",
  default: undefined,
},


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
  validate: {
    validator: (value) => isValidMoney(value),
    message: "Invalid principal amount",
  },
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

// Identify the origin of the loan settings
settingsSource: {
  type: String,
  enum: ["shop_settings", "legacy_custom"],
  default: "shop_settings",
  required: true,
  immutable: true,
},

// Historical business rules must be confirmed
// before financial processing is enabled.
legacyRulesStatus: {
  type: String,
  enum: ["pending", "confirmed"],
  default: undefined,
},


// Historical financial data verification status
legacyMigrationStatus: {
  type: String,
  enum: [
    "pending",
    "verified",
    "completed",
  ],
  default: undefined,
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

      redemption: {
  enabled: Boolean,

  allowEarlyRedemption: Boolean,

  allowOverdueRedemption: Boolean,

  includeOverduePenalties: Boolean,

  requireCustomerVerification: Boolean,

  requireAdminApproval: Boolean,
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

// Validate legacy pawn loan information
pawnLoanSchema.pre("validate", function () {
  const isLegacy = this.recordSource === "legacy";

  // Validate settings source
if (
  isLegacy &&
  this.settingsSource !== "legacy_custom"
) {
  this.invalidate(
    "settingsSource",
    "Legacy loans require custom settings"
  );
}

if (
  !isLegacy &&
  this.settingsSource !== "shop_settings"
) {
  this.invalidate(
    "settingsSource",
    "New loans require shop settings"
  );
}

// Legacy rules confirmation status
if (
  isLegacy &&
  !["pending", "confirmed"].includes(
    this.legacyRulesStatus
  )
) {
  this.invalidate(
    "legacyRulesStatus",
    "Legacy rules status is required"
  );
}

if (
  !isLegacy &&
  this.legacyRulesStatus != null
) {
  this.invalidate(
    "legacyRulesStatus",
    "Legacy rules status is allowed only for legacy loans"
  );
}

 const legacyFields = [
  "legacyTicketNumber",
  "legacyReference",
  "legacyHistoryMode",
  "importedAt",
  "importedBy",
  "openingBalance",
  "legacyMigrationStatus",
  "openingBalanceVersion",
  "openingBalanceVerifiedAt",
  "openingBalanceVerifiedBy",
  "legacyHistoryVersion",
"legacyHistoryVerifiedAt",
"legacyHistoryVerifiedBy",
];

  // New loans must not contain legacy information
  if (!isLegacy) {
    for (const field of legacyFields) {
      if (this.get(field) != null) {
        this.invalidate(
          field,
          `${field} is allowed only for legacy loans`
        );
      }
    }

    return;
  }

  // Keep the loan interest rate consistent
// with the original interest settings snapshot.
if (
  this.interestRate !==
  this.settingsSnapshot?.interest?.rate
) {
  this.invalidate(
    "interestRate",
    "Interest rate must match the legacy settings snapshot"
  );
}

// Legacy migration status is required
if (
  !["pending", "verified", "completed"].includes(
    this.legacyMigrationStatus
  )
) {
  this.invalidate(
    "legacyMigrationStatus",
    "Legacy migration status is required"
  );
}

// Active financial records require completed migration
if (
  ["active", "redeemed", "closed"].includes(
    this.status
  ) &&
  this.legacyMigrationStatus !== "completed"
) {
  this.invalidate(
    "legacyMigrationStatus",
    "Legacy migration must be completed first"
  );
}

// Completed migration cannot remain a draft
if (
  this.status === "draft" &&
  this.legacyMigrationStatus === "completed"
) {
  this.invalidate(
    "legacyMigrationStatus",
    "Draft loan cannot have completed migration"
  );
}


  // Required legacy identification
  if (!this.legacyTicketNumber?.trim()) {
    this.invalidate(
      "legacyTicketNumber",
      "Original pawn ticket number is required"
    );
  }

  if (!this.legacyHistoryMode) {
    this.invalidate(
      "legacyHistoryMode",
      "Legacy history mode is required"
    );
  }

  if (!this.importedAt) {
    this.invalidate(
      "importedAt",
      "Import date is required"
    );
  }

  if (!this.importedBy) {
    this.invalidate(
      "importedBy",
      "Importing user is required"
    );
  }

  // Original issue date cannot be after import date
  if (
    this.issueDate &&
    this.importedAt &&
    this.issueDate > this.importedAt
  ) {
    this.invalidate(
      "issueDate",
      "Original issue date cannot be after import date"
    );
  }

  // Import date cannot be in the future
  if (
    this.importedAt &&
    this.importedAt > new Date()
  ) {
    this.invalidate(
      "importedAt",
      "Import date cannot be in the future"
    );
  }

// Historical transaction verification metadata
const historyMetadataFields = [
  "legacyHistoryVersion",
  "legacyHistoryVerifiedAt",
  "legacyHistoryVerifiedBy",
];

if (this.legacyHistoryMode !== "full_history") {
  for (const field of historyMetadataFields) {
    if (this.get(field) != null) {
      this.invalidate(
        field,
        `${field} is allowed only for full history loans`
      );
    }
  }
}

if (this.legacyHistoryMode === "full_history") {
  const historyVerified = [
    "verified",
    "completed",
  ].includes(this.legacyMigrationStatus);

  if (historyVerified) {
    if (
      !Number.isSafeInteger(
        this.legacyHistoryVersion
      ) ||
      this.legacyHistoryVersion < 1
    ) {
      this.invalidate(
        "legacyHistoryVersion",
        "Historical transaction version is required"
      );
    }

    if (!this.legacyHistoryVerifiedAt) {
      this.invalidate(
        "legacyHistoryVerifiedAt",
        "Historical verification date is required"
      );
    }

    if (!this.legacyHistoryVerifiedBy) {
      this.invalidate(
        "legacyHistoryVerifiedBy",
        "Historical verifier is required"
      );
    }

    if (
      this.legacyHistoryVerifiedAt &&
      (
        this.legacyHistoryVerifiedAt > new Date() ||
        (
          this.importedAt &&
          this.legacyHistoryVerifiedAt < this.importedAt
        )
      )
    ) {
      this.invalidate(
        "legacyHistoryVerifiedAt",
        "Invalid historical verification date"
      );
    }
  } else if (
    this.legacyHistoryVerifiedAt != null ||
    this.legacyHistoryVerifiedBy != null
  ) {
    this.invalidate(
      "legacyHistoryVerifiedAt",
      "Pending history cannot contain verification information"
    );
  }
}

  // Full history must not include an opening balance
  if (
    this.legacyHistoryMode === "full_history" &&
    this.openingBalance != null
  ) {
    this.invalidate(
      "openingBalance",
      "Full history loans cannot contain an opening balance"
    );
  }

 // Pending draft loans can receive opening balances later
if (
  this.legacyHistoryMode === "opening_balance" &&
  !this.openingBalance &&
  (
    !["draft", "cancelled"].includes(this.status) ||
    ["verified", "completed"].includes(
      this.legacyMigrationStatus
    )
  )
) {
  this.invalidate(
    "openingBalance",
    "Opening balance details are required"
  );

  return;
}

// Opening balance metadata is only allowed
// for opening balance migration mode
const openingBalanceMetadataFields = [
  "openingBalanceVersion",
  "openingBalanceVerifiedAt",
  "openingBalanceVerifiedBy",
];

if (this.legacyHistoryMode !== "opening_balance") {
  for (const field of openingBalanceMetadataFields) {
    if (this.get(field) != null) {
      this.invalidate(
        field,
        `${field} is allowed only for opening balance loans`
      );
    }
  }
}

// Validate opening balance verification information
if (this.legacyHistoryMode === "opening_balance") {
  const isVerified = [
    "verified",
    "completed",
  ].includes(this.legacyMigrationStatus);

  if (this.openingBalance) {
    if (
      !Number.isSafeInteger(
        this.openingBalanceVersion
      ) ||
      this.openingBalanceVersion < 1
    ) {
      this.invalidate(
        "openingBalanceVersion",
        "Opening balance version is required"
      );
    }
  }

  if (isVerified) {
    if (!this.openingBalanceVerifiedAt) {
      this.invalidate(
        "openingBalanceVerifiedAt",
        "Opening balance verification date is required"
      );
    }

    if (!this.openingBalanceVerifiedBy) {
      this.invalidate(
        "openingBalanceVerifiedBy",
        "Opening balance verifier is required"
      );
    }

    if (
      this.openingBalanceVerifiedAt &&
      (
        this.openingBalanceVerifiedAt > new Date() ||
        (
          this.importedAt &&
          this.openingBalanceVerifiedAt < this.importedAt
        )
      )
    ) {
      this.invalidate(
        "openingBalanceVerifiedAt",
        "Invalid opening balance verification date"
      );
    }
  } else {
    if (
      this.openingBalanceVerifiedAt != null ||
      this.openingBalanceVerifiedBy != null
    ) {
      this.invalidate(
        "openingBalanceVerifiedAt",
        "Pending balances cannot contain verification information"
      );
    }
  }
}


  const balance = this.openingBalance;

  if (!balance) {
    return;
  }

  // Balance date cannot be before the original issue date
  if (
    balance.asOfDate &&
    this.issueDate &&
    balance.asOfDate < this.issueDate
  ) {
    this.invalidate(
      "openingBalance.asOfDate",
      "Balance date cannot be before issue date"
    );
  }

  // Balance date cannot be after import date
  if (
    balance.asOfDate &&
    this.importedAt &&
    balance.asOfDate > this.importedAt
  ) {
    this.invalidate(
      "openingBalance.asOfDate",
      "Balance date cannot be after import date"
    );
  }

  // Validate principal balance consistency
  const amountsAreValid =
    isValidMoney(this.principalAmount) &&
    isValidMoney(balance.principalPaid, {
      allowZero: true,
    }) &&
    isValidMoney(balance.outstandingPrincipal, {
      allowZero: true,
    });

 if (amountsAreValid) {
  const toCents = (amount) => {
    const [whole, fraction = ""] =
      String(amount).split(".");

    return (
      BigInt(whole) * 100n +
      BigInt(fraction.padEnd(2, "0"))
    );
  };

  const originalCents =
    toCents(this.principalAmount);

  const paidCents =
    toCents(balance.principalPaid);

  const outstandingCents =
    toCents(balance.outstandingPrincipal);

  if (
    paidCents + outstandingCents !== originalCents
  ) {
    this.invalidate(
      "openingBalance.outstandingPrincipal",
      "Paid principal plus outstanding principal must equal original principal"
    );
  }
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

// Prevent duplicate legacy pawn ticket numbers
pawnLoanSchema.index(
  {
    legacyTicketNumber: 1,
  },
  {
    unique: true,
    name: "unique_legacy_pawn_ticket_number",
    partialFilterExpression: {
      recordSource: "legacy",
      legacyTicketNumber: { $type: "string" },
    },
  }
);

// Support legacy loan queries
pawnLoanSchema.index({
  recordSource: 1,
  status: 1,
});

const PawnLoan = mongoose.model(
  "PawnLoan",
  pawnLoanSchema
);

export default PawnLoan;
