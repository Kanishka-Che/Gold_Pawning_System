
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";

import {
  updateLoanSettings,
} from "../controllers/loanSettingsController.js";

function mockResponse() {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },
  };
}

const invalidCases = [
  {
    name: "Reject string partial interest setting",
    body: {
      partialPayment: {
        allowPartialInterest: "yes",
      },
    },
  },
  {
    name: "Reject numeric partial principal setting",
    body: {
      partialPayment: {
        allowPartialPrincipal: 123,
      },
    },
  },
  {
    name: "Reject null partial interest setting",
    body: {
      partialPayment: {
        allowPartialInterest: null,
      },
    },
  },
  {
    name: "Reject unexpected partial payment setting",
    body: {
      partialPayment: {
        unknownOption: true,
      },
    },
  },
];

for (const scenario of invalidCases) {
  test(scenario.name, async () => {
    const req = {
      body: scenario.body,
    };

    const res = mockResponse();

    await updateLoanSettings(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);

    console.log(`${scenario.name}: PASSED`);
  });
}
