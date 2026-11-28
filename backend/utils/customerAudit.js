const editableCustomerFields = [
  "fullName",
  "nic",
  "phone",
  "address",
];

export function getCustomerChangedFields(
  currentCustomer,
  updatedValues
) {
  if (
    !currentCustomer ||
    typeof currentCustomer !== "object" ||
    !updatedValues ||
    typeof updatedValues !== "object"
  ) {
    throw new Error("Invalid customer audit data");
  }

  return editableCustomerFields.filter(
    (field) =>
      Object.prototype.hasOwnProperty.call(
        updatedValues,
        field
      ) &&
      currentCustomer[field] !== updatedValues[field]
  );
}

export function getCustomerStatusAuditAction(
  previousStatus,
  newStatus
) {
  const allowedStatuses = ["active", "inactive"];

  if (
    !allowedStatuses.includes(previousStatus) ||
    !allowedStatuses.includes(newStatus)
  ) {
    throw new Error("Invalid customer status");
  }

  if (previousStatus === newStatus) {
    return null;
  }

  return newStatus === "active"
    ? "CUSTOMER_ACTIVATED"
    : "CUSTOMER_DEACTIVATED";
}