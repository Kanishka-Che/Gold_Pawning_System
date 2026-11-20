
export const validateCustomerForm = (form) => {
  const errors = {};

  const fullName = form.fullName.trim();
  const nic = form.nic.trim().toUpperCase();
  const phone = form.phone.replace(/[\s-]/g, "").trim();
  const address = form.address.trim();

  if (!fullName) {
    errors.fullName = "Full name is required";
  }

  if (!nic) {
    errors.nic = "NIC is required";
  } else if (!/^([0-9]{9}[VX]|[0-9]{12})$/.test(nic)) {
    errors.nic =
      "Use 9 digits + V/X or 12 digits";
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

  return errors;
};
