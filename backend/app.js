
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import customerRoutes from "./routes/customerRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import loanSettingsRoutes from "./routes/loanSettingsRoutes.js";
import systemSettingsRoutes from "./routes/systemSettingsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import goldItemRoutes from "./routes/goldItemRoutes.js";
import pawnLoanRoutes from "./routes/pawnLoanRoutes.js";
import pawnPaymentRoutes from "./routes/pawnPaymentRoutes.js";
import pawnRenewalRoutes from "./routes/pawnRenewalRoutes.js";
import pawnRedemptionRoutes from "./routes/pawnRedemptionRoutes.js";
import pawnOverdueRoutes from "./routes/pawnOverdueRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";

const app = express();

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:3002";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));

// CSRF Origin Check
app.use((req, res, next) => {
  const protectedMethods = [
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ];

  if (!protectedMethods.includes(req.method)) {
    return next();
  }

  const origin = req.get("Origin");

  if (origin !== CLIENT_URL) {
    return res.status(403).json({
      success: false,
      message: "Request origin not allowed",
    });
  }

  next();
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Sigiri Pawning API is running",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/loan-settings", loanSettingsRoutes);
app.use("/api/system-settings", systemSettingsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/gold-items", goldItemRoutes);
app.use("/api/pawn-loans", pawnLoanRoutes);
app.use("/api/pawn-payments", pawnPaymentRoutes);
app.use("/api/pawn-renewals", pawnRenewalRoutes);
app.use(
  "/api/pawn-redemptions",
  pawnRedemptionRoutes
);
app.use("/api/pawn-overdue", pawnOverdueRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);

export default app;
