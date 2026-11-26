
import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema(
  {
    // One system settings configuration per shop
    settingsKey: {
      type: String,
      default: "default",
      unique: true,
      immutable: true,
      required: true,
    },

    // Shop Information
    shop: {
      name: {
        type: String,
        trim: true,
        default: "SIGIRI GOLD PAWNING",
        maxlength: 150,
      },

      address: {
        type: String,
        trim: true,
        default: "",
        maxlength: 500,
      },

      contactNumber: {
        type: String,
        trim: true,
        default: "",
        maxlength: 50,
      },

      email: {
        type: String,
        trim: true,
        default: "",
        maxlength: 150,
      },

      registrationNumber: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      logoUrl: {
        type: String,
        trim: true,
        default: "",
        maxlength: 500,
      },
    },


    // Pawn Ticket Settings
    pawnTicket: {
      title: {
        type: String,
        trim: true,
        default: "PAWN TICKET",
        maxlength: 100,
      },

      showTicketTitle: {
        type: Boolean,
        default: true,
      },

      language: {
        type: String,
        enum: ["en", "si", "both"],
        default: "en",
      },

      // Shop information visibility
      showLogo: {
        type: Boolean,
        default: false,
      },

      showShopAddress: {
        type: Boolean,
        default: true,
      },

      showShopContact: {
        type: Boolean,
        default: true,
      },

      // Logo customization
      logoPosition: {
        type: String,
        enum: ["left", "top", "right"],
        default: "left",
      },

      logoSize: {
        type: String,
        enum: ["small", "medium", "large"],
        default: "medium",
      },

      // Customer information visibility
      showCustomerContact: {
        type: Boolean,
        default: true,
      },

      // Gold item information visibility
      showGoldItemCode: {
        type: Boolean,
        default: true,
      },

      // Terms and conditions
      showTermsAndConditions: {
        type: Boolean,
        default: true,
      },

      termsAndConditions: {
        type: String,
        trim: true,
        default: "",
        maxlength: 5000,
      },

      // Customer signature
      showCustomerSignature: {
        type: Boolean,
        default: true,
      },

      customerSignatureLabel: {
        type: String,
        trim: true,
        default: "Customer Signature",
        maxlength: 100,
      },

      // Authorized signature
      showAuthorizedSignature: {
        type: Boolean,
        default: true,
      },

      authorizedSignatureLabel: {
        type: String,
        trim: true,
        default: "Authorized Signature",
        maxlength: 100,
      },
    },


    // Printing Settings
    printing: {
      paperSize: {
        type: String,
        enum: ["A4", "A5"],
        default: "A4",
      },

      layout: {
        type: String,
        enum: ["half_page", "full_page"],
        default: "half_page",
      },

      orientation: {
        type: String,
        enum: ["portrait", "landscape"],
        default: "portrait",
      },

      ticketPosition: {
        type: String,
        enum: ["top", "bottom"],
        default: "top",
      },

      marginMm: {
        type: Number,
        default: 5,
        min: 5,
        max: 15,
        validate: Number.isInteger,
      },

      fontSizePt: {
        type: Number,
        default: 9,
        min: 9,
        max: 14,
        validate: Number.isInteger,
      },

      copies: {
        type: Number,
        default: 1,
        min: 1,
        max: 3,
        validate: Number.isInteger,
      },

      showCuttingLine: {
        type: Boolean,
        default: false,
      },
    },

    // Settings Version
    version: {
      type: Number,
      default: 1,
      min: 1,
      validate: Number.isSafeInteger,
    },

    // Last Updated Admin
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "SystemSettings",
  systemSettingsSchema
);
