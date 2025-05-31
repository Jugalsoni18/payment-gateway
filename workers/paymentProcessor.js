const paymentQueue = require('../queues/paymentQueue');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Purchase = require('../models/Purchase');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { broadcastPaymentUpdate, broadcastOrderUpdate } = require('../utils/websocket');
const PaymentLogger = require('../services/paymentLogger');

/**
 * Process webhook events from the queue
 */
paymentQueue.process(async (job) => {
  const { webhookData, signature, io } = job.data;

  try {
    console.log(`Processing webhook job ${job.id}:`, webhookData.event?.type);

    // Update job progress
    job.progress(10);

    // Verify webhook signature
    const isValidSignature = verifyWebhookSignature(webhookData, signature);
    if (!isValidSignature) {
      throw new Error('Invalid webhook signature');
    }

    job.progress(30);

    // Extract event data
    const { event, payload } = webhookData;
    const eventType = event.type;
    const payment = payload.payment?.entity;
    const order = payload.order?.entity;

    job.progress(50);

    // Log the webhook event
    await PaymentLogger.logWebhookEvent(eventType, webhookData);

    job.progress(70);

    // Process the webhook based on event type
    const result = await processWebhookEvent(eventType, payment, order, webhookData, io);

    job.progress(100);

    return {
      success: true,
      eventType,
      orderId: order?.id,
      paymentId: payment?.id,
      processed: true,
      result
    };

  } catch (error) {
    console.error(`Webhook processing error in job ${job.id}:`, error);

    // Log the error
    await PaymentLogger.logWebhookEvent('webhook.error', {
      error: error.message,
      originalEvent: webhookData,
      jobId: job.id
    });

    throw error; // This will mark the job as failed and trigger retry
  }
});

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(webhookData, signature) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('RAZORPAY_WEBHOOK_SECRET not configured, skipping signature verification');
      return true; // Allow processing if secret is not configured
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(webhookData))
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Process webhook event based on type
 */
async function processWebhookEvent(eventType, payment, order, webhookPayload, io) {
  switch (eventType) {
    case 'payment.authorized':
      return await handlePaymentAuthorized(payment, order, webhookPayload, io);

    case 'payment.captured':
      return await handlePaymentCaptured(payment, order, webhookPayload, io);

    case 'payment.failed':
      return await handlePaymentFailed(payment, order, webhookPayload, io);

    case 'order.paid':
      return await handleOrderPaid(payment, order, webhookPayload, io);

    default:
      console.log('Unhandled webhook event:', eventType);
      return { handled: false, eventType };
  }
}

/**
 * Handle payment.authorized event
 */
