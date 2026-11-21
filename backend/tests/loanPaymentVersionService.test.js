
import test from "node:test";
import assert from "node:assert/strict";

import {
  incrementLoanPaymentVersion,
} from "../services/loanPaymentVersionService.js";

test(
  "Reject invalid loan payment version parameters",
  async () => {
    await assert.rejects(
      () =>
        incrementLoanPaymentVersion({
          loanId: "invalid",
          expectedVersion: 0,
          session: null,
        }),
      /Invalid loan payment version update parameters/
    );

    await assert.rejects(
      () =>
        incrementLoanPaymentVersion({
          loanId: "507f1f77bcf86cd799439011",
          expectedVersion: -1,
          session: null,
        }),
      /Invalid loan payment version update parameters/
    );

    await assert.rejects(
      () =>
        incrementLoanPaymentVersion({
          loanId: "507f1f77bcf86cd799439011",
          expectedVersion: 0,
          session: null,
        }),
      /Invalid loan payment version update parameters/
    );
  }
);
