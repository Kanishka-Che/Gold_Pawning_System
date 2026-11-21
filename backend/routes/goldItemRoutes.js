
import express from "express";

import {
  createGoldItem,
  getGoldItems,
  getGoldItemById,
  updateGoldItem,
} from "../controllers/goldItemController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All gold item routes require authentication
router.use(protect);

// Admin and Staff can create and view gold items
router.post(
  "/",
  authorize("admin", "staff"),
  createGoldItem
);

router.get(
  "/",
  authorize("admin", "staff"),
  getGoldItems
);

router.get(
  "/:id",
  authorize("admin", "staff"),
  getGoldItemById
);

// Only draft gold items can be edited
router.patch(
  "/:id",
  authorize("admin", "staff"),
  updateGoldItem
);

export default router;
