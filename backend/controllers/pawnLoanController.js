
import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import GoldItem from "../models/GoldItem.js";
import PawnLoan from "../models/PawnLoan.js";
import LoanSettings from "../models/LoanSettings.js";
import { createAuditLog } from "../utils/auditLogger.js";
import PawnPayment from "../models/PawnPayment.js";

import {
  calculateRemainingPrincipalDailyInterest,
} from "../utils/remainingPrincipalInterest.js";

import {
  calculateOutstandingInterest,
} from "../utils/outstandingInterest.js";


import { generateLoanNumber } from "../utils/generateLoanNumber.js";

import {
  calculateLoanInterest,
  calculateInterestPeriod,
} from "../utils/interestCalculator.js";

const isValidId = (id) =>
  typeof id === "string" &&
  mongoose.isObjectIdOrHexString(id);

const transactionConflict = (message) => {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
};

// POST /api/pawn-loans
export const createPawnLoan = async (req, res) => {
  const {
    customerId,
    goldItemIds,
    principalAmount,
  } = req.body ?? {};

  // Validate request
  if (
    !isValidId(customerId) ||
    !Array.isArray(goldItemIds) ||
    goldItemIds.length === 0 ||
    goldItemIds.length > 50 ||
    !goldItemIds.every(isValidId) ||
    new Set(goldItemIds).size !== goldItemIds.length ||
    typeof principalAmount !== "number" ||
    !Number.isFinite(principalAmount) ||
    principalAmount <= 0 ||
    Math.round(principalAmount * 100) !==
      principalAmount * 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid pawn loan data",
    });
  }

  const session = await mongoose.startSession();

  try {
    let createdLoan;

    await session.withTransaction(async () => {
      // 1. Validate customer
      const customer = await Customer.findById(
        customerId
      ).session(session);

      if (!customer || customer.status !== "active") {
        const error = new Error(
          "Customer not found or inactive"
        );
        error.statusCode = 400;
        throw error;
      }

      // 2. Validate loan settings
      const settings = await LoanSettings.findOne({
        settingsKey: "default",
      }).session(session);

      if (!settings) {
        const error = new Error(
          "Loan settings must be configured first"
        );
        error.statusCode = 400;
        throw error;
      }


const interestSettings = settings.interest;

const allowedPrincipalMethods = [
  "original_principal",
  "remaining_principal",
];

const principalMethod =
  interestSettings?.principalCalculationMethod;

const calculationMethod =
  interestSettings?.calculationMethod;

const isSupportedCombination =
  principalMethod === "original_principal" &&
  ["monthly", "daily"].includes(calculationMethod) ||
  principalMethod === "remaining_principal" &&
  calculationMethod === "daily";

if (
  !allowedPrincipalMethods.includes(principalMethod) ||
  !isSupportedCombination ||
  !Number.isSafeInteger(
    interestSettings?.minimumInterestDays
  ) ||
  interestSettings.minimumInterestDays !== 0 ||
  interestSettings.chargeFullFirstMonth !== false
) {
  const error = new Error(
    "Loan interest settings are unconfirmed or unsupported. " +
    "Ask an Admin to configure a supported interest calculation method."
  );

  error.statusCode = 409;
  throw error;
}


      if (
        settings.loan.maximumLoanAmount != null &&
        principalAmount > settings.loan.maximumLoanAmount
      ) {
        const error = new Error(
          "Loan amount exceeds maximum allowed amount"
        );
        error.statusCode = 400;
        throw error;
      }

      // 3. Generate loan number
      const loanNumber = await generateLoanNumber(session);

      // 4. Calculate dates
      const issueDate = new Date();
      const maturityDate = new Date(issueDate);

      maturityDate.setUTCMonth(
        maturityDate.getUTCMonth() +
          settings.loan.defaultDurationMonths
      );

      // 5. Create loan
      const [loan] = await PawnLoan.create(
        [
          {
            loanNumber,
            customer: customer._id,
            goldItems: goldItemIds,
            principalAmount,
            interestRate: settings.interest.rate,
            issueDate,
            maturityDate,
            status: "draft",
            settingsVersion: settings.version,
            settingsSnapshot: {
  interest: settings.interest.toObject(),

  loan: settings.loan.toObject(),

  partialPayment:
    settings.partialPayment.toObject(),

  renewal: settings.renewal.toObject(),

  redemption: settings.redemption.toObject(),

  overdue: settings.overdue.toObject(),
},
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      // 6. Reserve gold items atomically
      const reservation = await GoldItem.updateMany(
        {
          _id: { $in: goldItemIds },
          status: "draft",
          reservedForLoan: null,
        },
        {
          $set: {
            reservedForLoan: loan._id,
          },
        },
        { session }
      );

     
if (
  reservation.matchedCount !== goldItemIds.length
) {
  throw transactionConflict(
    "One or more gold items are unavailable"
  );
}

// Save loan creation audit log
await createAuditLog({
  req,
  action: "PAWN_LOAN_CREATED",
  targetType: "PawnLoan",
  targetId: loan._id,
  details: {
    loanNumber: loan.loanNumber,
    customerId: String(customer._id),
    goldItemIds: goldItemIds.map(String),
    principalAmount: loan.principalAmount,
    currency: loan.currency,
    interestRate: loan.interestRate,
    settingsVersion: loan.settingsVersion,
    status: loan.status,
  },
  session,
});

createdLoan = loan;

    });

    return res.status(201).json({
      success: true,
      message: "Draft pawn loan created successfully",
      pawnLoan: createdLoan,
    });
  } catch (error) {
    if (
      error.statusCode === 400 ||
      error.statusCode === 409
    ) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.code === 11000 ||
      error.code === 112 ||
      error.hasErrorLabel?.("TransientTransactionError")
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Loan creation conflict. Please try again.",
      });
    }

    console.error("Create Pawn Loan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create pawn loan",
    });
  } finally {
    await session.endSession();
  }
};


