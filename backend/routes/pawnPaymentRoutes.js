import express from "express";

import {
  createPawnPayment,
} from "../controllers/pawnPaymentController.js";

import {
  previewPawnPayment,
} from "../controllers/pawnPaymentPreviewController.js";

import {
  getPawnPayments,
  getPawnPaymentSummary,
} from "../controllers/pawnPaymentListController.js";

import {
  getPawnPaymentById,
} from "../controllers/pawnPaymentDetailsController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required
router.use(protect);

// Read-only payment calculation preview
// No financial transaction is recorded
router.post(
  "/preview",
  authorize("admin", "staff"),
  previewPawnPayment
);

// Read-only payment summary
router.get(
  "/summary",
  authorize("admin", "staff"),
  getPawnPaymentSummary
);

// Read-only payment list
router.get(
  "/",
  authorize("admin", "staff"),
  getPawnPayments
);

// Read-only payment details
router.get(
  "/:id",
  authorize("admin", "staff"),
  getPawnPaymentById
);

// Existing payment request endpoint
// Actual payment posting remains disabled
router.post(
  "/",
  authorize("admin", "staff"),
  createPawnPayment
);

export default router;