
import test from "node:test";
import assert from "node:assert/strict";

import {
  validateInterestPrincipalMethod,
  getInterestPrincipalBase,
} from "../utils/interestRuleValidator.js";

test("Accept original principal method", () => {
  assert.equal(
    validateInterestPrincipalMethod("original_principal"),
    "original_principal"
  );
});

test("Accept remaining principal method", () => {
  assert.equal(
    validateInterestPrincipalMethod("remaining_principal"),
    "remaining_principal"
  );
});

test("Reject unconfirmed method", () => {
  assert.throws(
    () => validateInterestPrincipalMethod(undefined),
    /Invalid or unconfirmed/
  );
});

test("Reject unsupported method", () => {
  assert.throws(
    () => validateInterestPrincipalMethod("unknown"),
    /Invalid or unconfirmed/
  );
});

test("Select original principal", () => {
  const result = getInterestPrincipalBase({
    originalPrincipal: "100000.00",
    outstandingPrincipal: "80000.00",
    method: "original_principal",
  });

  assert.equal(result, "100000.00");
});

test("Select outstanding principal", () => {
  const result = getInterestPrincipalBase({
    originalPrincipal: "100000.00",
    outstandingPrincipal: "80000.00",
    method: "remaining_principal",
  });

  assert.equal(result, "80000.00");
});

test("Reject outstanding principal above original", () => {
  assert.throws(() =>
    getInterestPrincipalBase({
      originalPrincipal: "100000.00",
      outstandingPrincipal: "120000.00",
      method: "remaining_principal",
    })
  );
});

test("Reject negative principal", () => {
  assert.throws(() =>
    getInterestPrincipalBase({
      originalPrincipal: "-1000.00",
      outstandingPrincipal: "500.00",
      method: "remaining_principal",
    })
  );
});
