import GoldItem from "../models/GoldItem.js";

export const INVENTORY_STATUSES = [
  "all",
  "draft",
  "pledged",
  "released",
];

export const INVENTORY_KARATS = [
  "all",
  "18K",
  "21K",
  "22K",
  "24K",
  "OTHER",
];

const KARATS = INVENTORY_KARATS.filter(
  (value) => value !== "all"
);

const createWeightBucket = () => ({
  itemCount: 0,
  validWeightCount: 0,
  invalidWeightCount: 0,

  grossWeight: 0n,
  deductionWeight: 0n,
  netWeight: 0n,
});

const toMilligrams = (value) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error("Invalid gold weight");
  }

  const scaled = value * 1000;
  const rounded = Math.round(scaled);

  if (
    !Number.isSafeInteger(rounded) ||
    Math.abs(scaled - rounded) > 1e-7
  ) {
    throw new Error(
      "Gold weight must have at most 3 decimal places"
    );
  }

  return BigInt(rounded);
};

const formatWeight = (value) => {
  return (
    (value / 1000n).toString() +
    "." +
    (value % 1000n)
      .toString()
      .padStart(3, "0")
  );
};

const calculateItemWeights = (item) => {
  const grossWeight = toMilligrams(
    item.grossWeight
  );

  const deductionWeight = toMilligrams(
    item.deductionWeight
  );

  const netWeight = toMilligrams(
    item.netWeight
  );

  if (
    grossWeight <= 0n ||
    deductionWeight >= grossWeight ||
    netWeight !== grossWeight - deductionWeight
  ) {
    throw new Error(
      "Gold item weights are inconsistent"
    );
  }

  return {
    grossWeight,
    deductionWeight,
    netWeight,
  };
};

const addItemToBucket = (bucket, weights) => {
  bucket.itemCount += 1;

  if (!weights) {
    bucket.invalidWeightCount += 1;
    return;
  }

  bucket.validWeightCount += 1;

  bucket.grossWeight += weights.grossWeight;

  bucket.deductionWeight +=
    weights.deductionWeight;

  bucket.netWeight += weights.netWeight;
};

const serializeWeightBucket = (bucket) => {
  const complete =
    bucket.invalidWeightCount === 0;

  return {
    itemCount: bucket.itemCount,

    validWeightCount:
      bucket.validWeightCount,

    invalidWeightCount:
      bucket.invalidWeightCount,

    totalGrossWeight: complete
      ? formatWeight(bucket.grossWeight)
      : null,

    totalDeductionWeight: complete
      ? formatWeight(bucket.deductionWeight)
      : null,

    totalNetWeight: complete
      ? formatWeight(bucket.netWeight)
      : null,

    knownGrossWeight:
      formatWeight(bucket.grossWeight),

    knownDeductionWeight:
      formatWeight(bucket.deductionWeight),

    knownNetWeight:
      formatWeight(bucket.netWeight),

    isWeightTotalComplete: complete,
  };
};

const getReservationWarning = (item) => {
  if (item.status !== "pledged") {
    return null;
  }

  const loan = item.reservedForLoan;

  if (!loan) {
    return "Pledged item has no linked pawn loan";
  }

  if (loan.status !== "active") {
    return "Pledged item is linked to a non-active loan";
  }

  const belongsToLoan =
    Array.isArray(loan.goldItems) &&
    loan.goldItems.some(
      (id) => String(id) === String(item._id)
    );

  if (!belongsToLoan) {
    return "Gold item is missing from the linked loan";
  }

  return null;
};

export const buildGoldInventoryReport = async ({
  session,
  status,
  karat,
  search,
  page,
  limit,
}) => {
  const filter = {};

  if (status !== "all") {
    filter.status = status;
  }

  if (karat !== "all") {
    filter.karat = karat;
  }

  const normalizedSearch =
    search.trim().toLowerCase();

  const totals = createWeightBucket();

  const statusCounts = {
    draft: 0,
    pledged: 0,
    released: 0,
    unknown: 0,
  };

  const karatBuckets = new Map(
    [...KARATS, "UNKNOWN"].map((value) => [
      value,
      createWeightBucket(),
    ])
  );

  const records = [];

  let total = 0;
  let missingItemCodeCount = 0;
  let reservationWarningCount = 0;

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const cursor = GoldItem.find(filter)
    .select(
      "_id goldItemCode itemType description " +
      "karat grossWeight deductionWeight " +
      "netWeight status reservedForLoan " +
      "createdAt createdBy"
    )
    .populate({
      path: "reservedForLoan",

      select:
        "loanNumber customer status goldItems",

      populate: {
        path: "customer",
        select: "customerCode fullName",
      },
    })
    .populate("createdBy", "username")
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .session(session)
    .lean()
    .cursor({ batchSize: 200 });

  try {
    for await (const item of cursor) {
      const loan = item.reservedForLoan;

      if (normalizedSearch) {
        const searchableValues = [
          item.goldItemCode,
          item.itemType,
          item.description,
          loan?.loanNumber,
          loan?.customer?.customerCode,
          loan?.customer?.fullName,
        ];

        const matches = searchableValues.some(
          (value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(normalizedSearch)
        );

        if (!matches) continue;
      }

      let weights = null;
      let weightError = null;

      try {
        weights = calculateItemWeights(item);
      } catch (error) {
        weightError = error.message;
      }

      addItemToBucket(totals, weights);

      const statusKey =
        Object.hasOwn(statusCounts, item.status)
          ? item.status
          : "unknown";

      statusCounts[statusKey] += 1;

      const karatKey =
        karatBuckets.has(item.karat)
          ? item.karat
          : "UNKNOWN";

      addItemToBucket(
        karatBuckets.get(karatKey),
        weights
      );

      if (!item.goldItemCode) {
        missingItemCodeCount += 1;
      }

      const reservationWarning =
        getReservationWarning(item);

      if (reservationWarning) {
        reservationWarningCount += 1;
      }

      if (
        total >= startIndex &&
        total < endIndex
      ) {
        records.push({
          id: item._id,

          goldItemCode:
            item.goldItemCode ?? null,

          itemType: item.itemType,

          description:
            item.description ?? "",

          karat: item.karat,

          grossWeight: weights
            ? formatWeight(weights.grossWeight)
            : null,

          deductionWeight: weights
            ? formatWeight(weights.deductionWeight)
            : null,

          netWeight: weights
            ? formatWeight(weights.netWeight)
            : null,

          status: item.status,

          pawnLoanId:
            loan?._id ?? null,

          loanNumber:
            loan?.loanNumber ?? null,

          loanStatus:
            loan?.status ?? null,

          customer:
            loan?.customer ?? null,

          createdAt: item.createdAt,

          createdBy:
            item.createdBy?.username ?? null,

          weightError,

          reservationWarning,
        });
      }

      total += 1;
    }
  } finally {
    await cursor.close();
  }

  const karatBreakdown = Array.from(
    karatBuckets.entries()
  ).map(([karat, bucket]) => ({
    karat,
    ...serializeWeightBucket(bucket),
  }));

  return {
    summary: {
      totalItems: total,

      statusCounts,

      ...serializeWeightBucket(totals),

      missingItemCodeCount,

      reservationWarningCount,

      karatBreakdown,
    },

    records,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};