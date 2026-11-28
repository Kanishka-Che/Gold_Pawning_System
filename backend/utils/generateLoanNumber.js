import Counter from "../models/Counter.js";

export const generateLoanNumber = async (session) => {
  if (!session || !session.inTransaction()) {
    throw new Error(
      "Active database transaction is required"
    );
  }

  // Sri Lanka local year
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
  }).format(new Date());

  const counter = await Counter.findOneAndUpdate(
    {
      _id: `pawn-loan-${year}`,
    },
    {
      $inc: {
        sequence: 1,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      session,
    }
  );

  if (
    !counter ||
    !Number.isSafeInteger(counter.sequence) ||
    counter.sequence < 1
  ) {
    throw new Error(
      "Invalid pawn loan number sequence"
    );
  }

  const sequence = String(
    counter.sequence
  ).padStart(6, "0");

  return `SIG-${year}-${sequence}`;
};