export const isValidMoney = (
  amount,
  { allowZero = false } = {}
) => {
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    (!allowZero && amount === 0)
  ) {
    return false;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(String(amount))) {
    return false;
  }

  const [whole, fraction = ""] =
    String(amount).split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  return (
    cents <= BigInt(Number.MAX_SAFE_INTEGER) &&
    (allowZero || cents > 0n)
  );
};