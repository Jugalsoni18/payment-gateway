const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * PaymentLog Model - Comprehensive payment logging and auditing
 * 
 * This model stores detailed logs of all payment transactions including:
 * - Razorpay order and payment IDs
 * - Payment status tracking throughout the lifecycle
 * - Amount in smallest currency unit (paisa) for precision
 * - Payment methods and response data
 * - Webhook and API response logging
 * - Timestamps for audit trail
 */
const PaymentLog = sequelize.define('PaymentLog', {
  // Primary key
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'Unique identifier for payment log entry'
  },

  // 📌 Core Payment Identifiers
  order_id: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true,
    comment: 'Generated via Razorpay API (razorpay.orders.create) or internal order ID'
  },
  
  payment_id: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
    comment: 'Populated after success (razorpay_payment_id in webhook/checkout)'
  },

  // Razorpay specific identifiers
  razorpay_order_id: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
    comment: 'Razorpay order ID from orders.create API'
  },

  razorpay_payment_id: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
    comment: 'Razorpay payment ID from payment completion'
  },

  // 📌 Payment Status Tracking
  status: {
    type: DataTypes.ENUM(
      'created',      // Order created, payment not initiated
      'pending',      // Payment initiated but not completed
      'authorized',   // Payment authorized but not captured
      'captured',     // Payment captured successfully
      'paid',         // Payment completed successfully
      'failed',       // Payment failed
      'cancelled',    // Payment cancelled by user
      'refunded',     // Payment refunded
      'partial_refund' // Partial refund processed
    ),
    allowNull: false,
    defaultValue: 'created',
    index: true,
    comment: 'Track status: created, paid, failed, refunded'
  },

  // Previous status for tracking changes
  previous_status: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Previous status before current update'
  },

  // 📌 Amount in Smallest Currency Unit
  amount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Always store in smallest currency unit (e.g., paisa) for precision'
  },

  // Currency
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR',
    comment: 'Currency code (INR, USD, etc.)'
  },

  // Amount in human readable format (for convenience)
  amount_display: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Amount in major currency unit for display (e.g., rupees)'
  },

  // 📌 Payment Method
  method: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
    comment: 'Payment method (upi, card, netbanking, wallet, etc.) — helpful for filters'
  },

  // Additional method details
  method_details: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional payment method details (bank, wallet, card info, etc.)'
  },

  // 📌 Response Data Storage
  response_data: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Store full webhook or payment response (JSONB) for debugging and audit'
  },

  // API request data
  request_data: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Store API request data for audit trail'
  },

  // Webhook specific data
  webhook_event_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Webhook event ID for deduplication'
  },

  webhook_event_type: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Type of webhook event (payment.captured, payment.failed, etc.)'
  },

  // Customer Information
  customer_name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Customer name for reference'
  },

  customer_email: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
    comment: 'Customer email for reference'
  },

  customer_phone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Customer phone for reference'
  },

  // Transaction Details
  transaction_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Bank/UPI transaction ID'
  },

  reference_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'External reference ID'
  },

  // Error Information
  error_code: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Error code if payment failed'
  },

  error_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed error description'
  },

  error_source: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Error source (customer, business, bank, etc.)'
  },

  // Fee and Tax Information
  fee: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: 'Payment processing fee in smallest currency unit'
  },

  tax: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: 'Tax on payment processing fee in smallest currency unit'
  },

  // Refund Information
  refund_amount: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: 0,
    comment: 'Amount refunded in smallest currency unit'
  },

  refund_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Refund transaction ID'
  },

  // Audit and Tracking
  event_type: {
    type: DataTypes.ENUM(
      'order_created',
      'payment_initiated',
      'payment_authorized',
      'payment_captured',
      'payment_failed',
      'payment_cancelled',
      'refund_initiated',
      'refund_processed',
      'webhook_received',
      'status_updated'
    ),
    allowNull: false,
    comment: 'Type of event being logged'
  },

  source: {
    type: DataTypes.ENUM(
      'api',
      'webhook',
      'manual',
      'system',
      'callback'
    ),
    allowNull: false,
    defaultValue: 'api',
    comment: 'Source of the log entry'
  },

  // IP and User Agent for security
  ip_address: {
    type: DataTypes.INET,
    allowNull: true,
    comment: 'IP address of the request'
  },

  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'User agent string'
  },

  // Additional metadata
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Additional metadata and custom fields'
  },

  // Notes for manual entries
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Manual notes or comments'
  }

}, {
  // Table options
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'payment_logs',
  
  // Indexes for performance
  indexes: [
    // Primary lookups
    { fields: ['order_id'] },
    { fields: ['payment_id'] },
    { fields: ['razorpay_order_id'] },
    { fields: ['razorpay_payment_id'] },
    
    // Status and method filtering
    { fields: ['status'] },
    { fields: ['method'] },
    { fields: ['event_type'] },
    { fields: ['source'] },
    
    // Customer lookups
    { fields: ['customer_email'] },
    
    // Time-based queries
    { fields: ['created_at'] },
    { fields: ['updated_at'] },
    
    // Webhook deduplication
    {
      name: 'payment_logs_webhook_event_id_unique',
      fields: ['webhook_event_id'],
      unique: true,
      where: {
        webhook_event_id: {
          [require('sequelize').Op.ne]: null
        }
      }
    },
    
    // Composite indexes for common queries
    { fields: ['order_id', 'status'] },
    { fields: ['customer_email', 'status'] },
    { fields: ['method', 'status'] },
    { fields: ['created_at', 'status'] }
  ],

  // Hooks for automatic data processing
  hooks: {
    beforeCreate: (paymentLog, options) => {
      // Automatically calculate display amount from paisa
      if (paymentLog.amount && !paymentLog.amount_display) {
        paymentLog.amount_display = paymentLog.amount / 100;
      }
    },
    beforeUpdate: (paymentLog, options) => {
      // Update display amount if amount changes
      if (paymentLog.changed('amount')) {
        paymentLog.amount_display = paymentLog.amount / 100;
      }
    }
  }
});

module.exports = PaymentLog;
