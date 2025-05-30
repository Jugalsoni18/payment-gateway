const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const sequelize = require('../config/database');

// Test database connection
router.get('/test/connection', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'success',
      message: 'Database connection is working properly',
      details: {
        database: sequelize.config.database,
        host: sequelize.config.host,
        port: sequelize.config.port
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Unable to connect to the database',
      error: error.message
    });
  }
});

// Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.findAll();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific order by orderId
router.get('/:orderId', async (req, res) => {
  try {
    console.log(`Fetching order details for ${req.params.orderId}`);

    // Set a timeout for the database query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 3000);
    });

    // Find the order with timeout
    let order;
    try {
      order = await Promise.race([
        Order.findByPk(req.params.orderId),
        timeoutPromise
      ]);
    } catch (dbError) {
      console.error(`Database error for order ${req.params.orderId}:`, dbError);
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

    // Add success flag for consistent response format
    res.json({
      success: true,
      ...order.toJSON()
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Server temporarily unavailable',
      error: error.message,
      retryAfter: 5
    });
  }
});

// Create a new order (without payment processing)
router.post('/', async (req, res) => {
  try {
    const order = await Order.create({
      orderId: 'ORD' + Date.now(),
      amount: req.body.amount,
      customerName: req.body.customerName,
      customerEmail: req.body.customerEmail,
      customerPhone: req.body.customerPhone,
      items: req.body.items,
      shippingAddress: req.body.shippingAddress
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update order status
router.patch('/:orderId', async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const updates = {};
    if (req.body.paymentStatus) {
      updates.paymentStatus = req.body.paymentStatus;
    }
    if (req.body.paymentId) {
      updates.paymentId = req.body.paymentId;
    }

    await order.update(updates);
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
