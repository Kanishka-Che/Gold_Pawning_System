
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    action: {
      type: String,
      required: true,
      immutable: true,
      enum: [
        "USER_CREATED",
        "USER_ACTIVATED",
        "USER_DEACTIVATED",
        "USER_ROLE_CHANGED",
        "USER_PASSWORD_RESET",
        "LOAN_SETTINGS_UPDATED",
        "GOLD_ITEM_CREATED",
"GOLD_ITEM_UPDATED",
"PAWN_LOAN_CREATED",
"PAWN_LOAN_CANCELLED",
"PAWN_LOAN_ACTIVATED",
"PAWN_PAYMENT_RECORDED",
      ],
    },

    targetType: {
      type: String,
      required: true,
      immutable: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },

    ipAddress: {
      type: String,
      default: null,
      immutable: true,
    },

    userAgent: {
      type: String,
      default: null,
      immutable: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  }
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({
  targetType: 1,
  targetId: 1,
  createdAt: -1,
});
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