// GET /api/pawn-loans
export const getPawnLoans = async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const filter = {};


if (req.query.search !== undefined) {
  const search = req.query.search;

  if (
    typeof search !== "string" ||
    !search.trim() ||
    search.length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid search value",
    });
  }

  const searchText = search.trim();

  // Escape regex special characters
  const escapedSearch = searchText.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

// Find customers by NIC, name or customer code

const matchingCustomers = await Customer.find({
  $or: [
    {
      nic: {
        $regex: `^${escapedSearch}$`,
        $options: "i",
      },
    },
    {
      fullName: {
        $regex: escapedSearch,
        $options: "i",
      },
    },
    {
      customerCode: {
        $regex: escapedSearch,
        $options: "i",
      },
    },
  ],
})
  .select("_id")
  .lean();


  const customerIds = matchingCustomers.map(
    (customer) => customer._id
  );

 // Search by Loan Number, NIC, Customer Name or Customer Code
  filter.$or = [
    {
      loanNumber: {
        $regex: escapedSearch,
        $options: "i",
      },
    },
    {
      customer: {
        $in: customerIds,
      },
    },
  ];
}


    if (req.query.status !== undefined) {
      
const allowedStatuses = [
  "draft",
  "active",
  "redeemed",
  "closed",
  "cancelled",
];


      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid loan status",
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.customerId !== undefined) {
      if (
        typeof req.query.customerId !== "string" ||
        !mongoose.isObjectIdOrHexString(
          req.query.customerId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      filter.customer = req.query.customerId;
    }

    const [pawnLoans, total] = await Promise.all([
      PawnLoan.find(filter)
        .populate(
          "customer",
          "customerCode fullName status"
        )
        .populate(
          "goldItems",
          "itemType karat grossWeight netWeight status"
        )
        .populate("createdBy", "username")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      PawnLoan.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      pawnLoans,
    });
  } catch (error) {
    console.error("Get Pawn Loans Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch pawn loans",
    });
  }
};


// GET /api/pawn-loans/:id
export const getPawnLoanById = async (req, res) => {
  try {
    if (
      !mongoose.isObjectIdOrHexString(req.params.id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pawn loan ID",
      });
    }

    const pawnLoan = await PawnLoan.findById(req.params.id)
      .populate(
        "customer",
        "customerCode fullName nic phone address status"
      )
      
.populate(
  "goldItems",
  "goldItemCode itemType description karat grossWeight deductionWeight netWeight status"
)

      
.populate("createdBy", "username")
.populate("cancelledBy", "username");


    if (!pawnLoan) {
      return res.status(404).json({
        success: false,
        message: "Pawn loan not found",
      });
    }

    return res.status(200).json({
      success: true,
      pawnLoan,
    });
  } catch (error) {
    console.error("Get Pawn Loan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch pawn loan",
    });
  }
};



 // PATCH /api/pawn-loans/:id/cancel
