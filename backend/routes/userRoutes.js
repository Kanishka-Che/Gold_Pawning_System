
import express from "express";

import {
  createUser,
  getAllUsers,
  updateUserStatus,
  resetUserPassword,
  updateUserRole,
} from "../controllers/userController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Admin only routes
router.get("/", authorize("admin"), getAllUsers);
router.post("/", authorize("admin"), createUser);

router.patch(
  "/:id/status",
  authorize("admin"),
  updateUserStatus
);

router.patch(
  "/:id/reset-password",
  authorize("admin"),
  resetUserPassword
);

router.patch(
  "/:id/role",
  authorize("admin"),
  updateUserRole
);

export default router;
