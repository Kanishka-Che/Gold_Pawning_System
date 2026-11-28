import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import Counter from "../models/Counter.js";

import {
  validateCustomer,
} from "../utils/customerValidation.js";

import {
  buildCustomerFilter,
} from "../utils/customerFilter.js";

import {
  findLegacyCustomerByNic,
  getLegacyCustomerEligibility,
  LegacyCustomerError,
} from "../services/legacyCustomerService.js";

import {
  createAuditLog,
} from "../utils/auditLogger.js";

import {
  getCustomerChangedFields,
  getCustomerStatusAuditAction,
} from "../utils/customerAudit.js";


function customerError(
  statusCode,
  message,
  errors = undefined
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errors = errors;

  return error;
}

async function runCustomerTransaction(work) {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(
      async () => {
        result = await work(session);
      },
      {
        readConcern: {
          level: "snapshot",
        },
        writeConcern: {
          w: "majority",
        },
        readPreference: "primary",
      }
    );

    return result;
  } finally {
    await session.endSession();
  }
}

// Register a new customer


export const createCustomer = async (req, res) => {
  try {
    const validation = validateCustomer(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Please correct the customer information",
        errors: validation.errors,
      });
    }

    const { fullName, nic, phone, address } =
      validation.values;

    const customer = await runCustomerTransaction(
      async (session) => {
        const existingCustomer = await Customer.findOne({
          nic,
        }).session(session);

        if (existingCustomer) {
          throw customerError(
            409,
            "Customer NIC already registered",
            {
              nic: "This NIC is already registered",
            }
          );
        }

        const counter = await Counter.findByIdAndUpdate(
          "customerCode",
          {
            $inc: {
              sequence: 1,
            },
          },
          {
            new: true,
            upsert: true,
            session,
          }
        );

        if (
          !counter ||
          !Number.isSafeInteger(counter.sequence) ||
          counter.sequence < 1
        ) {
          throw new Error(
            "Invalid customer code sequence"
          );
        }

        const customerCode = `CUS${String(
          counter.sequence
        ).padStart(4, "0")}`;

        const [createdCustomer] = await Customer.create(
          [
            {
              customerCode,
              fullName,
              nic,
              phone,
              address,
              status: "active",
            },
          ],
          {
            session,
          }
        );

        await createAuditLog({
          req,
          action: "CUSTOMER_CREATED",
          targetType: "Customer",
          targetId: createdCustomer._id,
          details: {
            customerCode:
              createdCustomer.customerCode,
            status: createdCustomer.status,
          },
          session,
        });

        return createdCustomer;
      }
    );

    return res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      customer,
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Customer NIC or code already exists",
      });
    }

    console.error(
      "Create Customer Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,
      message: "Failed to register customer",
    });
  }
};

// Get registered customers with optional filters
export const getCustomers = async (req, res) => {
  try {
    let filter;

    // Validate query parameters
    try {
      filter = buildCustomerFilter(req.query);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    // Load matching customers
    const customers = await Customer.find(filter)
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    console.error("Get Customers Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};


export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
    });
  }
};


