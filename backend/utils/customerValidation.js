
export const normalizeNIC = (nic) =>
  String(nic ?? "").trim().toUpperCase();

export const normalizePhone = (phone) =>
  String(phone ?? "").replace(/[\s-]/g, "").trim();

export const validateCustomer = (data) => {
  const errors = {};

  const fullName = String(data.fullName ?? "").trim();
  const nic = normalizeNIC(data.nic);
  const phone = normalizePhone(data.phone);
  const address = String(data.address ?? "").trim();

  if (!fullName) {
    errors.fullName = "Full name is required";
  }

  if (!nic) {
    errors.nic = "NIC is required";
  } else if (
    !/^([0-9]{9}[VX]|[0-9]{12})$/.test(nic)
  ) {
    errors.nic =
      "Enter a valid NIC (9 digits + V/X or 12 digits)";
  }

  if (!phone) {
    errors.phone = "Phone number is required";
  } else if (
    !/^(0[1-9][0-9]{8}|\+94[1-9][0-9]{8})$/.test(phone)
  ) {
    errors.phone =
      "Enter a valid Sri Lankan phone number";
  }

  if (!address) {
    errors.address = "Address is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: {
      fullName,
      nic,
      phone,
      address,
    },
  };
};
