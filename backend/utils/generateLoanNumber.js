
import Counter from "../models/Counter.js";

export const generateLoanNumber = async (session) => {
  if (!session) {
    throw new Error(
      "Database transaction session is required"
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

  const sequence = String(counter.sequence).padStart(
    6,
    "0"
  );

  return `SIG-${year}-${sequence}`;
};