export const updateCustomer = async (req, res) => {
  try {
    if (
      !mongoose.isObjectIdOrHexString(req.params.id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const validation = validateCustomer(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Please correct the customer information",
        errors: validation.errors,
      });
    }

    const { fullName, nic, phone, address } =
      validation.values;

    const updatedValues = {
      fullName,
      nic,
      phone,
      address,
    };

    const result = await runCustomerTransaction(
      async (session) => {
        const currentCustomer = await Customer.findById(
          req.params.id
        ).session(session);

        if (!currentCustomer) {
          throw customerError(
            404,
            "Customer not found"
          );
        }

        const changedFields =
          getCustomerChangedFields(
            currentCustomer,
            updatedValues
          );

        // Do not create unnecessary audit logs
        if (changedFields.length === 0) {
          return {
            customer: currentCustomer,
            changed: false,
          };
        }

        if (changedFields.includes("nic")) {
          const existingCustomer =
            await Customer.findOne({
              nic,
              _id: {
                $ne: currentCustomer._id,
              },
            }).session(session);

          if (existingCustomer) {
            throw customerError(
              409,
              "NIC already registered to another customer",
              {
                nic: "This NIC belongs to another customer",
              }
            );
          }
        }

        const changes = {};

        for (const field of changedFields) {
          changes[field] = updatedValues[field];
        }

        const customer =
          await Customer.findByIdAndUpdate(
            currentCustomer._id,
            {
              $set: changes,
            },
            {
              new: true,
              runValidators: true,
              session,
            }
          );

        if (!customer) {
          throw customerError(
            404,
            "Customer not found"
          );
        }

        await createAuditLog({
          req,
          action: "CUSTOMER_UPDATED",
          targetType: "Customer",
          targetId: customer._id,
          details: {
            customerCode: customer.customerCode,
            changedFields,
          },
          session,
        });

        return {
          customer,
          changed: true,
        };
      }
    );

    return res.status(200).json({
      success: true,
      message: result.changed
        ? "Customer updated successfully"
        : "No customer changes detected",
      customer: result.customer,
    });
  } catch (error) {
    if ([404, 409].includes(error.statusCode)) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "NIC already exists",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    console.error(
      "Update Customer Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update customer",
    });
  }
};



export const updateCustomerStatus = async (req, res) => {
  try {
    if (
      !mongoose.isObjectIdOrHexString(req.params.id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const { status } = req.body || {};

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive",
      });
    }

    const result = await runCustomerTransaction(
      async (session) => {
        const currentCustomer = await Customer.findById(
          req.params.id
        ).session(session);

        if (!currentCustomer) {
          throw customerError(
            404,
            "Customer not found"
          );
        }

        const previousStatus =
          currentCustomer.status;

        const action =
          getCustomerStatusAuditAction(
            previousStatus,
            status
          );

        // Ignore repeated status requests
        if (!action) {
          return {
            customer: currentCustomer,
            changed: false,
          };
        }

        const customer =
          await Customer.findByIdAndUpdate(
            currentCustomer._id,
            {
              $set: {
                status,
              },
            },
            {
              new: true,
              runValidators: true,
              session,
            }
          );

        if (!customer) {
          throw customerError(
            404,
            "Customer not found"
          );
        }

        await createAuditLog({
          req,
          action,
          targetType: "Customer",
          targetId: customer._id,
          details: {
            customerCode: customer.customerCode,
            previousStatus,
            newStatus: customer.status,
          },
          session,
        });

        return {
          customer,
          changed: true,
        };
      }
    );

    return res.status(200).json({
      success: true,
      message: result.changed
        ? `Customer ${status} successfully`
        : `Customer is already ${status}`,
      customer: result.customer,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    console.error(
      "Update Customer Status Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update customer status",
    });
  }
};


// Search customer for legacy pawn loan migration
export const lookupLegacyCustomer = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    const { nic } = req.body ?? {};

    const customer =
      await findLegacyCustomerByNic({
        nic,
      });

    // Customer not registered
    if (!customer) {
      return res.status(200).json({
        success: true,
        found: false,
        canLink: false,
        requiresRegistration: true,
        customer: null,
        message:
          "Customer is not registered. Register the customer first.",
      });
    }

    const eligibility =
      getLegacyCustomerEligibility(customer);

    let message = "Existing customer found";

    if (eligibility.requiresReactivation) {
      message =
        "Customer is inactive. Reactivate the customer first.";
    } else if (
      eligibility.requiresInformationUpdate
    ) {
      message =
        "Customer information must be completed first.";
    }

    return res.status(200).json({
      success: true,
      found: true,
      requiresRegistration: false,
      ...eligibility,
      customer,
      message,
    });

  } catch (error) {
    if (error instanceof LegacyCustomerError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Legacy Customer Lookup Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,
      message: "Failed to search legacy customer",
    });
  }
};