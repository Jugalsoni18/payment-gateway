const crypto = require('crypto');

/**
 * Verify Razorpay webhook signature
 * @param {string|Buffer} body - Raw webhook body
 * @param {string} signature - X-Razorpay-Signature header
 * @param {string} secret - Webhook secret from environment
 * @returns {boolean} - True if signature is valid
 */
function verifyWebhookSignature(body, signature, secret) {
  try {
    if (!body || !signature || !secret) {
      console.error('Missing required parameters for signature verification');
      return false;
    }

    // Convert body to string if it's a Buffer
    const bodyString = Buffer.isBuffer(body) ? body.toString() : body;
    
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');

    // Compare signatures
    const isValid = signature === expectedSignature;
    
    if (!isValid) {
      console.error('Webhook signature verification failed', {
        expected: expectedSignature,
        received: signature,
        bodyLength: bodyString.length
      });
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Verify Razorpay payment signature for frontend verification
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @param {string} secret - Razorpay key secret
 * @returns {boolean} - True if signature is valid
 */
function verifyPaymentSignature(orderId, paymentId, signature, secret) {
  try {
    if (!orderId || !paymentId || !signature || !secret) {
      console.error('Missing required parameters for payment signature verification');
      return false;
    }

    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // Compare signatures
    const isValid = signature === expectedSignature;
    
    if (!isValid) {
      console.error('Payment signature verification failed', {
        orderId,
        paymentId,
        expected: expectedSignature,
        received: signature
      });
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    return false;
  }
}

/**
 * Extract and validate webhook event data
 * @param {Object} webhookPayload - Parsed webhook payload
 * @returns {Object} - Extracted and validated event data
 */
function extractWebhookEventData(webhookPayload) {
  try {
    const { event, payload } = webhookPayload;
    
    if (!event || !event.event || !event.id) {
      throw new Error('Invalid webhook event structure');
    }

    const eventType = event.event;
    const eventId = event.id;
    const createdAt = event.created_at;

    // Extract payment and order data based on event type
    let payment = null;
    let order = null;

    if (payload.payment && payload.payment.entity) {
      payment = payload.payment.entity;
    }

    if (payload.order && payload.order.entity) {
      order = payload.order.entity;
    }

    // Validate required data based on event type
    if (eventType.startsWith('payment.') && !payment) {
      throw new Error(`Payment data missing for event type: ${eventType}`);
    }

    if (eventType.startsWith('order.') && !order) {
      throw new Error(`Order data missing for event type: ${eventType}`);
    }

    return {
      eventType,
      eventId,
      createdAt,
      payment,
      order,
      isValid: true
    };
  } catch (error) {
    console.error('Error extracting webhook event data:', error);
    return {
      eventType: null,
      eventId: null,
      createdAt: null,
      payment: null,
      order: null,
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Validate webhook event for purchase creation
 * @param {Object} eventData - Extracted event data
 * @returns {Object} - Validation result
 */
function validateEventForPurchaseCreation(eventData) {
  const { eventType, payment, order } = eventData;
  
  // Events that should trigger purchase creation
  const purchaseCreationEvents = [
    'payment.captured',
    'order.paid'
  ];

  const shouldCreatePurchase = purchaseCreationEvents.includes(eventType);
  
  if (!shouldCreatePurchase) {
    return {
      shouldCreatePurchase: false,
      reason: `Event type ${eventType} does not trigger purchase creation`
    };
  }

  // Validate payment status for purchase creation
  if (eventType === 'payment.captured') {
    if (!payment || payment.status !== 'captured') {
      return {
        shouldCreatePurchase: false,
        reason: 'Payment is not in captured status'
      };
    }
  }

  // Validate order data
  if (!order || !order.id) {
    return {
      shouldCreatePurchase: false,
      reason: 'Order data is missing or invalid'
    };
  }

  return {
    shouldCreatePurchase: true,
    reason: 'Event is valid for purchase creation'
  };
}

/**
 * Generate webhook response for Razorpay
 * @param {boolean} success - Whether webhook processing was successful
 * @param {string} message - Response message
 * @param {Object} additionalData - Additional response data
 * @returns {Object} - Formatted response
 */
function generateWebhookResponse(success, message, additionalData = {}) {
  return {
    status: success ? 'success' : 'error',
    message,
    timestamp: new Date().toISOString(),
    ...additionalData
  };
}

/**
 * Log webhook processing details for debugging
 * @param {Object} eventData - Event data
 * @param {Object} processingResult - Processing result
 * @param {string} orderId - Order ID
 */
function logWebhookProcessing(eventData, processingResult, orderId) {
  const logData = {
    timestamp: new Date().toISOString(),
    eventType: eventData.eventType,
    eventId: eventData.eventId,
    orderId,
    success: processingResult.success,
    purchaseCreated: processingResult.purchaseCreated,
    message: processingResult.message
  };

  if (processingResult.success) {
    console.log('✅ Webhook processed successfully:', logData);
  } else {
    console.error('❌ Webhook processing failed:', logData);
  }
}

/**
 * Sanitize webhook data for logging (remove sensitive information)
 * @param {Object} webhookData - Raw webhook data
 * @returns {Object} - Sanitized data
 */
function sanitizeWebhookDataForLogging(webhookData) {
  try {
    const sanitized = JSON.parse(JSON.stringify(webhookData));
    
    // Remove sensitive payment information
    if (sanitized.payload && sanitized.payload.payment && sanitized.payload.payment.entity) {
      const payment = sanitized.payload.payment.entity;
      
      // Remove card details if present
      if (payment.card) {
        payment.card = {
          last4: payment.card.last4,
          network: payment.card.network,
          type: payment.card.type
        };
      }
      
      // Remove bank details if present
      if (payment.bank) {
        payment.bank = payment.bank.substring(0, 4) + '****';
      }
      
      // Remove VPA if present
      if (payment.vpa) {
        const [username, domain] = payment.vpa.split('@');
        payment.vpa = username.substring(0, 2) + '****@' + domain;
      }
    }
    
    return sanitized;
  } catch (error) {
    console.error('Error sanitizing webhook data:', error);
    return { error: 'Failed to sanitize webhook data' };
  }
}

module.exports = {
  verifyWebhookSignature,
  verifyPaymentSignature,
  extractWebhookEventData,
  validateEventForPurchaseCreation,
  generateWebhookResponse,
  logWebhookProcessing,
  sanitizeWebhookDataForLogging
};
