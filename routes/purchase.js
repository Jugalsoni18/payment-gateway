const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { Op } = require('sequelize');

/**
 * Get all purchases with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      customerEmail,
      paymentStatus,
      fulfillmentStatus,
      startDate,
      endDate,
      minAmount,
      maxAmount
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Apply filters
    if (customerEmail) {
      whereClause.customerEmail = { [Op.iLike]: `%${customerEmail}%` };
    }

    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus;
    }

    if (fulfillmentStatus) {
      whereClause.fulfillmentStatus = fulfillmentStatus;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    if (minAmount || maxAmount) {
      whereClause.amount = {};
      if (minAmount) whereClause.amount[Op.gte] = parseFloat(minAmount);
      if (maxAmount) whereClause.amount[Op.lte] = parseFloat(maxAmount);
    }

    const { count, rows: purchases } = await Purchase.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      attributes: [
        'id', 'orderId', 'customerName', 'customerEmail', 'customerPhone',
        'amount', 'paymentMethod', 'paymentStatus', 'fulfillmentStatus',
        'items', 'verifiedAt', 'createdAt'
      ]
    });

    res.json({
      success: true,
      purchases,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchases',
      error: error.message
    });
  }
});

/**
 * Get purchase by ID with full details
 */
router.get('/:purchaseId', async (req, res) => {
  try {
    const { purchaseId } = req.params;

    const purchase = await Purchase.findByPk(purchaseId);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    res.json({
      success: true,
      purchase
    });

  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase',
      error: error.message
    });
  }
});

/**
 * Get customer purchase history
 */
router.get('/customer/:customerEmail', async (req, res) => {
  try {
    const { customerEmail } = req.params;
    const { limit = 10 } = req.query;

    const purchases = await Purchase.getCustomerPurchases(customerEmail, parseInt(limit));

    res.json({
      success: true,
      customerEmail,
      purchases,
      totalPurchases: purchases.length
    });

  } catch (error) {
    console.error('Error fetching customer purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer purchases',
      error: error.message
    });
  }
});

/**
 * Update purchase fulfillment status
 */
router.patch('/:purchaseId/fulfillment', async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { fulfillmentStatus, fulfillmentNotes } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(fulfillmentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fulfillment status',
        validStatuses
      });
    }

    const purchase = await Purchase.findByPk(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    await purchase.update({
      fulfillmentStatus,
      fulfillmentNotes: fulfillmentNotes || purchase.fulfillmentNotes
    });

    res.json({
      success: true,
      message: 'Fulfillment status updated successfully',
      purchase: {
        id: purchase.id,
        orderId: purchase.orderId,
        fulfillmentStatus: purchase.fulfillmentStatus,
        fulfillmentNotes: purchase.fulfillmentNotes
      }
    });

  } catch (error) {
    console.error('Error updating fulfillment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fulfillment status',
      error: error.message
    });
  }
});

/**
 * Get purchase analytics
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const analytics = await Purchase.getPurchaseAnalytics(
      new Date(startDate),
      new Date(endDate)
    );

    // Calculate summary statistics
    const summary = {
      totalPurchases: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      paymentMethods: {},
      fulfillmentStatus: {}
    };

    analytics.forEach(item => {
      summary.totalPurchases += parseInt(item.totalPurchases) || 0;
      summary.totalRevenue += parseFloat(item.totalRevenue) || 0;

      if (item.paymentMethod) {
        summary.paymentMethods[item.paymentMethod] =
          (summary.paymentMethods[item.paymentMethod] || 0) + parseInt(item.totalPurchases);
      }

      if (item.fulfillmentStatus) {
        summary.fulfillmentStatus[item.fulfillmentStatus] =
          (summary.fulfillmentStatus[item.fulfillmentStatus] || 0) + parseInt(item.totalPurchases);
      }
    });

    summary.averageOrderValue = summary.totalPurchases > 0 ?
      (summary.totalRevenue / summary.totalPurchases).toFixed(2) : 0;

    res.json({
      success: true,
      period: { startDate, endDate },
      summary,
      details: analytics
    });

  } catch (error) {
    console.error('Error fetching purchase analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase analytics',
      error: error.message
    });
  }
});

/**
 * Search purchases by order ID or payment ID
 */
router.get('/search/:searchTerm', async (req, res) => {
  try {
    const { searchTerm } = req.params;

    const purchases = await Purchase.findAll({
      where: {
        [Op.or]: [
          { orderId: { [Op.iLike]: `%${searchTerm}%` } },
          { razorpayOrderId: { [Op.iLike]: `%${searchTerm}%` } },
          { razorpayPaymentId: { [Op.iLike]: `%${searchTerm}%` } },
          { customerEmail: { [Op.iLike]: `%${searchTerm}%` } },
          { customerPhone: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      limit: 20,
      order: [['createdAt', 'DESC']],
      attributes: [
        'id', 'orderId', 'razorpayOrderId', 'razorpayPaymentId',
        'customerName', 'customerEmail', 'amount', 'paymentStatus',
        'fulfillmentStatus', 'createdAt'
      ]
    });

    res.json({
      success: true,
      searchTerm,
      results: purchases,
      count: purchases.length
    });

  } catch (error) {
    console.error('Error searching purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search purchases',
      error: error.message
    });
  }
});

/**
 * Get purchase verification status
 */
router.get('/:purchaseId/verification', async (req, res) => {
  try {
    const { purchaseId } = req.params;

    const purchase = await Purchase.findByPk(purchaseId, {
      attributes: [
        'id', 'orderId', 'webhookEventId', 'webhookEventType',
        'verifiedAt', 'paymentStatus', 'razorpayPaymentId'
      ]
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    // Check if corresponding order and payment exist
    const order = await Order.findOne({
      where: { orderId: purchase.orderId },
      attributes: ['orderId', 'paymentStatus', 'webhookEventId']
    });

    const payment = await Payment.findOne({
      where: { razorpayPaymentId: purchase.razorpayPaymentId },
      attributes: ['razorpayPaymentId', 'status', 'webhookEventId']
    });

    res.json({
      success: true,
      verification: {
        purchaseId: purchase.id,
        orderId: purchase.orderId,
        webhookEventId: purchase.webhookEventId,
        webhookEventType: purchase.webhookEventType,
        verifiedAt: purchase.verifiedAt,
        paymentStatus: purchase.paymentStatus,
        orderExists: !!order,
        paymentExists: !!payment,
        dataConsistency: {
          orderPaymentStatus: order?.paymentStatus,
          paymentStatus: payment?.status,
          webhookEventMatches: order?.webhookEventId === purchase.webhookEventId
        }
      }
    });

  } catch (error) {
    console.error('Error checking purchase verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check purchase verification',
      error: error.message
    });
  }
});

module.exports = router;
