const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

/**
 * Sum of order items before discount/shipping.
 * Prefers unitPrice × quantity; falls back to lineTotal when unitPrice/quantity missing.
 */
const sumItemsSubtotal = (items = []) => {
  const subtotal = (items || []).reduce((sum, item) => {
    const unitPrice = Number(item?.unitPrice);
    const quantity = Number(item?.quantity);
    if (Number.isFinite(unitPrice) && Number.isFinite(quantity)) {
      return sum + unitPrice * quantity;
    }
    return sum + Number(item?.lineTotal || 0);
  }, 0);

  return roundMoney(subtotal);
};

/**
 * Derive order money fields from items so subtotal and totalPrice stay in sync.
 * totalPrice = subtotal - discountAmount + shippingFee
 */
const computeOrderTotals = ({
  items = [],
  discountAmount = 0,
  shippingFee = 0,
} = {}) => {
  const subtotal = sumItemsSubtotal(items);
  const discount = roundMoney(discountAmount);
  const shipping = roundMoney(shippingFee);
  const totalPrice = roundMoney(subtotal - discount + shipping);

  return {
    subtotal,
    discountAmount: discount,
    shippingFee: shipping,
    totalPrice,
  };
};

const assertTotalsConsistent = ({
  subtotal,
  discountAmount = 0,
  shippingFee = 0,
  totalPrice,
} = {}) => {
  const expected = roundMoney(
    Number(subtotal) - Number(discountAmount) + Number(shippingFee),
  );
  return roundMoney(totalPrice) === expected;
};

module.exports = {
  roundMoney,
  sumItemsSubtotal,
  computeOrderTotals,
  assertTotalsConsistent,
};
