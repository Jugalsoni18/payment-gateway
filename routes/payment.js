const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { broadcastPaymentUpdate, broadcastOrderUpdate } = require('../utils/websocket');
const PaymentLogger = require('../services/paymentLogger');
const paymentQueue = require('../queues/paymentQueue');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create a new payment order
router.post('/create', async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: 'receipt_' + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    // Generate UPI payment URL
    const upiData = {
      pa: process.env.UPI_VPA || 'example@upi', // Your UPI ID from .env
      pn: process.env.MERCHANT_NAME || 'ShopEasy',
      tr: order.id,
      am: amount.toString(),
      cu: 'INR',
      tn: `Payment for Order ${order.id}`
    };

    const upiUrl = `upi://pay?${Object.entries(upiData)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')}`;

    // Generate QR code
    const qrCode = await QRCode.toDataURL(upiUrl);

    res.json({
      ...order,
      qrCode,
      upiLink: upiUrl
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new order and payment (endpoint used by checkout.js)
router.post('/create-order', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      amount,
      items
    } = req.body;

    // Create order in database
    const orderId = 'ORD' + Date.now();

    // Create Razorpay order first
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: orderId,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Now create order in database with Razorpay order ID
    const newOrder = await Order.create({
      orderId,
      amount,
      customerName,
      customerEmail,
      customerPhone,
      items,
      shippingAddress,
      paymentStatus: 'pending',
      razorpayOrderId: razorpayOrder.id  // Store Razorpay order ID
    });

    // Log order creation
    try {
      await PaymentLogger.logOrderCreated({
        orderId,
        razorpayOrderId: razorpayOrder.id,
        amount,
        customerName,
        customerEmail,
        customerPhone,
        items,
        shippingAddress
      }, {
        source: 'api',
        requestData: req.body,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (logError) {
      console.error('Error logging order creation:', logError);
      // Don't fail the order creation if logging fails
    }

    // Generate UPI payment URL with proper merchant information
    const upiData = {
      pa: process.env.UPI_VPA || 'example@upi', // Your UPI ID from .env
      pn: process.env.MERCHANT_NAME || 'ShopEasy',
      tr: orderId.substring(0, 10), // Shorten transaction reference to avoid length issues
      am: parseFloat(amount).toFixed(2), // Format amount with 2 decimal places
      cu: 'INR',
      tn: `Order ${orderId.substring(0, 8)}`, // Shorter description
      mc: '5411', // Merchant Category Code for Shopping
      mid: 'SHOPEASY', // Merchant ID
      mnum: '9876543210', // Merchant phone number
      tid: `TXN${Date.now().toString().substring(7, 13)}` // Transaction ID
    };

    const upiUrl = `upi://pay?${Object.entries(upiData)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')}`;

    // Generate QR code
    const qrCode = await QRCode.toDataURL(upiUrl);

    res.json({
      success: true,
      orderId: orderId,
      amount: amount,
      razorpayOrderId: razorpayOrder.id,
      qrCode,
      upiLink: upiUrl
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Regenerate QR code for an existing order
router.post('/regenerate-qr', async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and amount are required'
      });
    }

    // Check if order exists
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Generate UPI payment URL with proper merchant information
    const upiData = {
      pa: process.env.UPI_VPA || 'example@upi', // Your UPI ID from .env
      pn: process.env.MERCHANT_NAME || 'ShopEasy',
      tr: orderId.substring(0, 10), // Shorten transaction reference to avoid length issues
      am: parseFloat(amount).toFixed(2), // Format amount with 2 decimal places
      cu: 'INR',
      tn: `Order ${orderId.substring(0, 8)}`, // Shorter description
      mc: '5411', // Merchant Category Code for Shopping
      mid: 'SHOPEASY', // Merchant ID
      mnum: '9876543210', // Merchant phone number
      tid: `TXN${Date.now().toString().substring(7, 13)}` // Transaction ID
    };

    const upiUrl = `upi://pay?${Object.entries(upiData)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')}`;

    // Generate QR code
    const qrCode = await QRCode.toDataURL(upiUrl);

    // Update order with QR code if not already set
    if (!order.qrCode) {
      await order.update({ qrCode });
    }

    res.json({
      success: true,
      orderId: orderId,
      amount: amount,
      qrCode,
      upiLink: upiUrl
    });
  } catch (error) {
    console.error('Error regenerating QR code:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Verify payment (Razorpay verification)
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Update order status
      const order = await Order.findByPk(orderId);
      if (order) {
        await order.update({
          paymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          paymentStatus: 'completed'
        });
      }
      res.json({ status: 'success' });
    } else {
      res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get payment status for polling fallback (simplified endpoint)
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order by orderId or razorpayOrderId
    const order = await Order.findOne({
      where: {
        [Op.or]: [
          { orderId: orderId },
          { razorpayOrderId: orderId }
        ]
      }
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        orderId: orderId
      });
    }

    res.json({
      status: order.paymentStatus,
      orderId: order.orderId,
      amount: order.amount,
      paymentId: order.paymentId,
      updatedAt: order.updatedAt
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({
      error: 'Failed to fetch payment status',
      message: error.message
    });
  }
});

// Get merchant configuration (public information only)
router.get('/merchant-config', (req, res) => {
  try {
    const config = {
      upiVpa: process.env.UPI_VPA || 'example@upi',
      merchantName: process.env.MERCHANT_NAME || 'ShopEasy',
      merchantPhone: process.env.MERCHANT_PHONE || '9876543210'
    };

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error fetching merchant config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch merchant configuration'
    });
  }
});

// UPI payment callback/webhook endpoint
router.get('/upi-callback', async (req, res) => {
  try {
    // Extract all possible parameters that UPI apps might send
    const {
      orderId,
      status,
      txnId,
      txnRef,
      responseCode,
      approvalRefNo,
      transactionId,
      transactionRefId,
      Status,  // Some UPI apps use capital S
      txStatus, // Some use txStatus
      success   // Some use success=true/false
    } = req.query;

    // Log all parameters for debugging
    console.log('UPI Callback received:', req.query);

    // Get the order ID from various possible parameters
    const actualOrderId = orderId || txnRef || transactionRefId || req.query.tr;

    if (!actualOrderId) {
      console.error('No order ID found in callback parameters');
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Find the order
    const order = await Order.findByPk(actualOrderId);
    if (!order) {
      console.error(`Order not found: ${actualOrderId}`);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Determine payment status from various possible parameters
    let paymentStatus = 'pending';

    // Check all possible status indicators
    if (status === 'SUCCESS' ||
        status === 'success' ||
        Status === 'SUCCESS' ||
        txStatus === 'SUCCESS' ||
        success === 'true' ||
        responseCode === '00' ||
        responseCode === '0') {
      paymentStatus = 'completed';
    } else if (status === 'FAILURE' ||
               status === 'failed' ||
               Status === 'FAILURE' ||
               txStatus === 'FAILURE' ||
               success === 'false' ||
               responseCode === '01' ||
               responseCode === '1') {
      paymentStatus = 'failed';
    } else {
      // If no status parameter is provided, check if we have a transaction ID
      // If we have a transaction ID, it's likely the payment was successful
      if (txnId || approvalRefNo || transactionId) {
        paymentStatus = 'completed';
      }
    }

    // Get the transaction ID from various possible parameters
    const actualTxnId = txnId || approvalRefNo || transactionId || `UPI_${Date.now()}`;

    console.log(`Updating order ${actualOrderId} status to ${paymentStatus}`);

    // Update order status
    await order.update({
      paymentId: actualTxnId,
      paymentStatus: paymentStatus
    });

    // Log payment completion
    try {
      await PaymentLogger.logPaymentSuccess({
        orderId: actualOrderId,
        paymentId: actualTxnId,
        amount: order.amount,
        status: paymentStatus === 'completed' ? 'paid' : paymentStatus,
        method: 'upi',
        transactionId: actualTxnId
      }, {
        source: 'callback',
        responseData: {
          orderId: actualOrderId,
          status: status,
          txnId: actualTxnId,
          responseCode: responseCode
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (logError) {
      console.error('Error logging payment success:', logError);
      // Don't fail the callback if logging fails
    }

    // Broadcast WebSocket update to connected clients
    const io = req.app.get('io');
    if (io) {
      try {
        broadcastPaymentUpdate(io, actualOrderId, {
          orderId: actualOrderId,
          paymentStatus: paymentStatus,
          paymentId: actualTxnId,
          amount: order.amount,
          customerName: order.customerName,
          updatedAt: new Date()
        });
        console.log(`WebSocket update broadcasted for order ${actualOrderId}`);
      } catch (wsError) {
        console.error('Error broadcasting WebSocket update:', wsError);
        // Don't fail the callback if WebSocket fails
      }
    }

    // Redirect to payment page with orderId and status
    res.redirect(`/payment.html?orderId=${actualOrderId}&status=${paymentStatus}`);
  } catch (error) {
    console.error('Error in UPI callback:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});



// Check payment status endpoint
router.get('/check-status/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log(`Checking status for order ${orderId}`);

    // Set a timeout for the database query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 5000);
    });

    // Find the order with timeout
    let order;
    try {
      order = await Promise.race([
        Order.findByPk(orderId, {
          include: [{
            model: Payment,
            as: 'payments',
            required: false
          }]
        }),
        timeoutPromise
      ]);
    } catch (dbError) {
      console.error(`Database error for order ${orderId}:`, dbError);
      return res.status(503).json({
        success: false,
        message: 'Database temporarily unavailable',
        retryAfter: 5
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Log current order status for debugging
    console.log(`Order ${orderId} current status:`, {
      paymentStatus: order.paymentStatus,
      paymentId: order.paymentId,
      paymentMethod: order.paymentMethod,
      updatedAt: order.updatedAt
    });

    // Log how long the order has been pending (for monitoring purposes only)
    if (order.paymentStatus === 'pending') {
      const createdAt = new Date(order.createdAt);
      const now = new Date();
      const timeDiff = (now - createdAt) / 1000; // in seconds
      console.log(`Order ${orderId} is pending for ${timeDiff} seconds`);
    }

    // Return order status (only real payment status, no auto-updates)
    res.json({
      success: true,
      orderId: order.orderId,
      amount: order.amount,
      paymentStatus: order.paymentStatus,
      paymentId: order.paymentId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    // Send a more client-friendly error response
    res.status(500).json({
      success: false,
      message: 'Server temporarily unavailable',
      error: error.message,
      retryAfter: 5
    });
  }
});



// Get payment details by payment ID
router.get('/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Find payment in our database
    const payment = await Payment.findOne({
      where: { razorpayPaymentId: paymentId },
      include: [{
        model: Order,
        as: 'order',
        foreignKey: 'orderId',
        targetKey: 'orderId'
      }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: payment
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all payments for an order
router.get('/order/:orderId/payments', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find all payments for the order
    const payments = await Payment.findAll({
      where: { orderId: orderId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      payments: payments
    });
  } catch (error) {
    console.error('Error fetching order payments:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Manual payment completion endpoint for testing/debugging
router.post('/complete-payment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentId, method = 'upi' } = req.body;

    console.log(`Manual completion requested for order ${orderId}`);

    // Find the order
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Generate payment ID if not provided
    const actualPaymentId = paymentId || `MANUAL_${Date.now()}`;

    // Update order status using a transaction to ensure consistency
    await sequelize.transaction(async (t) => {
      await order.update({
        paymentStatus: 'completed',
        paymentId: actualPaymentId,
        paymentMethod: method,
        paymentCapturedAt: new Date()
      }, { transaction: t });

      // Also create a payment record
      await Payment.create({
        razorpayPaymentId: actualPaymentId,
        razorpayOrderId: order.razorpayOrderId || `RZP_${Date.now()}`,
        orderId: orderId,
        amount: order.amount,
        currency: 'INR',
        status: 'captured',
        method: method,
        capturedAt: new Date(),
        notes: { manual: true, completedBy: 'admin' }
      }, { transaction: t });
    });

    console.log(`Order ${orderId} manually completed with payment ID ${actualPaymentId}`);

    // Broadcast WebSocket update to connected clients
    const io = req.app.get('io');
    if (io) {
      try {
        broadcastPaymentUpdate(io, orderId, {
          orderId: orderId,
          paymentStatus: 'completed',
          paymentId: actualPaymentId,
          amount: order.amount,
          customerName: order.customerName,
          paymentMethod: method,
          updatedAt: new Date()
        });
        console.log(`WebSocket update broadcasted for manually completed order ${orderId}`);
      } catch (wsError) {
        console.error('Error broadcasting WebSocket update:', wsError);
        // Don't fail the request if WebSocket fails
      }
    }

    res.json({
      success: true,
      message: 'Payment completed successfully',
      orderId: orderId,
      paymentId: actualPaymentId,
      paymentStatus: 'completed'
    });

  } catch (error) {
    console.error('Error completing payment manually:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete payment',
      error: error.message
    });
  }
});

// Enhanced payment status check with webhook data
router.get('/enhanced-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the order
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Find associated payments
    const payments = await Payment.findAll({
      where: { orderId: orderId },
      order: [['createdAt', 'DESC']]
    });

    // Get the latest payment
    const latestPayment = payments.length > 0 ? payments[0] : null;

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        amount: order.amount,
        paymentStatus: order.paymentStatus,
        paymentId: order.paymentId,
        razorpayOrderId: order.razorpayOrderId,
        paymentMethod: order.paymentMethod,
        paymentCapturedAt: order.paymentCapturedAt,
        webhookEventId: order.webhookEventId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      },
      latestPayment: latestPayment,
      allPayments: payments,
      paymentCount: payments.length
    });
  } catch (error) {
    console.error('Error fetching enhanced payment status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Diagnostic endpoint to check webhook configuration
router.get('/webhook-status', async (req, res) => {
  try {
    res.json({
      success: true,
      webhookEndpoint: '/api/payment/webhook',
      webhookSecretConfigured: !!process.env.RAZORPAY_WEBHOOK_SECRET,
      serverUrl: `${req.protocol}://${req.get('host')}`,
      fullWebhookUrl: `${req.protocol}://${req.get('host')}/api/payment/webhook`,
      instructions: {
        step1: 'Configure this URL in Razorpay Dashboard > Settings > Webhooks',
        step2: 'Select events: payment.captured, payment.failed, payment.authorized, order.paid',
        step3: 'Set webhook secret in environment variable RAZORPAY_WEBHOOK_SECRET',
        step4: 'Ensure this server is accessible from internet (use ngrok for local testing)'
      },
      troubleshooting: {
        localTesting: 'Use ngrok: ngrok http 3000, then use the https URL',
        webhookSecret: 'Must match exactly between Razorpay dashboard and .env file',
        events: 'Make sure to select the correct events in Razorpay dashboard'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Check order-razorpay linkage
router.get('/check-linkage/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order has Razorpay order ID
    const hasRazorpayOrderId = !!order.razorpayOrderId;

    // Find any payments for this order
    const payments = await Payment.findAll({
      where: { orderId: orderId }
    });

    res.json({
      success: true,
      orderId: order.orderId,
      razorpayOrderId: order.razorpayOrderId,
      hasRazorpayOrderId: hasRazorpayOrderId,
      paymentStatus: order.paymentStatus,
      paymentsCount: payments.length,
      payments: payments.map(p => ({
        id: p.id,
        razorpayPaymentId: p.razorpayPaymentId,
        status: p.status,
        amount: p.amount,
        method: p.method,
        createdAt: p.createdAt
      })),
      webhookData: {
        webhookEventId: order.webhookEventId,
        lastWebhookPayload: order.lastWebhookPayload ? 'Present' : 'None'
      },
      diagnosis: {
        canReceiveWebhooks: hasRazorpayOrderId,
        issue: !hasRazorpayOrderId ? 'Order not linked to Razorpay - webhooks will not work' : null,
        solution: !hasRazorpayOrderId ? 'Recreate order or manually link razorpayOrderId' : 'Order properly configured for webhooks'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Webhook Event Handlers
async function handlePaymentAuthorized(payment, order, webhookPayload) {
  try {
    console.log('Processing payment.authorized event:', payment.id);

    // Find the order in our database by receipt (which should match our orderId)
    const dbOrder = await Order.findOne({
      where: {
        [Op.or]: [
          { razorpayOrderId: order.id },
          { orderId: order.receipt }
        ]
      }
    });

    if (!dbOrder) {
      console.error('Order not found for payment.authorized:', order.id);
      return;
    }

    // Create or update payment record
    const [paymentRecord, created] = await Payment.findOrCreate({
      where: { razorpayPaymentId: payment.id },
      defaults: {
        razorpayPaymentId: payment.id,
        razorpayOrderId: order.id,
        orderId: dbOrder.orderId,
        amount: payment.amount / 100, // Convert from paise to rupees
        currency: payment.currency,
        status: 'authorized',
        method: payment.method,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
        cardId: payment.card_id,
        cardLast4: payment.card?.last4,
        cardNetwork: payment.card?.network,
        cardType: payment.card?.type,
        authorizedAt: new Date(payment.created_at * 1000),
        international: payment.international,
        fee: payment.fee ? payment.fee / 100 : null,
        tax: payment.tax ? payment.tax / 100 : null,
        webhookEventId: webhookPayload.event.id,
        webhookEventType: 'payment.authorized',
        lastWebhookPayload: webhookPayload,
        notes: payment.notes || {}
      }
    });

    if (!created) {
      // Update existing payment record
      await paymentRecord.update({
        status: 'authorized',
        authorizedAt: new Date(payment.created_at * 1000),
        webhookEventId: webhookPayload.event.id,
        webhookEventType: 'payment.authorized',
        lastWebhookPayload: webhookPayload
      });
    }

    // Update order status
    await dbOrder.update({
      paymentId: payment.id,
      paymentStatus: 'authorized',
      paymentMethod: payment.method,
      webhookEventId: webhookPayload.event.id,
      lastWebhookPayload: webhookPayload
    });

    console.log('Payment authorized successfully:', payment.id);
  } catch (error) {
    console.error('Error handling payment.authorized:', error);
    throw error;
  }
}

async function handlePaymentCaptured(payment, order, webhookPayload) {
  try {
    console.log('Processing payment.captured event:', payment.id);

    // Find the order in our database by receipt (which should match our orderId)
    const dbOrder = await Order.findOne({
      where: {
        [Op.or]: [
          { razorpayOrderId: order.id },
          { orderId: order.receipt }
        ]
      }
    });

    if (!dbOrder) {
      console.error('Order not found for payment.captured:', order.id);
      return;
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
        status: 'captured',
        method: payment.method,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
        cardId: payment.card_id,
        cardLast4: payment.card?.last4,
        cardNetwork: payment.card?.network,
        cardType: payment.card?.type,
        authorizedAt: payment.authorized_at ? new Date(payment.authorized_at * 1000) : null,
        capturedAt: new Date(payment.captured_at * 1000),
        international: payment.international,
        fee: payment.fee ? payment.fee / 100 : null,
        tax: payment.tax ? payment.tax / 100 : null,
        refundStatus: payment.refund_status || 'null',
        amountRefunded: payment.amount_refunded ? payment.amount_refunded / 100 : 0,
        webhookEventId: webhookPayload.event.id,
        webhookEventType: 'payment.captured',
        lastWebhookPayload: webhookPayload,
        notes: payment.notes || {}
      }
    });

    if (!created) {
      // Update existing payment record
      await paymentRecord.update({
        status: 'captured',
        capturedAt: new Date(payment.captured_at * 1000),
        refundStatus: payment.refund_status || 'null',
        amountRefunded: payment.amount_refunded ? payment.amount_refunded / 100 : 0,
        webhookEventId: webhookPayload.event.id,
        webhookEventType: 'payment.captured',
        lastWebhookPayload: webhookPayload
      });
    }

    // Update order status to completed
    await dbOrder.update({
      paymentId: payment.id,
      paymentStatus: 'completed',
      paymentMethod: payment.method,
      paymentCapturedAt: new Date(payment.captured_at * 1000),
      webhookEventId: webhookPayload.event.id,
      lastWebhookPayload: webhookPayload
    });

    // Log payment capture
    try {
      await PaymentLogger.logPaymentSuccess({
        orderId: dbOrder.orderId,
        paymentId: payment.id,
        razorpayPaymentId: payment.id,
        razorpayOrderId: order.id,
        amount: payment.amount / 100,
        currency: payment.currency,
        method: payment.method,
        status: 'captured',
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
        cardLast4: payment.card?.last4,
        cardNetwork: payment.card?.network,
        fee: payment.fee ? payment.fee / 100 : null,
        tax: payment.tax ? payment.tax / 100 : null
      }, {
        source: 'webhook',
        webhookEventId: webhookPayload.event.id,
        webhookEventType: 'payment.captured',
        responseData: webhookPayload
      });
    } catch (logError) {
      console.error('Error logging payment capture:', logError);
      // Don't fail the webhook if logging fails
    }

    // Broadcast WebSocket update for payment completion
    try {
      // Get io instance from the app (we need to pass it through the webhook context)
      // For now, we'll add this functionality when we have access to the io instance
      console.log('Payment captured - WebSocket broadcast would be sent here for order:', dbOrder.orderId);
    } catch (wsError) {
      console.error('Error broadcasting WebSocket update for payment.captured:', wsError);
    }

    console.log('Payment captured successfully:', payment.id);
  } catch (error) {
    console.error('Error handling payment.captured:', error);
    throw error;
  }
}

async function handlePaymentFailed(payment, order, webhookPayload) {
  try {
    console.log('Processing payment.failed event:', payment.id);

    // Find the order in our database by receipt (which should match our orderId)
    const dbOrder = await Order.findOne({
      where: {
        [Op.or]: [
          { razorpayOrderId: order.id },
          { orderId: order.receipt }
        ]
      }
    });

    if (!dbOrder) {
      console.error('Order not found for payment.failed:', order.id);
      return;
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
        status: 'failed',
        method: payment.method,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
        cardId: payment.card_id,
        cardLast4: payment.card?.last4,
        cardNetwork: payment.card?.network,
        cardType: payment.card?.type,
        failedAt: new Date(payment.created_at * 1000),
        international: payment.international,
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        errorSource: payment.error_source,
        errorStep: payment.error_step,
        errorReason: payment.error_reason,
        webhookEventId: webhookPayload.event.id,
        webhookEventType: 'payment.failed',
        lastWebhookPayload: webhookPayload,
        notes: payment.notes || {}
      }
    });

    if (!created) {
      // Update existing payment record
      await paymentRecord.update({
        status: 'failed',
        failedAt: new Date(payment.created_at * 1000),
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        errorSource: payment.error_source,
        errorStep: payment.error_step,
        errorReason: payment.error_reason,
        webhookEventId: webhookPayload.event.id,
        webhookEventType: 'payment.failed',
        lastWebhookPayload: webhookPayload
      });
    }

    // Update order status to failed
    await dbOrder.update({
      paymentId: payment.id,
      paymentStatus: 'failed',
      paymentMethod: payment.method,
      webhookEventId: webhookPayload.event.id,
      lastWebhookPayload: webhookPayload
    });

    // Log payment failure
    try {
      await PaymentLogger.logPaymentFailure({
        orderId: dbOrder.orderId,
        paymentId: payment.id,
        razorpayPaymentId: payment.id,
        razorpayOrderId: order.id,
        amount: payment.amount / 100,
        currency: payment.currency,
        method: payment.method,
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        errorSource: payment.error_source
      }, {
        source: 'webhook',
        webhookEventId: webhookPayload.event.id,
        webhookEventType: 'payment.failed',
        responseData: webhookPayload
      });
    } catch (logError) {
      console.error('Error logging payment failure:', logError);
      // Don't fail the webhook if logging fails
    }

    console.log('Payment failed processed:', payment.id);
  } catch (error) {
    console.error('Error handling payment.failed:', error);
    throw error;
  }
}

async function handleOrderPaid(payment, order, webhookPayload) {
  try {
    console.log('Processing order.paid event:', order.id);

    // Find the order in our database by receipt (which should match our orderId)
    const dbOrder = await Order.findOne({
      where: {
        [Op.or]: [
          { razorpayOrderId: order.id },
          { orderId: order.receipt }
        ]
      }
    });

    if (!dbOrder) {
      console.error('Order not found for order.paid:', order.id);
      return;
    }

    // Update order status to completed if not already
    if (dbOrder.paymentStatus !== 'completed') {
      await dbOrder.update({
        paymentStatus: 'completed',
        webhookEventId: webhookPayload.event.id,
        lastWebhookPayload: webhookPayload
      });
    }

    console.log('Order paid processed:', order.id);
  } catch (error) {
    console.error('Error handling order.paid:', error);
    throw error;
  }
}

// Razorpay Webhook Endpoint (with Queue System)
router.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', {
      headers: req.headers,
      bodyLength: req.body ? req.body.length : 0
    });

    // Get the webhook signature from headers
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSignature) {
      console.error('Missing webhook signature');
      return res.status(400).json({
        error: 'Missing webhook signature'
      });
    }

    // Parse the webhook payload first for basic validation
    let webhookData;
    try {
      webhookData = JSON.parse(req.body.toString());
    } catch (parseError) {
      console.error('Invalid JSON in webhook payload:', parseError);
      return res.status(400).json({
        error: 'Invalid JSON payload'
      });
    }

    // Quick duplicate check before queuing
    const { event: eventInfo } = webhookData;
    const eventId = eventInfo ? eventInfo.id : `event_${Date.now()}`;

    if (eventId && eventId !== `event_${Date.now()}`) {
      const existingPayment = await Payment.findOne({
        where: { webhookEventId: eventId }
      });

      if (existingPayment) {
        console.log('Duplicate webhook event ignored:', eventId);
        return res.status(200).json({
          status: 'success',
          message: 'Duplicate event ignored'
        });
      }
    }

    // Add webhook to queue for processing with retry mechanism
    const job = await paymentQueue.add('process-webhook', {
      webhookData,
      signature: webhookSignature,
      io: req.app.get('io'), // Pass Socket.IO instance
      timestamp: new Date().toISOString(),
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip']
      }
    }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 30000 // Start with 30 second delay
      },
      removeOnComplete: 50,
      removeOnFail: 100
    });

    console.log(`Webhook queued for processing: Job ID ${job.id}, Event: ${eventInfo?.event || 'unknown'}`);

    // Respond immediately to Razorpay (webhook queued successfully)
    res.status(200).json({
      status: 'success',
      message: 'Webhook queued for processing',
      jobId: job.id,
      event: eventInfo?.event || 'unknown'
    });

  } catch (error) {
    console.error('Webhook queueing error:', error);

    // Log the error for monitoring
    try {
      await PaymentLogger.logWebhookEvent('webhook.queue_error', {
        error: error.message,
        stack: error.stack,
        headers: req.headers,
        bodyLength: req.body ? req.body.length : 0
      });
    } catch (logError) {
      console.error('Error logging webhook queue error:', logError);
    }

    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
});

// Payment Logs API Endpoints

// Get payment logs for a specific order
router.get('/logs/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { eventType, status, limit = 50, offset = 0 } = req.query;

    const logs = await PaymentLogger.getOrderLogs(orderId, {
      eventType,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      orderId,
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('Error fetching payment logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment logs',
      message: error.message
    });
  }
});

// Get payment logs summary for reporting
router.get('/logs-summary', async (req, res) => {
  try {
    const { startDate, endDate, status, method } = req.query;

    const filters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (status) filters.status = status;
    if (method) filters.method = method;

    const summary = await PaymentLogger.getLogsSummary(filters);

    res.json({
      success: true,
      summary,
      filters
    });
  } catch (error) {
    console.error('Error fetching payment logs summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment logs summary',
      message: error.message
    });
  }
});

// Get all payment logs with pagination and filtering
router.get('/logs', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      method,
      eventType,
      source,
      startDate,
      endDate,
      orderId,
      paymentId
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { Op } = require('sequelize');
    const PaymentLog = require('../models/PaymentLog');

    // Build where clause
    const whereClause = {};

    if (status) whereClause.status = status;
    if (method) whereClause.method = method;
    if (eventType) whereClause.event_type = eventType;
    if (source) whereClause.source = source;
    if (orderId) whereClause.order_id = orderId;
    if (paymentId) whereClause.payment_id = paymentId;

    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      whereClause.created_at = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.created_at = {
        [Op.lte]: new Date(endDate)
      };
    }

    const { count, rows: logs } = await PaymentLog.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    res.json({
      success: true,
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords: count,
        limit: parseInt(limit),
        offset
      },
      filters: {
        status,
        method,
        eventType,
        source,
        startDate,
        endDate,
        orderId,
        paymentId
      }
    });
  } catch (error) {
    console.error('Error fetching payment logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment logs',
      message: error.message
    });
  }
});

module.exports = router;