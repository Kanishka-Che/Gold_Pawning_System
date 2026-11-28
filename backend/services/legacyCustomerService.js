import mongoose from "mongoose";
import Customer from "../models/Customer.js";

export class LegacyCustomerError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "LegacyCustomerError";
    this.statusCode = statusCode;
  }
}

// Normalize and validate NIC
export const normalizeLegacyCustomerNic = (value) => {
  if (typeof value !== "string") {
    throw new LegacyCustomerError(
      "Customer NIC is required"
    );
  }

  const nic = value.trim().toUpperCase();

  if (!/^(?:[0-9]{9}[VX]|[0-9]{12})$/.test(nic)) {
    throw new LegacyCustomerError(
      "Invalid customer NIC format"
    );
  }

  return nic;
};

// Check customer information
export const getLegacyCustomerEligibility = (customer) => {
  const requiredFields = [
    "fullName",
    "nic",
    "phone",
    "address",
  ];

  const missingFields = requiredFields.filter(
    (field) =>
      typeof customer[field] !== "string" ||
      !customer[field].trim()
  );

  const isActive = customer.status === "active";

  return {
    canLink: isActive && missingFields.length === 0,
    requiresReactivation: !isActive,
    requiresInformationUpdate: missingFields.length > 0,
    missingFields,
  };
};

// Find existing customer by NIC
export const findLegacyCustomerByNic = async ({
  nic,
  session = null,
}) => {
  const normalizedNic =
    normalizeLegacyCustomerNic(nic);

  const query = Customer.findOne({
    nic: normalizedNic,
  }).select(
    "_id customerCode fullName nic phone address status"
  );

  if (session) {
    query.session(session);
  }

  return await query.lean();
};

// Validate customer before linking a legacy loan
export const validateLegacyLoanCustomer = async ({
  customerId,
  session = null,
}) => {
  if (
    typeof customerId !== "string" ||
    !mongoose.isObjectIdOrHexString(customerId)
  ) {
    throw new LegacyCustomerError(
      "Invalid customer ID"
    );
  }

  const query = Customer.findById(customerId);

  if (session) {
    query.session(session);
  }

  const customer = await query;

  if (!customer) {
    throw new LegacyCustomerError(
      "Customer not found",
      404
    );
  }

  const eligibility =
    getLegacyCustomerEligibility(customer);

  if (eligibility.requiresReactivation) {
    throw new LegacyCustomerError(
      "Customer must be active before importing a pawn loan",
      409
    );
  }

  if (eligibility.requiresInformationUpdate) {
    throw new LegacyCustomerError(
      `Customer information is incomplete: ${eligibility.missingFields.join(", ")}`,
      409
    );
  }

  normalizeLegacyCustomerNic(customer.nic);

  return customer;
};