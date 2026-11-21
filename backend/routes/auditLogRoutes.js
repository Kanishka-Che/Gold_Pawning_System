
import express from "express";

import { getAuditLogs } from "../controllers/auditLogController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required
router.use(protect);

// Admin only - View audit history
router.get("/", authorize("admin"), getAuditLogs);

export default router;
