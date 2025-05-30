const PaymentLog = require('../models/PaymentLog');

/**
 * Payment Logger Service
 * 
 * Provides convenient methods to log payment events and maintain audit trail
 */
class PaymentLogger {
  
  /**
   * Log order creation
   * @param {Object} orderData - Order data
   * @param {Object} options - Additional options
   */
  static async logOrderCreated(orderData, options = {}) {
    try {
      const logData = {
        order_id: orderData.orderId || orderData.order_id,
        razorpay_order_id: orderData.razorpayOrderId || orderData.razorpay_order_id,
        amount: this.convertToSmallestUnit(orderData.amount),
        currency: orderData.currency || 'INR',
        customer_name: orderData.customerName,
        customer_email: orderData.customerEmail,
        customer_phone: orderData.customerPhone,
        status: 'created',
        event_type: 'order_created',
        source: options.source || 'api',
        request_data: options.requestData,
        ip_address: options.ipAddress,
        user_agent: options.userAgent,
        metadata: {
          items: orderData.items,
          shipping_address: orderData.shippingAddress,
          ...options.metadata
        }
      };

      return await PaymentLog.create(logData);
    } catch (error) {
      console.error('Error logging order creation:', error);
      throw error;
    }
  }

  /**
   * Log payment initiation
   * @param {Object} paymentData - Payment data
   * @param {Object} options - Additional options
   */
  static async logPaymentInitiated(paymentData, options = {}) {
    try {
      const logData = {
        order_id: paymentData.orderId || paymentData.order_id,
        payment_id: paymentData.paymentId || paymentData.payment_id,
        razorpay_order_id: paymentData.razorpayOrderId,
        razorpay_payment_id: paymentData.razorpayPaymentId,
        amount: this.convertToSmallestUnit(paymentData.amount),
        currency: paymentData.currency || 'INR',
        method: paymentData.method,
        status: 'pending',
        previous_status: 'created',
        event_type: 'payment_initiated',
        source: options.source || 'api',
        request_data: options.requestData,
        response_data: options.responseData,
        ip_address: options.ipAddress,
        user_agent: options.userAgent,
        metadata: options.metadata
      };

      return await PaymentLog.create(logData);
    } catch (error) {
      console.error('Error logging payment initiation:', error);
      throw error;
    }
  }

  /**
   * Log payment success/completion
   * @param {Object} paymentData - Payment data
   * @param {Object} options - Additional options
   */
  static async logPaymentSuccess(paymentData, options = {}) {
    try {
      const logData = {
        order_id: paymentData.orderId || paymentData.order_id,
        payment_id: paymentData.paymentId || paymentData.payment_id,
        razorpay_order_id: paymentData.razorpayOrderId,
        razorpay_payment_id: paymentData.razorpayPaymentId,
        amount: this.convertToSmallestUnit(paymentData.amount),
        currency: paymentData.currency || 'INR',
        method: paymentData.method,
        method_details: {
          bank: paymentData.bank,
          wallet: paymentData.wallet,
          vpa: paymentData.vpa,
          card_last4: paymentData.cardLast4,
          card_network: paymentData.cardNetwork
        },
        status: paymentData.status === 'captured' ? 'captured' : 'paid',
        previous_status: 'pending',
        event_type: paymentData.status === 'captured' ? 'payment_captured' : 'payment_authorized',
        source: options.source || 'webhook',
        transaction_id: paymentData.transactionId || paymentData.txnId,
        fee: paymentData.fee ? this.convertToSmallestUnit(paymentData.fee) : null,
        tax: paymentData.tax ? this.convertToSmallestUnit(paymentData.tax) : null,
        webhook_event_id: options.webhookEventId,
        webhook_event_type: options.webhookEventType,
        response_data: options.responseData,
        ip_address: options.ipAddress,
        user_agent: options.userAgent,
        metadata: options.metadata
      };

      return await PaymentLog.create(logData);
    } catch (error) {
      console.error('Error logging payment success:', error);
      throw error;
    }
  }

  /**
   * Log payment failure
   * @param {Object} paymentData - Payment data
   * @param {Object} options - Additional options
   */
  static async logPaymentFailure(paymentData, options = {}) {
    try {
      const logData = {
        order_id: paymentData.orderId || paymentData.order_id,
        payment_id: paymentData.paymentId || paymentData.payment_id,
        razorpay_order_id: paymentData.razorpayOrderId,
        razorpay_payment_id: paymentData.razorpayPaymentId,
        amount: this.convertToSmallestUnit(paymentData.amount),
        currency: paymentData.currency || 'INR',
        method: paymentData.method,
        status: 'failed',
        previous_status: 'pending',
        event_type: 'payment_failed',
        source: options.source || 'webhook',
        error_code: paymentData.errorCode || options.errorCode,
        error_description: paymentData.errorDescription || options.errorDescription,
        error_source: paymentData.errorSource || options.errorSource,
        webhook_event_id: options.webhookEventId,
        webhook_event_type: options.webhookEventType,
        response_data: options.responseData,
        ip_address: options.ipAddress,
        user_agent: options.userAgent,
        metadata: options.metadata
      };

      return await PaymentLog.create(logData);
    } catch (error) {
      console.error('Error logging payment failure:', error);
      throw error;
    }
  }

