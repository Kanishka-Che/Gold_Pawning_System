
import test from "node:test";
import assert from "node:assert/strict";

import {
  allocatePawnPayment,
} from "../utils/paymentAllocation.js";

// Test 1 - Interest First
test("Interest first payment allocation", () => {
  const result = allocatePawnPayment({
    paymentAmount: "20000.00",
    outstandingPrincipal: "100000.00",
    outstandingInterest: "5000.00",
    allocationMethod: "interest_first",
  });

  assert.equal(result.interestPaid, "5000.00");
  assert.equal(result.principalPaid, "15000.00");
  assert.equal(result.remainingInterest, "0.00");
  assert.equal(result.remainingPrincipal, "85000.00");
  assert.equal(result.totalAllocated, "20000.00");
});

// Test 2 - Principal First
test("Principal first payment allocation", () => {
  const result = allocatePawnPayment({
    paymentAmount: "20000.00",
    outstandingPrincipal: "100000.00",
    outstandingInterest: "5000.00",
    allocationMethod: "principal_first",
  });

  assert.equal(result.principalPaid, "20000.00");
  assert.equal(result.interestPaid, "0.00");
  assert.equal(result.remainingPrincipal, "80000.00");
  assert.equal(result.remainingInterest, "5000.00");
});

// Test 3 - Full Settlement
test("Full outstanding balance payment", () => {
  const result = allocatePawnPayment({
    paymentAmount: "105000.00",
    outstandingPrincipal: "100000.00",
    outstandingInterest: "5000.00",
    allocationMethod: "interest_first",
  });

  assert.equal(result.remainingPrincipal, "0.00");
  assert.equal(result.remainingInterest, "0.00");
});

// Test 4 - Reject Overpayment
test("Reject payment exceeding balance", () => {
  assert.throws(() => {
    allocatePawnPayment({
      paymentAmount: "110000.00",
      outstandingPrincipal: "100000.00",
      outstandingInterest: "5000.00",
      allocationMethod: "interest_first",
    });
  }, /Payment exceeds outstanding balance/);
});

// Test 5 - Reject Zero Payment
test("Reject zero payment", () => {
  assert.throws(() => {
    allocatePawnPayment({
      paymentAmount: "0.00",
      outstandingPrincipal: "100000.00",
      outstandingInterest: "5000.00",
      allocationMethod: "interest_first",
    });
  }, /Payment must be greater than zero/);
});

// Test 6 - Reject Invalid Method
test("Reject invalid allocation method", () => {
  assert.throws(() => {
    allocatePawnPayment({
      paymentAmount: "1000.00",
      outstandingPrincipal: "100000.00",
      outstandingInterest: "5000.00",
      allocationMethod: "invalid_method",
    });
  }, /Unsupported payment allocation method/);
});

// Test 7 - Exact Decimal Calculation
test("Exact decimal payment allocation", () => {
  const result = allocatePawnPayment({
    paymentAmount: "0.30",
    outstandingPrincipal: "1.00",
    outstandingInterest: "0.10",
    allocationMethod: "interest_first",
  });

  assert.equal(result.interestPaid, "0.10");
  assert.equal(result.principalPaid, "0.20");
  assert.equal(result.totalAllocated, "0.30");
});

// Test 8 - Reject Invalid Precision
test("Reject more than two decimal places", () => {
  assert.throws(() => {
    allocatePawnPayment({
      paymentAmount: "100.999",
      outstandingPrincipal: "1000.00",
      outstandingInterest: "100.00",
      allocationMethod: "interest_first",
    });
  }, /at most 2 decimal places/);
});

// Test 9 - Interest Only Payment
test("Interest only partial payment", () => {
  const result = allocatePawnPayment({
    paymentAmount: "2000.00",
    outstandingPrincipal: "100000.00",
    outstandingInterest: "5000.00",
    allocationMethod: "interest_first",
  });

  assert.equal(result.interestPaid, "2000.00");
  assert.equal(result.principalPaid, "0.00");
  assert.equal(result.remainingInterest, "3000.00");
  assert.equal(result.remainingPrincipal, "100000.00");
});

// Test 10 - Reject Negative Payment
test("Reject negative payment amount", () => {
  assert.throws(() => {
    allocatePawnPayment({
      paymentAmount: "-100.00",
      outstandingPrincipal: "100000.00",
      outstandingInterest: "5000.00",
      allocationMethod: "interest_first",
    });
  });
});
