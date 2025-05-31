const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Transaction model for financial auditing and traceability
 * This model maintains a complete audit trail of all payment-related events
 */
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Order and payment identifiers
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Internal order ID'
  },
  razorpayOrderId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Razorpay order ID'
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Razorpay payment ID'
  },
  // Transaction details
  eventType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Type of event (PAYMENT_CREATED, PAYMENT_AUTHORIZED, PAYMENT_CAPTURED, PAYMENT_FAILED, etc.)'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Transaction amount in INR'
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'INR',
    allowNull: false
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
  // Status and timestamps
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Transaction status (created, authorized, captured, failed, refunded)'
  },
  previousStatus: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Previous status for audit trail'
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When this transaction event occurred'
  },
  // Financial details
  fee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Payment gateway fee'
  },
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Tax on payment gateway fee'
  },
  netAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Net amount after deducting fees and taxes'
  },
  // Source and metadata
  source: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'webhook',
    comment: 'Source of the transaction event (webhook, manual, api, etc.)'
  },
  sourceEventId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Source event ID (webhook event ID, etc.)'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional metadata for the transaction'
  },
  // Error details for failed transactions
  errorCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Error code for failed transactions'
  },
  errorDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error description for failed transactions'
  },
  // Reconciliation fields
  reconciled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this transaction has been reconciled'
  },
  reconciledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When this transaction was reconciled'
  },
  reconciledBy: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Who reconciled this transaction'
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
      fields: ['paymentId']
    },
    {
      fields: ['eventType']
    },
    {
      fields: ['status']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['source']
    },
    {
      fields: ['sourceEventId'],
      unique: true,
      where: {
        sourceEventId: {
          [require('sequelize').Op.ne]: null
        }
      }
    },
    {
      fields: ['reconciled']
    },
    {
      fields: ['createdAt']
    },
    // Composite indexes for common queries
    {
      fields: ['orderId', 'timestamp']
    },
    {
      fields: ['status', 'timestamp']
    },
    {
      fields: ['eventType', 'timestamp']
    }
  ]
});

/**
 * Static method to create a transaction record
 */
Transaction.createTransaction = async function(data) {
  try {
    const transaction = await this.create({
      orderId: data.orderId,
      razorpayOrderId: data.razorpayOrderId,
      paymentId: data.paymentId,
      eventType: data.eventType,
      amount: data.amount,
      currency: data.currency || 'INR',
      method: data.method,
      bank: data.bank,
      wallet: data.wallet,
      vpa: data.vpa,
      status: data.status,
      previousStatus: data.previousStatus,
      timestamp: data.timestamp || new Date(),
      fee: data.fee,
      tax: data.tax,
      netAmount: data.netAmount,
      source: data.source || 'webhook',
      sourceEventId: data.sourceEventId,
      metadata: data.metadata,
      errorCode: data.errorCode,
      errorDescription: data.errorDescription
    });
    
    console.log(`Transaction recorded: ${transaction.id} - ${data.eventType} for order ${data.orderId}`);
    return transaction;
  } catch (error) {
    console.error('Error creating transaction record:', error);
    throw error;
  }
};

/**
 * Static method to get transaction history for an order
 */
Transaction.getOrderHistory = async function(orderId) {
  return await this.findAll({
    where: { orderId },
    order: [['timestamp', 'ASC']],
    attributes: [
      'id', 'eventType', 'amount', 'status', 'method', 
      'timestamp', 'fee', 'tax', 'source', 'errorCode', 'errorDescription'
    ]
  });
};

/**
 * Static method to get reconciliation report
 */
Transaction.getReconciliationReport = async function(startDate, endDate) {
  const { Op } = require('sequelize');
  
  return await this.findAll({
    where: {
      timestamp: {
        [Op.between]: [startDate, endDate]
      },
      status: {
        [Op.in]: ['captured', 'refunded']
      }
    },
    order: [['timestamp', 'ASC']],
    attributes: [
      'orderId', 'paymentId', 'amount', 'fee', 'tax', 'netAmount',
      'status', 'method', 'timestamp', 'reconciled', 'reconciledAt'
    ]
  });
};

module.exports = Transaction;