  /**
   * Log refund
   * @param {Object} refundData - Refund data
   * @param {Object} options - Additional options
   */
  static async logRefund(refundData, options = {}) {
    try {
      const logData = {
        order_id: refundData.orderId || refundData.order_id,
        payment_id: refundData.paymentId || refundData.payment_id,
        razorpay_payment_id: refundData.razorpayPaymentId,
        amount: this.convertToSmallestUnit(refundData.originalAmount),
        refund_amount: this.convertToSmallestUnit(refundData.refundAmount),
        refund_id: refundData.refundId,
        currency: refundData.currency || 'INR',
        status: refundData.refundAmount === refundData.originalAmount ? 'refunded' : 'partial_refund',
        previous_status: 'paid',
        event_type: 'refund_processed',
        source: options.source || 'api',
        response_data: options.responseData,
        notes: refundData.reason || options.notes,
        metadata: options.metadata
      };

      return await PaymentLog.create(logData);
    } catch (error) {
      console.error('Error logging refund:', error);
      throw error;
    }
  }

  /**
   * Log webhook event
   * @param {Object} webhookData - Webhook data
   * @param {Object} options - Additional options
   */
  static async logWebhookEvent(webhookData, options = {}) {
    try {
      const event = webhookData.event || webhookData;
      const payload = event.payload || webhookData.payload;
      
      const logData = {
        order_id: payload.payment?.order_id || payload.order?.id,
        payment_id: payload.payment?.id,
        razorpay_order_id: payload.order?.id,
        razorpay_payment_id: payload.payment?.id,
        amount: payload.payment?.amount || payload.order?.amount,
        currency: payload.payment?.currency || payload.order?.currency || 'INR',
        method: payload.payment?.method,
        status: this.mapWebhookStatusToLogStatus(event.event),
        event_type: 'webhook_received',
        source: 'webhook',
        webhook_event_id: event.id,
        webhook_event_type: event.event,
        response_data: webhookData,
        ip_address: options.ipAddress,
        user_agent: options.userAgent,
        metadata: {
          webhook_created_at: event.created_at,
          ...options.metadata
        }
      };

      return await PaymentLog.create(logData);
    } catch (error) {
      console.error('Error logging webhook event:', error);
      throw error;
    }
  }

  /**
   * Log status update
   * @param {Object} updateData - Update data
   * @param {Object} options - Additional options
   */
  static async logStatusUpdate(updateData, options = {}) {
    try {
      const logData = {
        order_id: updateData.orderId || updateData.order_id,
        payment_id: updateData.paymentId || updateData.payment_id,
        status: updateData.newStatus,
        previous_status: updateData.previousStatus,
        event_type: 'status_updated',
        source: options.source || 'system',
        notes: options.notes,
        metadata: {
          update_reason: options.reason,
          ...options.metadata
        }
      };

      return await PaymentLog.create(logData);
    } catch (error) {
      console.error('Error logging status update:', error);
      throw error;
    }
  }

  /**
   * Convert amount to smallest currency unit (paisa)
   * @param {number|string} amount - Amount in major currency unit
   * @returns {number} Amount in smallest currency unit
   */
  static convertToSmallestUnit(amount) {
    if (!amount) return 0;
    return Math.round(parseFloat(amount) * 100);
  }

  /**
   * Convert amount from smallest currency unit to major unit
   * @param {number} amount - Amount in smallest currency unit
   * @returns {number} Amount in major currency unit
   */
  static convertFromSmallestUnit(amount) {
    if (!amount) return 0;
    return amount / 100;
  }

  /**
   * Map webhook event type to log status
   * @param {string} webhookEvent - Webhook event type
   * @returns {string} Log status
   */
  static mapWebhookStatusToLogStatus(webhookEvent) {
    const mapping = {
      'payment.authorized': 'authorized',
      'payment.captured': 'captured',
      'payment.failed': 'failed',
      'order.paid': 'paid',
      'refund.created': 'refunded',
      'refund.processed': 'refunded'
    };
    
    return mapping[webhookEvent] || 'pending';
  }

  /**
   * Get payment logs for an order
   * @param {string} orderId - Order ID
   * @param {Object} options - Query options
   */
  static async getOrderLogs(orderId, options = {}) {
    try {
      const whereClause = { order_id: orderId };
      
      if (options.eventType) {
        whereClause.event_type = options.eventType;
      }
      
      if (options.status) {
        whereClause.status = options.status;
      }

      return await PaymentLog.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: options.limit || 100,
        offset: options.offset || 0
      });
    } catch (error) {
      console.error('Error fetching order logs:', error);
      throw error;
    }
  }

  /**
   * Get payment logs summary for reporting
   * @param {Object} filters - Filter options
   */
  static async getLogsSummary(filters = {}) {
    try {
      const { Op } = require('sequelize');
      const whereClause = {};

      if (filters.startDate && filters.endDate) {
        whereClause.created_at = {
          [Op.between]: [filters.startDate, filters.endDate]
        };
      }

      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.method) {
        whereClause.method = filters.method;
      }

      return await PaymentLog.findAll({
        where: whereClause,
        attributes: [
          'status',
          'method',
          [PaymentLog.sequelize.fn('COUNT', '*'), 'count'],
          [PaymentLog.sequelize.fn('SUM', PaymentLog.sequelize.col('amount')), 'total_amount']
        ],
        group: ['status', 'method'],
        order: [['status'], ['method']]
      });
    } catch (error) {
      console.error('Error fetching logs summary:', error);
      throw error;
    }
  }
}

module.exports = PaymentLogger;
