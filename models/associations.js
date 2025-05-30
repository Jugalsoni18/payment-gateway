const Order = require('./Order');
const Payment = require('./Payment');

// Define associations
Order.hasMany(Payment, {
  foreignKey: 'orderId',
  as: 'payments'
});

Payment.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order'
});

module.exports = {
  Order,
  Payment
};
