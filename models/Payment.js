const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Razorpay identifiers
  razorpayPaymentId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Razorpay payment ID'
  },
  razorpayOrderId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Razorpay order ID'
  },
  // Order reference
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'Orders',
      key: 'orderId'
    },
    comment: 'Reference to Order table'
  },
  // Payment details
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Payment amount in INR'
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'INR',
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'created',
    allowNull: false,
    comment: 'Razorpay payment status'
  },
  // Payment method details
  method: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Payment method (upi, card, netbanking, wallet, etc.)'
  },
  bank: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Bank name for UPI/netbanking payments'
  },
  wallet: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Wallet name for wallet payments'
  },
  vpa: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'UPI VPA for UPI payments'
  },
  // Card details (if applicable)
  cardId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Razorpay card ID'
  },
  cardLast4: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Last 4 digits of card'
  },
  cardNetwork: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Card network (Visa, Mastercard, etc.)'
  },
  cardType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Card type (credit, debit, prepaid)'
  },
  // Timestamps
  authorizedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When payment was authorized'
  },
  capturedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When payment was captured'
  },
  failedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When payment failed'
  },
  // Error details
  errorCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Error code if payment failed'
  },
  errorDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error description if payment failed'
  },
  errorSource: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Error source (customer, business, etc.)'
  },
  errorStep: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Step where error occurred'
  },
  errorReason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reason for error'
  },
  // Webhook tracking
  webhookEventId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Webhook event ID for deduplication'
  },
  webhookEventType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Type of webhook event (payment.captured, payment.failed, etc.)'
  },
  lastWebhookPayload: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Last webhook payload for debugging'
  },
  // Additional metadata
  international: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether payment is international'
  },
  fee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Payment processing fee'
  },
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Tax on payment processing fee'
  },
  refundStatus: {
    type: DataTypes.STRING,
    defaultValue: 'null',
    comment: 'Refund status of payment'
  },
  amountRefunded: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Amount refunded'
  },
  // Notes and metadata
  notes: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional notes and metadata'
  }
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      name: 'payments_razorpay_payment_id_unique',
      fields: ['razorpayPaymentId'],
      unique: true,
      where: {
        razorpayPaymentId: {
          [require('sequelize').Op.ne]: null
        }
      }
    },
    {
      fields: ['razorpayOrderId']
    },
    {
      fields: ['orderId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['method']
    },
    {
      name: 'payments_webhook_event_id_unique',
      fields: ['webhookEventId'],
      unique: true,
      where: {
        webhookEventId: {
          [require('sequelize').Op.ne]: null
        }
      }
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['capturedAt']
    }
  ]
});

module.exports = Payment;