export const cancelDraftPawnLoan = async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid pawn loan ID",
    });
  }

  const session = await mongoose.startSession();

  try {
    let cancelledLoan;

    await session.withTransaction(async () => {
      const loan = await PawnLoan.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "draft",
        },
        {
          $set: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledBy: req.user._id,
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!loan) {
        const existingLoan = await PawnLoan.findById(
          req.params.id
        ).session(session);

        const error = new Error(
          existingLoan
            ? "Only draft pawn loans can be cancelled"
            : "Pawn loan not found"
        );

        error.statusCode = existingLoan ? 409 : 404;
        throw error;
      }

      const releaseResult = await GoldItem.updateMany(
        {
          _id: { $in: loan.goldItems },
          status: "draft",
          reservedForLoan: loan._id,
        },
        {
          $set: {
            reservedForLoan: null,
          },
        },
        { session }
      );

      if (releaseResult.modifiedCount !== loan.goldItems.length) {
        const error = new Error(
          "Gold item reservation mismatch. Cancellation was rolled back."
        );

        error.statusCode = 409;
        throw error;
      }

      await createAuditLog({
        req,
        action: "PAWN_LOAN_CANCELLED",
        targetType: "PawnLoan",
        targetId: loan._id,
        details: {
          loanNumber: loan.loanNumber,
          previousStatus: "draft",
          newStatus: "cancelled",
          releasedGoldItemIds: loan.goldItems.map(String),
        },
        session,
      });

      cancelledLoan = loan;
    });

    return res.status(200).json({
      success: true,
      message: "Draft pawn loan cancelled successfully",
      pawnLoan: cancelledLoan,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.code === 112 ||
      error.hasErrorLabel?.("TransientTransactionError")
    ) {
      return res.status(409).json({
        success: false,
        message: "Loan was modified concurrently. Please try again.",
      });
    }

    console.error("Cancel Pawn Loan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel pawn loan",
    });
  } finally {
    await session.endSession();
  }
};


 // PATCH /api/pawn-loans/:id/activate
export const activatePawnLoan = async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid pawn loan ID",
    });
  }

  const session = await mongoose.startSession();

  try {
    let activatedLoan;

    await session.withTransaction(async () => {
      const loan = await PawnLoan.findById(
        req.params.id
      ).session(session);

      if (!loan) {
        const error = new Error("Pawn loan not found");
        error.statusCode = 404;
        throw error;
      }

      if (loan.status !== "draft") {
        const error = new Error(
          "Only draft pawn loans can be activated"
        );
        error.statusCode = 409;
        throw error;
      }

      const customer = await Customer.findById(
        loan.customer
      ).session(session);

      if (!customer || customer.status !== "active") {
        const error = new Error(
          "Customer must be active to activate a loan"
        );
        error.statusCode = 409;
        throw error;
      }

      const activationDate = new Date();

      const durationMonths =
        loan.settingsSnapshot?.loan?.defaultDurationMonths;

      if (
        !Number.isInteger(durationMonths) ||
        durationMonths <= 0
      ) {
        const error = new Error(
          "Invalid loan duration settings"
        );
        error.statusCode = 409;
        throw error;
      }

      // Add months without overflowing at month-end
      const maturityDate = new Date(activationDate);
      const originalDay = maturityDate.getUTCDate();

      maturityDate.setUTCDate(1);
      maturityDate.setUTCMonth(
        maturityDate.getUTCMonth() + durationMonths
      );

      const lastDay = new Date(
        Date.UTC(
          maturityDate.getUTCFullYear(),
          maturityDate.getUTCMonth() + 1,
          0
        )
      ).getUTCDate();

      maturityDate.setUTCDate(
        Math.min(originalDay, lastDay)
      );

      const goldUpdate = await GoldItem.updateMany(
        {
          _id: { $in: loan.goldItems },
          status: "draft",
          reservedForLoan: loan._id,
        },
        {
          $set: {
            status: "pledged",
          },
        },
        { session }
      );

      if (
        goldUpdate.modifiedCount !== loan.goldItems.length
      ) {
        const error = new Error(
          "Gold item reservation mismatch. Activation rolled back."
        );
        error.statusCode = 409;
        throw error;
      }

      loan.status = "active";
      loan.issueDate = activationDate;
      loan.maturityDate = maturityDate;
      loan.activatedAt = activationDate;

      await loan.save({ session });

      await createAuditLog({
        req,
        action: "PAWN_LOAN_ACTIVATED",
        targetType: "PawnLoan",
        targetId: loan._id,
        details: {
          loanNumber: loan.loanNumber,
          previousStatus: "draft",
          newStatus: "active",
          principalAmount: loan.principalAmount,
          issueDate: loan.issueDate,
          maturityDate: loan.maturityDate,
          goldItemIds: loan.goldItems.map(String),
        },
        session,
      });

      activatedLoan = loan;
    });

    return res.status(200).json({
      success: true,
      message: "Pawn loan activated successfully",
      pawnLoan: activatedLoan,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.code === 112 ||
      error.hasErrorLabel?.("TransientTransactionError")
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Loan was modified concurrently. Please try again.",
      });
    }

    console.error("Activate Pawn Loan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to activate pawn loan",
    });
  } finally {
    await session.endSession();
  }
};

