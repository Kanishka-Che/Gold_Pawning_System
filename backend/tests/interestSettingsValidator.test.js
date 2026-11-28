import test from "node:test";
import assert from "node:assert/strict";

import {
  validateSupportedInterestSettings,
} from "../utils/interestSettingsValidator.js";

const validSettings = {
  rate: 3,
  calculationMethod: "monthly",
  principalCalculationMethod: "original_principal",
  minimumInterestDays: 0,
  chargeFullFirstMonth: false,
};

test("Accept monthly original principal", () => {
  assert.equal(
    validateSupportedInterestSettings(validSettings),
    true
  );
});

test("Accept daily original principal", () => {
  assert.equal(
    validateSupportedInterestSettings({
      ...validSettings,
      calculationMethod: "daily",
    }),
    true
  );
});

test("Accept daily remaining principal", () => {
  assert.equal(
    validateSupportedInterestSettings({
      ...validSettings,
      calculationMethod: "daily",
      principalCalculationMethod: "remaining_principal",
    }),
    true
  );
});

test("Reject monthly remaining principal", () => {
  assert.throws(() =>
    validateSupportedInterestSettings({
      ...validSettings,
      principalCalculationMethod: "remaining_principal",
    })
  );
});

test("Reject unsupported minimum interest days", () => {
  assert.throws(() =>
    validateSupportedInterestSettings({
      ...validSettings,
      minimumInterestDays: 7,
    })
  );
});

test("Reject full first month interest", () => {
  assert.throws(() =>
    validateSupportedInterestSettings({
      ...validSettings,
      chargeFullFirstMonth: true,
    })
  );
});

test("Reject negative interest rate", () => {
  assert.throws(() =>
    validateSupportedInterestSettings({
      ...validSettings,
      rate: -3,
    })
  );
});

test("Reject interest rate above maximum", () => {
  assert.throws(() =>
    validateSupportedInterestSettings({
      ...validSettings,
      rate: 101,
    })
  );
});

test("Reject excessive rate decimal places", () => {
  assert.throws(() =>
    validateSupportedInterestSettings({
      ...validSettings,
      rate: 3.12345,
    })
  );
});

test("Accept valid decimal interest rate", () => {
  assert.equal(
    validateSupportedInterestSettings({
      ...validSettings,
      rate: 3.125,
    }),
    true
  );
});

test("Reject missing principal calculation method", () => {
  assert.throws(() =>
    validateSupportedInterestSettings({
      ...validSettings,
      principalCalculationMethod: undefined,
    })
  );
});

test("Reject invalid interest settings", () => {
  assert.throws(() =>
    validateSupportedInterestSettings(null)
  );
});