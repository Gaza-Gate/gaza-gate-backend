const buildCustomerProfileActionUrl = (customerId) => {
  if (!customerId) return null;
  return `/profile/customer/${customerId}`;
};

const mapCustomerSummary = (customer, user = null) => {
  if (!customer?.id) return null;

  const u = user ?? customer.user ?? null;

  return {
    id: customer.id,
    firstName: u?.firstName ?? null,
    lastName: u?.lastName ?? null,
    avatar: u?.avatar ?? null,
    actionUrl: buildCustomerProfileActionUrl(customer.id),
  };
};

module.exports = {
  buildCustomerProfileActionUrl,
  mapCustomerSummary,
};
