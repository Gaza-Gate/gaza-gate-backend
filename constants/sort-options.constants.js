const PUBLIC_SORT_OPTIONS = Object.freeze({
    price_asc: Object.freeze([Object.freeze(["price", "ASC"])]),
    price_desc: Object.freeze([Object.freeze(["price", "DESC"])]),
    newest: Object.freeze([Object.freeze(["created_at", "DESC"])]),
    rating: Object.freeze([Object.freeze(["average_rating", "DESC"])]),
  });
  
  module.exports = PUBLIC_SORT_OPTIONS;