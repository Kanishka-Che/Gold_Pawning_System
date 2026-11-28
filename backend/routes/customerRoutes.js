import express from "express";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  updateCustomerStatus,
  lookupLegacyCustomer,
} from "../controllers/customerController.js";

const router = express.Router();

router.use(protect, authorize("admin", "staff"));

// Legacy customer lookup - Admin only
router.post(
  "/legacy-lookup",
  authorize("admin"),
  lookupLegacyCustomer
);

// Existing customer routes
router.post("/", createCustomer);

router.get("/", getCustomers);

router.get("/:id", getCustomerById);

router.put("/:id", updateCustomer);

// Activate / Deactivate customer
router.patch("/:id/status", updateCustomerStatus);

export default router;