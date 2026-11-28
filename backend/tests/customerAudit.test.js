import test from "node:test";
import assert from "node:assert/strict";

import {
  getCustomerChangedFields,
  getCustomerStatusAuditAction,
} from "../utils/customerAudit.js";

const customer = {
  customerCode: "CUS0001",
  fullName: "Test Customer",
  nic: "991234567V",
  phone: "0771234567",
  address: "Colombo",
  status: "active",
};

// Test 01
test("Detect changed customer name", () => {
  const result = getCustomerChangedFields(
    customer,
    {
      fullName: "Updated Customer",
    }
  );

  assert.deepEqual(result, ["fullName"]);
});

// Test 02
test("Detect changed customer NIC", () => {
  const result = getCustomerChangedFields(
    customer,
    {
      nic: "981234567V",
    }
  );

  assert.deepEqual(result, ["nic"]);
});

// Test 03
test("Detect changed phone number", () => {
  const result = getCustomerChangedFields(
    customer,
    {
      phone: "0711234567",
    }
  );

  assert.deepEqual(result, ["phone"]);
});

// Test 04
test("Detect changed customer address", () => {
  const result = getCustomerChangedFields(
    customer,
    {
      address: "Kandy",
    }
  );

  assert.deepEqual(result, ["address"]);
});

// Test 05
test("Detect multiple changed fields", () => {
  const result = getCustomerChangedFields(
    customer,
    {
      fullName: "Updated Customer",
      phone: "0711234567",
      address: "Kandy",
    }
  );

  assert.deepEqual(result, [
    "fullName",
    "phone",
    "address",
  ]);
});

// Test 06
test("Return no changes for identical values", () => {
  const result = getCustomerChangedFields(
    customer,
    {
      fullName: customer.fullName,
      nic: customer.nic,
      phone: customer.phone,
      address: customer.address,
    }
  );

  assert.deepEqual(result, []);
});

// Test 07
test("Ignore non-editable customer fields", () => {
  const result = getCustomerChangedFields(
    customer,
    {
      customerCode: "CUS9999",
      status: "inactive",
      createdAt: new Date(),
    }
  );

  assert.deepEqual(result, []);
});

// Test 08
test("Ignore missing update fields", () => {
  const result = getCustomerChangedFields(
    customer,
    {}
  );

  assert.deepEqual(result, []);
});

// Test 09
test("Reject invalid customer audit data", () => {
  assert.throws(
    () =>
      getCustomerChangedFields(
        null,
        {}
      ),
    /Invalid customer audit data/
  );
});

// Test 10
test("Reject invalid updated values", () => {
  assert.throws(
    () =>
      getCustomerChangedFields(
        customer,
        null
      ),
    /Invalid customer audit data/
  );
});

// Test 11
test("Generate customer activation action", () => {
  assert.equal(
    getCustomerStatusAuditAction(
      "inactive",
      "active"
    ),
    "CUSTOMER_ACTIVATED"
  );
});

// Test 12
test("Generate customer deactivation action", () => {
  assert.equal(
    getCustomerStatusAuditAction(
      "active",
      "inactive"
    ),
    "CUSTOMER_DEACTIVATED"
  );
});

// Test 13
test("Ignore repeated active status", () => {
  assert.equal(
    getCustomerStatusAuditAction(
      "active",
      "active"
    ),
    null
  );
});

// Test 14
test("Ignore repeated inactive status", () => {
  assert.equal(
    getCustomerStatusAuditAction(
      "inactive",
      "inactive"
    ),
    null
  );
});

// Test 15
test("Reject invalid previous customer status", () => {
  assert.throws(
    () =>
      getCustomerStatusAuditAction(
        "deleted",
        "active"
      ),
    /Invalid customer status/
  );
});

// Test 16
test("Reject invalid new customer status", () => {
  assert.throws(
    () =>
      getCustomerStatusAuditAction(
        "active",
        "deleted"
      ),
    /Invalid customer status/
  );
});