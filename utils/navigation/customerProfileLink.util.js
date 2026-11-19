const TRUSTED_MIN_COMPLETED_ORDERS = 5;
const TRUSTED_MIN_COMPLETION_RATE = 90;

const buildCustomerProfileActionUrl = (customerId) => {
  if (!customerId) return null;
  return `/profile/customer/${customerId}`;
};

const computeIsTrustedBuyer = ({
  completedOrders = 0,
  completionRate = 0,
} = {}) => {
  const completed = Number(completedOrders) || 0;
  const rate = Number(completionRate) || 0;

  return (
    completed >= TRUSTED_MIN_COMPLETED_ORDERS &&
    rate >= TRUSTED_MIN_COMPLETION_RATE
  );
};

const mapCustomerSummary = (customer, user = null, orderTrust = null) => {
  if (!customer?.id) return null;

  const u = user ?? customer.user ?? null;
  const completedOrders =
    orderTrust?.completedOrders ?? customer.completedOrders ?? 0;
  const completionRate =
    orderTrust?.completionRate ?? customer.completionRate ?? 0;

  return {
    id: customer.id,
    firstName: u?.firstName ?? null,
    lastName: u?.lastName ?? null,
    avatar: u?.avatar ?? null,
    actionUrl: buildCustomerProfileActionUrl(customer.id),
    isTrustedBuyer: computeIsTrustedBuyer({
      completedOrders,
      completionRate,
    }),
  };
};

module.exports = {
  TRUSTED_MIN_COMPLETED_ORDERS,
  TRUSTED_MIN_COMPLETION_RATE,
  buildCustomerProfileActionUrl,
  computeIsTrustedBuyer,
  mapCustomerSummary,
};
