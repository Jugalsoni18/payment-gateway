require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const redisAdapter = require('socket.io-redis');
const rateLimit = require('express-rate-limit');
const sequelize = require('./config/database');

// Import models to ensure they are loaded
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const PaymentLog = require('./models/PaymentLog');
const Transaction = require('./models/Transaction');
const Purchase = require('./models/Purchase');

// Set up model associations
Order.hasMany(Payment, {
  foreignKey: 'orderId',
  sourceKey: 'orderId',
  as: 'payments'
});
Payment.belongsTo(Order, {
  foreignKey: 'orderId',
  targetKey: 'orderId',
  as: 'order'
});

// Purchase model associations
Order.hasOne(Purchase, {
  foreignKey: 'orderId',
  sourceKey: 'orderId',
  as: 'purchase'
});

Purchase.belongsTo(Order, {
  foreignKey: 'orderId',
  targetKey: 'orderId',
  as: 'order'
});

Payment.hasOne(Purchase, {
  foreignKey: 'razorpayPaymentId',
  sourceKey: 'razorpayPaymentId',
  as: 'purchase'
});

Purchase.belongsTo(Payment, {
  foreignKey: 'razorpayPaymentId',
  targetKey: 'razorpayPaymentId',
  as: 'payment'
});

// Import routes
const paymentRoutes = require('./routes/payment');
const orderRoutes = require('./routes/order');
const purchaseRoutes = require('./routes/purchase');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configure Redis adapter for Socket.IO scaling
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  try {
    const redisConfig = process.env.REDIS_URL ?
      { url: process.env.REDIS_URL } :
      { host: process.env.REDIS_HOST || 'localhost', port: process.env.REDIS_PORT || 6379 };

    io.adapter(redisAdapter(redisConfig));
    console.log('Socket.IO Redis adapter configured');
  } catch (error) {
    console.warn('Redis not available, continuing without Redis adapter:', error.message);
  }
}

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors());

// Rate limiting for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many payment requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to payment routes
app.use('/api/payment', paymentLimiter);

// Special handling for webhook endpoint - needs raw body
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Regular JSON parsing for other endpoints
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to PostgreSQL and sync models
sequelize.authenticate()
  .then(() => {
    console.log('Connected to PostgreSQL');
    // Use force: false to avoid destructive schema changes
    // This will create tables if they don't exist but won't alter existing ones
    return sequelize.sync({ force: false });
  })
  .then(() => {
    console.log('Database synchronized');
  })
  .catch(err => {
    console.error('Database connection error:', err);
    console.log('Continuing without database connection. Some features may not work properly.');
  });

// Start payment queue processor
try {
  require('./workers/paymentProcessor');
  console.log('Payment queue processor started');
} catch (error) {
  console.error('Failed to start payment queue processor:', error);
  console.log('Continuing without queue processor. Webhooks will be processed synchronously.');
}

// Routes
app.use('/api/payment', paymentRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/purchase', purchaseRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle joining order-specific rooms for payment updates
  socket.on('join-order', (orderId) => {
    if (orderId && typeof orderId === 'string') {
      socket.join(`order-${orderId}`);
      console.log(`Socket ${socket.id} joined room: order-${orderId}`);

      // Send confirmation
      socket.emit('joined-order', { orderId, success: true });
    } else {
      socket.emit('joined-order', { orderId, success: false, error: 'Invalid order ID' });
    }
  });

  // Handle leaving order rooms
  socket.on('leave-order', (orderId) => {
    if (orderId && typeof orderId === 'string') {
      socket.leave(`order-${orderId}`);
      console.log(`Socket ${socket.id} left room: order-${orderId}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Handle ping for connection testing
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Serve the main HTML file for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to find available port
async function findAvailablePort(startPort) {
  const net = require('net');

  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });

    server.on('error', () => {
      // Port is in use, try next port
      findAvailablePort(startPort + 1).then(resolve);
    });
  });
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server with port availability check
async function startServer() {
  try {
    const availablePort = await findAvailablePort(PORT);

    if (availablePort !== PORT) {
      console.log(`Port ${PORT} is in use, using port ${availablePort} instead`);
    }

    server.listen(availablePort, () => {
      console.log(`🚀 Server running on port ${availablePort}`);
      console.log(`🔌 WebSocket server ready for connections`);
      console.log(`🌐 Access your application at: http://localhost:${availablePort}`);
      console.log(`📊 API endpoints available at: http://localhost:${availablePort}/api`);

      // Update PORT variable for other parts of the application
      process.env.PORT = availablePort;
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${availablePort} is already in use`);
        console.log('🔍 Trying to find another available port...');
        startServer(); // Try again with next available port
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
