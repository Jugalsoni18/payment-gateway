const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Purchase model - Stores verified purchase details only after successful payment
 * This model is populated only when payment is confirmed via webhook
 */
const Purchase = sequelize.define('Purchase', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Order and payment identifiers
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Internal order ID from Order table'
  },
  razorpayOrderId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Razorpay order ID'
  },
  razorpayPaymentId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Razorpay payment ID'
  },
  // Customer details (copied from Order after successful payment)
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Customer full name'
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    },
    comment: 'Customer email address'
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      is: /^[0-9]{10}$/
    },
    comment: 'Customer phone number (10 digits)'
  },
  // Purchase details
  items: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of purchased items with details'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Total purchase amount in INR'
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'INR',
    allowNull: false
  },
  // Payment details
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Payment method used (upi, card, netbanking, wallet, etc.)'
  },
  paymentStatus: {
    type: DataTypes.ENUM('captured', 'authorized', 'refunded', 'partially_refunded'),
    defaultValue: 'captured',
    allowNull: false,
    comment: 'Final payment status when purchase was created'
  },
  // Shipping information
  shippingAddress: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Customer shipping address details'
  },
  // Financial details
  paymentFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Payment gateway fee'
  },
  paymentTax: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Tax on payment gateway fee'
  },
  netAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Net amount after deducting fees'
  },
  // Webhook verification details
  webhookEventId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Webhook event ID that triggered this purchase creation'
  },
  webhookEventType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Type of webhook event (payment.captured, order.paid, etc.)'
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Timestamp when payment was verified and purchase was created'
  },
  // Additional metadata
  paymentNotes: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Additional payment notes from Razorpay'
  },
  orderNotes: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Additional order notes and metadata'
  },
  // Business logic fields
  fulfillmentStatus: {
    type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'pending',
    comment: 'Order fulfillment status'
  },
  fulfillmentNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes about order fulfillment'
  },
  // Refund tracking
  refundAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Total amount refunded'
  },
  refundReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for refund if applicable'
  },
  refundedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when refund was processed'
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['orderId']
    },
    {
      fields: ['razorpayOrderId']
    },
    {
      fields: ['razorpayPaymentId']
    },
    {
      fields: ['customerEmail']
    },
    {
      fields: ['customerPhone']
    },
    {
      fields: ['paymentStatus']
    },
    {
      fields: ['fulfillmentStatus']
    },
    {
      fields: ['webhookEventId'],
      unique: true
    },
    {
      fields: ['verifiedAt']
    },
    {
      fields: ['createdAt']
    },
    // Composite indexes for common queries
    {
      fields: ['customerEmail', 'createdAt']
    },
    {
      fields: ['paymentStatus', 'fulfillmentStatus']
    },
    {
      fields: ['amount', 'createdAt']
    }
  ]
});

/**
 * Static method to create a purchase record from verified payment
 */
Purchase.createFromVerifiedPayment = async function(orderData, paymentData, webhookData) {
  try {
    const purchase = await this.create({
      orderId: orderData.orderId,
      razorpayOrderId: orderData.razorpayOrderId,
      razorpayPaymentId: paymentData.razorpayPaymentId || paymentData.id,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerPhone: orderData.customerPhone,
      items: orderData.items || [],
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      paymentMethod: paymentData.method,
      paymentStatus: paymentData.status === 'captured' ? 'captured' : 'authorized',
      shippingAddress: orderData.shippingAddress || {},
      paymentFee: paymentData.fee,
      paymentTax: paymentData.tax,
      netAmount: paymentData.fee ? (orderData.amount - paymentData.fee - (paymentData.tax || 0)) : orderData.amount,
      webhookEventId: webhookData.event.id,
      webhookEventType: webhookData.event.event,
      verifiedAt: new Date(),
      paymentNotes: paymentData.notes || {},
      orderNotes: orderData.notes || {}
    });
    
    console.log(`Purchase created: ${purchase.id} for order ${orderData.orderId} - Amount: ₹${orderData.amount}`);
    return purchase;
  } catch (error) {
    console.error('Error creating purchase record:', error);
    throw error;
  }
};

/**
 * Static method to get customer purchase history
 */
Purchase.getCustomerPurchases = async function(customerEmail, limit = 10) {
  return await this.findAll({
    where: { customerEmail },
    order: [['createdAt', 'DESC']],
    limit,
    attributes: [
      'id', 'orderId', 'amount', 'items', 'paymentMethod',
      'paymentStatus', 'fulfillmentStatus', 'createdAt'
    ]
  });
};

/**
 * Static method to get purchase analytics
 */
Purchase.getPurchaseAnalytics = async function(startDate, endDate) {
  const { Op, fn, col } = require('sequelize');
  
  return await this.findAll({
    where: {
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    },
    attributes: [
      [fn('COUNT', col('id')), 'totalPurchases'],
      [fn('SUM', col('amount')), 'totalRevenue'],
      [fn('AVG', col('amount')), 'averageOrderValue'],
      'paymentMethod',
      'fulfillmentStatus'
    ],
    group: ['paymentMethod', 'fulfillmentStatus'],
    raw: true
  });
};

module.exports = Purchase;
