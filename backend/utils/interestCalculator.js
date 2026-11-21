

const toCents = (amount) => {
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new Error("Invalid monetary amount");
  }

  const cents = Math.round(amount * 100);

  if (
    !Number.isSafeInteger(cents) ||
    Math.abs(amount - cents / 100) > 1e-8
  ) {
    throw new Error(
      "Amount must have at most two decimal places"
    );
  }

  return cents;
};


const fromCents = (cents) => cents / 100;

// Monthly simple interest calculation
export const calculateMonthlyInterest = ({
  principalAmount,
  monthlyRate,
  months,
}) => {
  if (
    typeof monthlyRate !== "number" ||
    !Number.isFinite(monthlyRate) ||
    monthlyRate < 0 ||
    !Number.isInteger(months) ||
    months < 0
  ) {
    throw new Error("Invalid interest parameters");
  }

  const principalCents = toCents(principalAmount);

  const interestCents = Math.round(
    (principalCents * monthlyRate * months) / 100
  );

  
if (
  !Number.isSafeInteger(interestCents) ||
  !Number.isSafeInteger(
    principalCents + interestCents
  )
) {
  throw new Error(
    "Interest amount exceeds safe range"
  );
}


  return {
    principalAmount: fromCents(principalCents),
    interestAmount: fromCents(interestCents),
    totalAmount: fromCents(
      principalCents + interestCents
    ),
    monthlyRate,
    months,
  };
};



 // Daily simple interest calculation
// Assumption: monthlyRate is a percentage,
// and one interest month contains 30 days.

export const calculateDailyInterest = ({
  principalAmount,
  monthlyRate,
  days,
}) => {
  if (
    typeof monthlyRate !== "number" ||
    !Number.isFinite(monthlyRate) ||
    monthlyRate < 0 ||
    !Number.isSafeInteger(days) ||
    days < 0
  ) {
    throw new Error("Invalid daily interest parameters");
  }

  const principalCents = toCents(principalAmount);

  const interestCents = Math.round(
    (principalCents * monthlyRate * days) /
      (100 * 30)
  );

  if (
    !Number.isSafeInteger(interestCents) ||
    !Number.isSafeInteger(
      principalCents + interestCents
    )
  ) {
    throw new Error("Interest amount exceeds safe range");
  }

  return {
    principalAmount: fromCents(principalCents),
    interestAmount: fromCents(interestCents),
    totalAmount: fromCents(
      principalCents + interestCents
    ),
    monthlyRate,
    days,
    calculationMethod: "DAILY_30",
  };
};



export const calculateLoanInterest = ({
  principalAmount,
  interestSettings,
  months,
  days,
}) => {
  if (
    !interestSettings ||
    typeof interestSettings !== "object"
  ) {
    throw new Error("Interest settings are required");
  }

  const {
    rate,
    calculationMethod,
    minimumInterestDays,
    chargeFullFirstMonth,
  } = interestSettings;

  // Validate interest rate
  if (
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate < 0
  ) {
    throw new Error("Invalid interest rate");
  }

  // Validate minimum interest days
  if (
    !Number.isSafeInteger(minimumInterestDays) ||
    minimumInterestDays < 0
  ) {
    throw new Error("Invalid minimum interest days");
  }

  // Validate first month setting
  if (typeof chargeFullFirstMonth !== "boolean") {
    throw new Error("Invalid first month interest setting");
  }


  // Safety guard:
  // These interest rules are not implemented yet.
  // Do not silently calculate an incorrect amount.
  if (
    minimumInterestDays > 0 ||
    chargeFullFirstMonth === true
  ) {
    throw new Error(
      "Minimum interest days and full first month rules are not yet supported"
    );
  }


  // Principal calculation safety guard.
  // The shop owner has not confirmed the method yet.
  const principalMethod =
    interestSettings.principalCalculationMethod;

  if (principalMethod !== "original_principal") {
    throw new Error(
      "Principal calculation method is not yet supported"
    );
  }


  // Monthly interest calculation
  if (calculationMethod === "monthly") {
    if (!Number.isSafeInteger(months) || months < 0) {
      throw new Error("Invalid interest months");
    }

    return {
      ...calculateMonthlyInterest({
        principalAmount,
        monthlyRate: rate,
        months,
      }),
      calculationMethod: "monthly",
      minimumInterestDays,
      chargeFullFirstMonth,
    };
  }

  // Daily interest calculation
  if (calculationMethod === "daily") {
    if (!Number.isSafeInteger(days) || days < 0) {
      throw new Error("Invalid interest days");
    }

    return {
      ...calculateDailyInterest({
        principalAmount,
        monthlyRate: rate,
        days,
      }),
      calculationMethod: "daily",
      minimumInterestDays,
      chargeFullFirstMonth,
    };
  }

  throw new Error(
    "Unsupported interest calculation method"
  );
};




export const calculateInterestPeriod = ({
  issueDate,
  calculationDate = new Date(),
}) => {
  const start = new Date(issueDate);
  const end = new Date(calculationDate);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime())
  ) {
    throw new Error("Invalid loan dates");
  }

  if (end < start) {
    throw new Error(
      "Calculation date cannot be before issue date"
    );
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  // Convert to Sri Lanka calendar dates (UTC+05:30)
  const sriLankaOffset = 330 * 60 * 1000;

  const startDay = Math.floor(
    (start.getTime() + sriLankaOffset) /
      millisecondsPerDay
  );

  const endDay = Math.floor(
    (end.getTime() + sriLankaOffset) /
      millisecondsPerDay
  );

  const days = endDay - startDay;

  return {
    days,
    months: Math.ceil(days / 30),
  };
};

