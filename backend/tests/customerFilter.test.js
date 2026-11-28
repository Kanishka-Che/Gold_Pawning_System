import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerFilter,
} from "../utils/customerFilter.js";

// Test 01
test("Return all customers without filters", () => {
  assert.deepEqual(
    buildCustomerFilter({}),
    {}
  );
});

// Test 02
test("Accept all status filter", () => {
  assert.deepEqual(
    buildCustomerFilter({ status: "all" }),
    {}
  );
});

// Test 03
test("Filter active customers", () => {
  assert.deepEqual(
    buildCustomerFilter({ status: "active" }),
    { status: "active" }
  );
});

// Test 04
test("Filter inactive customers", () => {
  assert.deepEqual(
    buildCustomerFilter({ status: "inactive" }),
    { status: "inactive" }
  );
});

// Test 05
test("Reject invalid customer status", () => {
  assert.throws(
    () =>
      buildCustomerFilter({
        status: "deleted",
      }),
    /Status must be all, active or inactive/
  );
});

// Test 06
test("Reject multiple status values", () => {
  assert.throws(
    () =>
      buildCustomerFilter({
        status: ["active", "inactive"],
      }),
    /Status must be all, active or inactive/
  );
});

// Test 07
test("Search customer name code NIC and phone", () => {
  const filter = buildCustomerFilter({
    search: "CUS0001",
  });

  assert.deepEqual(filter.$or, [
    {
      fullName: {
        $regex: "CUS0001",
        $options: "i",
      },
    },
    {
      customerCode: {
        $regex: "CUS0001",
        $options: "i",
      },
    },
    {
      nic: {
        $regex: "CUS0001",
        $options: "i",
      },
    },
    {
      phone: {
        $regex: "CUS0001",
      },
    },
  ]);
});

// Test 08
test("Combine search and status filters", () => {
  const filter = buildCustomerFilter({
    status: "active",
    search: "CUS",
  });

  assert.equal(filter.status, "active");
  assert.equal(filter.$or.length, 4);
  assert.equal(
    filter.$or[1].customerCode.$regex,
    "CUS"
  );
});

// Test 09
test("Escape regex special characters", () => {
  const filter = buildCustomerFilter({
    search: ".*",
  });

  assert.equal(
    filter.$or[0].fullName.$regex,
    "\\.\\*"
  );
});

// Test 10
test("Trim customer search text", () => {
  const filter = buildCustomerFilter({
    search: "  CUS0001  ",
  });

  assert.equal(
    filter.$or[1].customerCode.$regex,
    "CUS0001"
  );
});

// Test 11
test("Ignore empty customer search", () => {
  assert.deepEqual(
    buildCustomerFilter({
      search: "   ",
    }),
    {}
  );
});

// Test 12
test("Reject excessive search length", () => {
  assert.throws(
    () =>
      buildCustomerFilter({
        search: "a".repeat(101),
      }),
    /Invalid customer search/
  );
});

// Test 13
test("Reject invalid search type", () => {
  assert.throws(
    () =>
      buildCustomerFilter({
        search: 12345,
      }),
    /Invalid customer search/
  );
});

// Test 14
test("Reject search query operator objects", () => {
  assert.throws(
    () =>
      buildCustomerFilter({
        search: {
          $ne: null,
        },
      }),
    /Invalid customer search/
  );
});