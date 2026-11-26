
import mongoose from "mongoose";

const goldItemSchema = new mongoose.Schema(
  {


goldItemCode: {
  type: String,
  trim: true,
  unique: true,
  sparse: true,
  immutable: true,
  match: /^GLD-\d{6,}$/,
},


    itemType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    karat: {
      type: String,
      required: true,
      enum: ["18K", "21K", "22K", "24K", "OTHER"],
    },

    grossWeight: {
      type: Number,
      required: true,
      min: 0,
    },

    deductionWeight: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    netWeight: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["draft", "pledged", "released"],
      default: "draft",
    },


reservedForLoan: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "PawnLoan",
  default: null,
},


    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validate weights
goldItemSchema.pre("validate", function () {
  if (
    this.grossWeight != null &&
    this.deductionWeight != null
  ) {
    if (this.grossWeight <= 0) {
      this.invalidate(
        "grossWeight",
        "Gross weight must be greater than zero"
      );
    }

    if (this.deductionWeight >= this.grossWeight) {
      this.invalidate(
        "deductionWeight",
        "Deduction weight must be less than gross weight"
      );
    }

    this.netWeight =
      Math.round(
        (this.grossWeight - this.deductionWeight) * 1000
      ) / 1000;
  }
});

goldItemSchema.index({ status: 1, createdAt: -1 });

const GoldItem = mongoose.model("GoldItem", goldItemSchema);

export default GoldItem;
