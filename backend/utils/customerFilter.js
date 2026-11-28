export function buildCustomerFilter(query = {}) {
  const filter = {};

  // Validate status filter
  if (query.status !== undefined) {
    if (
      typeof query.status !== "string" ||
      !["all", "active", "inactive"].includes(
        query.status
      )
    ) {
      throw new Error(
        "Status must be all, active or inactive"
      );
    }

    if (query.status !== "all") {
      filter.status = query.status;
    }
  }

  // Validate search filter
  if (query.search !== undefined) {
    if (
      typeof query.search !== "string" ||
      query.search.length > 100
    ) {
      throw new Error("Invalid customer search");
    }

    const searchText = query.search.trim();

    if (searchText) {
      // Escape special regex characters
      const escapedSearch = searchText.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        {
          fullName: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          customerCode: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          nic: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: escapedSearch,
          },
        },
      ];
    }
  }

  return filter;
}