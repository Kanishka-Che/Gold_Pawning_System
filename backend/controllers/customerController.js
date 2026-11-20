import Customer from "../models/Customer.js";
import Counter from "../models/Counter.js";
import { validateCustomer } from "../utils/customerValidation.js";

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

    const existingCustomer = await Customer.findOne({
      nic,
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "Customer NIC already registered",
        errors: {
          nic: "This NIC is already registered",
        },
      });
    }

    const counter = await Counter.findByIdAndUpdate(
      "customerCode",
      { $inc: { sequence: 1 } },
      {
        new: true,
        upsert: true,
      }
    );

    const customerCode = `CUS${String(
      counter.sequence
    ).padStart(4, "0")}`;

    const customer = await Customer.create({
      customerCode,
      fullName,
      nic,
      phone,
      address,
    });

    return res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      customer,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Customer NIC or code already exists",
      });
    }

    console.error("Create Customer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register customer",
    });
  }
};


 // Get all registered customers
export const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .sort({ createdAt: -1 });

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

    const existingCustomer = await Customer.findOne({
      nic,
      _id: { $ne: req.params.id },
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "NIC already registered to another customer",
        errors: {
          nic: "This NIC belongs to another customer",
        },
      });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        fullName,
        nic,
        phone,
        address,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
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

    console.error("Update Customer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer",
    });
  }
};



export const updateCustomerStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive",
      });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { status },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Customer ${status} successfully`,
      customer,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    console.error("Update Customer Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer status",
    });
  }
};