export const calculatePawnLoanInterestPreview = async ({
  loanId,
  session,
  calculationDate = new Date(),
}) => {
  const loan = await PawnLoan.findById(loanId)
    .select(
  "loanNumber principalAmount issueDate maturityDate status settingsVersion settingsSnapshot"
)
    .session(session)
    .lean();

  if (!loan) {
    const error = new Error("Pawn loan not found");
    error.statusCode = 404;
    throw error;
  }

  if (loan.status !== "active") {
    const error = new Error(
      "Interest preview is available only for active loans"
    );
    error.statusCode = 409;
    throw error;
  }

  const interestSettings = loan.settingsSnapshot?.interest;

  if (!interestSettings) {
    const error = new Error(
      "Loan interest settings are missing"
    );
    error.statusCode = 409;
    throw error;
  }

  const period = calculateInterestPeriod({
    issueDate: loan.issueDate,
    calculationDate,
  });

  const paymentRecords = await PawnPayment.find({
    pawnLoan: loan._id,
    paidAt: { $lte: calculationDate },
  })
    .select("paidAt principalPaid interestPaid")
    .sort({ paidAt: 1, _id: 1 })
    .session(session)
    .lean();

  const payments = paymentRecords.map((payment) => ({
    paidAt: payment.paidAt.toISOString(),
    principalPaid: payment.principalPaid,
    interestPaid: payment.interestPaid,
  }));

  const {
    calculationMethod,
    principalCalculationMethod,
    minimumInterestDays,
    chargeFullFirstMonth,
    rate,
  } = interestSettings;

  if (
    !Number.isSafeInteger(minimumInterestDays) ||
    minimumInterestDays !== 0 ||
    chargeFullFirstMonth !== false
  ) {
    const error = new Error("Unsupported interest rules");
    error.statusCode = 409;
    throw error;
  }

  let result;

  if (
    principalCalculationMethod === "original_principal"
  ) {
    const originalResult = calculateLoanInterest({
      principalAmount: loan.principalAmount,
      interestSettings,
      months: period.months,
      days: period.days,
    });

    const balances = calculateOutstandingInterest({
      accruedInterest: originalResult.interestAmount,
      payments,
    });

    result = {
      ...originalResult,
      ...balances,
    };
  } else if (
    principalCalculationMethod === "remaining_principal" &&
    calculationMethod === "daily"
  ) {
    const remainingResult =
      calculateRemainingPrincipalDailyInterest({
        originalPrincipal: loan.principalAmount,
        issueDate: loan.issueDate.toISOString(),
        calculationDate: calculationDate.toISOString(),
        payments,
        monthlyRate: rate,
      });

    const balances = calculateOutstandingInterest({
      accruedInterest: remainingResult.accruedInterest,
      payments,
    });

    result = {
      ...remainingResult,
      ...balances,
    };
  } else {
    const error = new Error(
      "Unsupported interest calculation method"
    );
    error.statusCode = 409;
    throw error;
  }

  const preview = {
    loanNumber: loan.loanNumber,
    loanStatus: loan.status,
    issueDate: loan.issueDate,
    calculationDate,
    elapsedDays: period.days,
    chargedMonths:
      calculationMethod === "monthly"
        ? period.months
        : null,
    currency: "LKR",

    ...result,

    calculationMethod,
    principalCalculationMethod,
    isFinalSettlementAmount: false,
  };

  return {
    loan,
    payments,
    preview,
  };
};



 // GET /api/pawn-loans/:id/interest-preview

export const getPawnLoanInterestPreview = async (
  req,
  res
) => {
  if (
    !mongoose.isObjectIdOrHexString(req.params.id)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid pawn loan ID",
    });
  }

  let session;

  try {
    session = await mongoose.startSession();

    let preview;

    await session.withTransaction(
      async () => {
        const result =
          await calculatePawnLoanInterestPreview({
            loanId: req.params.id,
            session,
          });

        preview = result.preview;
      },
      {
        readConcern: { level: "snapshot" },
        readPreference: "primary",
      }
    );

    return res.status(200).json({
      success: true,
      preview,
    });
  } catch (error) {
    if (
      error.statusCode === 404 ||
      error.statusCode === 409
    ) {
      return res.status(error.statusCode).json({
        success: false,

        ...(error.statusCode === 409
          ? {
              code: "INTEREST_RULE_NOT_SUPPORTED",
            }
          : {}),

        message: error.message,
      });
    }

    const knownCalculationErrors = [
      "Minimum interest days and full first month rules are not yet supported",
      "Principal calculation method is not yet supported",
      "Total interest paid exceeds accrued interest",
    ];

    if (
      knownCalculationErrors.includes(error.message)
    ) {
      return res.status(409).json({
        success: false,
        code: "INTEREST_CALCULATION_CONFLICT",
        message:
          "Interest preview cannot be calculated with current loan data.",
      });
    }

    console.error(
      "Pawn Loan Interest Preview Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to calculate interest preview",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