async function handlePaymentAuthorized(payment, order, webhookPayload, io) {
  console.log('Processing payment.authorized event:', payment.id);

  // Find the order in our database
  const dbOrder = await Order.findOne({
    where: {
      [Op.or]: [
        { razorpayOrderId: order.id },
        { orderId: order.receipt }
      ]
    }
  });

  if (!dbOrder) {
    throw new Error(`Order not found for payment.authorized: ${order.id}`);
  }

  // Create or update payment record
  const [paymentRecord, created] = await Payment.findOrCreate({
    where: { razorpayPaymentId: payment.id },
    defaults: {
      razorpayPaymentId: payment.id,
      razorpayOrderId: order.id,
      orderId: dbOrder.orderId,
      amount: payment.amount / 100,
      currency: payment.currency,
      status: 'authorized',
      method: payment.method,
      bank: payment.bank,
      wallet: payment.wallet,
      vpa: payment.vpa,
      authorizedAt: new Date(payment.created_at * 1000),
      notes: payment.notes
    }
  });

  if (!created) {
    await paymentRecord.update({
      status: 'authorized',
      authorizedAt: new Date(payment.created_at * 1000)
    });
  }

  // Update order status
  await dbOrder.update({
    paymentStatus: 'authorized',
    paymentId: payment.id,
    webhookEventId: webhookPayload.event.id,
    lastWebhookPayload: webhookPayload
  });

  // Broadcast update via WebSocket
  if (io) {
    broadcastPaymentUpdate(io, dbOrder.orderId, {
      orderId: dbOrder.orderId,
      paymentStatus: 'authorized',
      paymentId: payment.id,
      amount: dbOrder.amount,
      method: payment.method
    });
  }

  return { handled: true, status: 'authorized', orderId: dbOrder.orderId };
}

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(payment, order, webhookPayload, io) {
  console.log('Processing payment.captured event:', payment.id);

  // Find the order in our database
  const dbOrder = await Order.findOne({
    where: {
      [Op.or]: [
        { razorpayOrderId: order.id },
        { orderId: order.receipt }
      ]
    }
  });

  if (!dbOrder) {
    throw new Error(`Order not found for payment.captured: ${order.id}`);
  }

  // Update payment record
  const paymentRecord = await Payment.findOne({
    where: { razorpayPaymentId: payment.id }
  });

  if (paymentRecord) {
    await paymentRecord.update({
      status: 'captured',
      capturedAt: new Date(payment.created_at * 1000),
      fee: payment.fee ? payment.fee / 100 : null,
      tax: payment.tax ? payment.tax / 100 : null
    });
  }

  // Update order status
  await dbOrder.update({
    paymentStatus: 'completed',
    paymentId: payment.id,
    paymentCapturedAt: new Date(),
    webhookEventId: webhookPayload.event.id,
    lastWebhookPayload: webhookPayload
  });

  // 🎯 CREATE PURCHASE RECORD - Only after successful payment verification
  try {
    // Check if purchase already exists to prevent duplicates
    const existingPurchase = await Purchase.findOne({
      where: { webhookEventId: webhookPayload.event.id }
    });

    if (!existingPurchase) {
      const purchaseData = await Purchase.createFromVerifiedPayment(
        {
          orderId: dbOrder.orderId,
          razorpayOrderId: dbOrder.razorpayOrderId,
          customerName: dbOrder.customerName,
          customerEmail: dbOrder.customerEmail,
          customerPhone: dbOrder.customerPhone,
          items: dbOrder.items || [],
          amount: dbOrder.amount,
          currency: dbOrder.currency,
          shippingAddress: dbOrder.shippingAddress || {}
        },
        {
          razorpayPaymentId: payment.id,
          method: payment.method,
          status: 'captured',
          fee: payment.fee ? payment.fee / 100 : null,
          tax: payment.tax ? payment.tax / 100 : null,
          notes: payment.notes || {}
        },
        webhookPayload
      );

      console.log(`✅ Purchase record created: ${purchaseData.id} for order ${dbOrder.orderId}`);

      // Create transaction record for audit trail
      await Transaction.createTransaction({
        orderId: dbOrder.orderId,
        razorpayOrderId: dbOrder.razorpayOrderId,
        paymentId: payment.id,
        eventType: 'PURCHASE_CREATED',
        amount: dbOrder.amount,
        status: 'captured',
        method: payment.method,
        source: 'webhook',
        sourceEventId: webhookPayload.event.id,
        metadata: {
          purchaseId: purchaseData.id,
          customerEmail: dbOrder.customerEmail,
          itemCount: dbOrder.items ? dbOrder.items.length : 0
        }
      });
    } else {
      console.log(`Purchase already exists for webhook event: ${webhookPayload.event.id}`);
    }
  } catch (purchaseError) {
    console.error('Error creating purchase record:', purchaseError);
    // Don't fail the webhook processing if purchase creation fails
    // The payment is still successful, we just log the error
  }

  // Broadcast update via WebSocket
  if (io) {
    broadcastPaymentUpdate(io, dbOrder.orderId, {
      orderId: dbOrder.orderId,
      paymentStatus: 'completed',
      paymentId: payment.id,
      amount: dbOrder.amount,
      method: payment.method,
      purchaseCreated: true
    });
  }

  return { handled: true, status: 'captured', orderId: dbOrder.orderId, purchaseCreated: true };
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(payment, order, webhookPayload, io) {
  console.log('Processing payment.failed event:', payment.id);

  // Find the order in our database
  const dbOrder = await Order.findOne({
    where: {
      [Op.or]: [
        { razorpayOrderId: order.id },
        { orderId: order.receipt }
      ]
    }
  });

  if (!dbOrder) {
    throw new Error(`Order not found for payment.failed: ${order.id}`);
  }

  // Update payment record
  const paymentRecord = await Payment.findOne({
    where: { razorpayPaymentId: payment.id }
  });

  if (paymentRecord) {
    await paymentRecord.update({
      status: 'failed',
      failedAt: new Date(),
      errorCode: payment.error_code,
      errorDescription: payment.error_description
    });
  }

  // Update order status
  await dbOrder.update({
    paymentStatus: 'failed',
    webhookEventId: webhookPayload.event.id,
    lastWebhookPayload: webhookPayload
  });

  // Broadcast update via WebSocket
  if (io) {
    broadcastPaymentUpdate(io, dbOrder.orderId, {
      orderId: dbOrder.orderId,
      paymentStatus: 'failed',
      paymentId: payment.id,
      amount: dbOrder.amount,
      error: payment.error_description
    });
  }

  return { handled: true, status: 'failed', orderId: dbOrder.orderId };
}

/**
 * Handle order.paid event
 */
async function handleOrderPaid(payment, order, webhookPayload, io) {
  console.log('Processing order.paid event:', order.id);

  // Find the order in our database
  const dbOrder = await Order.findOne({
    where: {
      [Op.or]: [
        { razorpayOrderId: order.id },
        { orderId: order.receipt }
      ]
    }
  });

  if (!dbOrder) {
    throw new Error(`Order not found for order.paid: ${order.id}`);
  }

  // Update order status to completed if not already
  if (dbOrder.paymentStatus !== 'completed') {
    await dbOrder.update({
      paymentStatus: 'completed',
      webhookEventId: webhookPayload.event.id,
      lastWebhookPayload: webhookPayload
    });
  }

  // 🎯 CREATE PURCHASE RECORD - Only after successful payment verification
  try {
    // Check if purchase already exists to prevent duplicates
    const existingPurchase = await Purchase.findOne({
      where: { webhookEventId: webhookPayload.event.id }
    });

    if (!existingPurchase) {
      // For order.paid events, we might not have detailed payment info
      // So we'll use the order data and try to find the payment record
      let paymentInfo = payment;
      if (!paymentInfo && dbOrder.paymentId) {
        const paymentRecord = await Payment.findOne({
          where: { razorpayPaymentId: dbOrder.paymentId }
        });
        if (paymentRecord) {
          paymentInfo = {
            id: paymentRecord.razorpayPaymentId,
            method: paymentRecord.method,
            fee: paymentRecord.fee ? paymentRecord.fee * 100 : null, // Convert back to paise
            tax: paymentRecord.tax ? paymentRecord.tax * 100 : null,
            notes: paymentRecord.notes || {}
          };
        }
      }

      const purchaseData = await Purchase.createFromVerifiedPayment(
        {
          orderId: dbOrder.orderId,
          razorpayOrderId: dbOrder.razorpayOrderId,
          customerName: dbOrder.customerName,
          customerEmail: dbOrder.customerEmail,
          customerPhone: dbOrder.customerPhone,
          items: dbOrder.items || [],
          amount: dbOrder.amount,
          currency: dbOrder.currency,
          shippingAddress: dbOrder.shippingAddress || {}
        },
        {
          razorpayPaymentId: paymentInfo?.id || dbOrder.paymentId || 'unknown',
          method: paymentInfo?.method || dbOrder.paymentMethod || 'unknown',
          status: 'captured',
          fee: paymentInfo?.fee ? paymentInfo.fee / 100 : null,
          tax: paymentInfo?.tax ? paymentInfo.tax / 100 : null,
          notes: paymentInfo?.notes || {}
        },
        webhookPayload
      );

      console.log(`✅ Purchase record created from order.paid: ${purchaseData.id} for order ${dbOrder.orderId}`);

      // Create transaction record for audit trail
      await Transaction.createTransaction({
        orderId: dbOrder.orderId,
        razorpayOrderId: dbOrder.razorpayOrderId,
        paymentId: paymentInfo?.id || dbOrder.paymentId,
        eventType: 'PURCHASE_CREATED',
        amount: dbOrder.amount,
        status: 'captured',
        method: paymentInfo?.method || dbOrder.paymentMethod,
        source: 'webhook',
        sourceEventId: webhookPayload.event.id,
        metadata: {
          purchaseId: purchaseData.id,
          customerEmail: dbOrder.customerEmail,
          itemCount: dbOrder.items ? dbOrder.items.length : 0,
          eventType: 'order.paid'
        }
      });
    } else {
      console.log(`Purchase already exists for webhook event: ${webhookPayload.event.id}`);
    }
  } catch (purchaseError) {
    console.error('Error creating purchase record from order.paid:', purchaseError);
    // Don't fail the webhook processing if purchase creation fails
  }

  // Broadcast update via WebSocket
  if (io) {
    broadcastOrderUpdate(io, dbOrder.orderId, {
      orderId: dbOrder.orderId,
      paymentStatus: 'completed',
      amount: dbOrder.amount,
      purchaseCreated: true
    });
  }

  return { handled: true, status: 'paid', orderId: dbOrder.orderId, purchaseCreated: true };
}

console.log('Payment webhook processor started');

module.exports = paymentQueue;
