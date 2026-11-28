import test from "node:test";
import assert from "node:assert/strict";

import {
  isValidMoney,
} from "../utils/moneyValidator.js";

test("Accept valid whole amount", () => {
  assert.equal(isValidMoney(10000), true);
});

test("Accept valid decimal amount", () => {
  assert.equal(isValidMoney(10.12), true);
});

test("Accept minimum positive amount", () => {
  assert.equal(isValidMoney(0.01), true);
});

test("Reject more than two decimal places", () => {
  assert.equal(isValidMoney(100.123), false);
});

test("Reject zero loan amount", () => {
  assert.equal(isValidMoney(0), false);
});

test("Allow zero when explicitly permitted", () => {
  assert.equal(
    isValidMoney(0, { allowZero: true }),
    true
  );
});

test("Reject negative amount", () => {
  assert.equal(isValidMoney(-500), false);
});

test("Reject string amount", () => {
  assert.equal(isValidMoney("1000"), false);
});

test("Reject invalid numeric amounts", () => {
  assert.equal(isValidMoney(NaN), false);
  assert.equal(isValidMoney(Infinity), false);
});

test("Reject unsafe monetary amount", () => {
  assert.equal(
    isValidMoney(Number.MAX_SAFE_INTEGER),
    false
  );
});