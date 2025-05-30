require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const sequelize = require('./config/database');

// Import models to ensure they are loaded
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const PaymentLog = require('./models/PaymentLog');

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

// Import routes
const paymentRoutes = require('./routes/payment');
const orderRoutes = require('./routes/order');

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

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors());

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

// Routes
app.use('/api/payment', paymentRoutes);
app.use('/api/order', orderRoutes);

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

// Start the server using the HTTP server instance
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
