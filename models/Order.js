const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  orderId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'INR'
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  items: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  shippingAddress: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  razorpayOrderId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'authorized', 'captured', 'refunded'),
    defaultValue: 'pending'
  },
  qrCode: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Enhanced fields for webhook support
  webhookEventId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Razorpay webhook event ID for deduplication'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Payment method used (upi, card, netbanking, etc.)'
  },
  paymentCapturedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when payment was captured'
  },
  lastWebhookPayload: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Last webhook payload received for debugging'
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['paymentId']
    },
    {
      fields: ['razorpayOrderId']
    },
    {
      fields: ['paymentStatus']
    },
    {
      fields: ['webhookEventId'],
      unique: true,
      where: {
        webhookEventId: {
          [require('sequelize').Op.ne]: null
        }
      }
    },
    {
      fields: ['customerEmail']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Order;
