
import express from "express";
import {
  getLoanSettings,
  updateLoanSettings,
} from "../controllers/loanSettingsController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All Loan Settings APIs require login
router.use(protect);

// GET - Admin can view loan settings
router.get("/", authorize("admin"), getLoanSettings);

// PUT - Admin can update loan settings
router.put("/", authorize("admin"), updateLoanSettings);

export default router;
