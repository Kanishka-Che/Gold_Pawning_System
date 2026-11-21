
import express from "express";

import {
  createPawnPayment,
} from "../controllers/pawnPaymentController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All payment routes require authentication
router.use(protect);

// Admin and Staff can submit payment requests
router.post(
  "/",
  authorize("admin", "staff"),
  createPawnPayment
);

export default router;
