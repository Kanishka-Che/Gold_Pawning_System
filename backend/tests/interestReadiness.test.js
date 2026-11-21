
import test from "node:test";
import assert from "node:assert/strict";

import {
  validateInterestReadiness,
} from "../utils/interestReadiness.js";

const validSettings = {
  rate: 2,
  calculationMethod: "monthly",
  principalCalculationMethod: "remaining_principal",
  minimumInterestDays: 0,
  chargeFullFirstMonth: false,
};

test("Accept configured interest settings", () => {
  const result = validateInterestReadiness(validSettings);

  assert.equal(result.ready, true);
  assert.equal(
    result.principalCalculationMethod,
    "remaining_principal"
  );
});

test("Accept daily calculation method", () => {
  const result = validateInterestReadiness({
    ...validSettings,
    calculationMethod: "daily",
  });

  assert.equal(result.calculationMethod, "daily");
});

test("Reject unconfirmed principal rule", () => {
  assert.throws(() =>
    validateInterestReadiness({
      ...validSettings,
      principalCalculationMethod: undefined,
    })
  );
});

test("Reject unsupported calculation method", () => {
  assert.throws(() =>
    validateInterestReadiness({
      ...validSettings,
      calculationMethod: "unknown",
    })
  );
});

test("Reject negative interest rate", () => {
  assert.throws(() =>
    validateInterestReadiness({
      ...validSettings,
      rate: -2,
    })
  );
});

test("Reject invalid minimum interest days", () => {
  assert.throws(() =>
    validateInterestReadiness({
      ...validSettings,
      minimumInterestDays: -1,
    })
  );
});

test("Reject missing first month setting", () => {
  assert.throws(() =>
    validateInterestReadiness({
      ...validSettings,
      chargeFullFirstMonth: undefined,
    })
  );
});
