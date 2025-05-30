/**
 * WebSocket utility functions for payment status broadcasting
 */

/**
 * Broadcast payment status update to all clients listening for a specific order
 * @param {Object} io - Socket.IO instance
 * @param {string} orderId - Order ID
 * @param {Object} paymentData - Payment data to broadcast
 */
function broadcastPaymentUpdate(io, orderId, paymentData) {
  if (!io || !orderId || !paymentData) {
    console.error('Invalid parameters for broadcastPaymentUpdate:', { io: !!io, orderId, paymentData: !!paymentData });
    return;
  }

  const roomName = `order-${orderId}`;
  console.log(`Broadcasting payment update to room: ${roomName}`, {
    orderId: paymentData.orderId,
    status: paymentData.paymentStatus,
    paymentId: paymentData.paymentId
  });

  // Broadcast to all clients in the order-specific room
  io.to(roomName).emit('payment-status-update', {
    orderId,
    status: paymentData.paymentStatus,
    paymentId: paymentData.paymentId,
    amount: paymentData.amount,
    timestamp: new Date().toISOString(),
    data: paymentData
  });

  // Also emit a general payment update event for debugging
  io.to(roomName).emit('order-update', {
    type: 'payment-status',
    orderId,
    data: paymentData,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast order status update to all clients listening for a specific order
 * @param {Object} io - Socket.IO instance
 * @param {string} orderId - Order ID
 * @param {Object} orderData - Order data to broadcast
 */
function broadcastOrderUpdate(io, orderId, orderData) {
  if (!io || !orderId || !orderData) {
    console.error('Invalid parameters for broadcastOrderUpdate:', { io: !!io, orderId, orderData: !!orderData });
    return;
  }

  const roomName = `order-${orderId}`;
  console.log(`Broadcasting order update to room: ${roomName}`, {
    orderId: orderData.orderId,
    status: orderData.paymentStatus
  });

  // Broadcast to all clients in the order-specific room
  io.to(roomName).emit('order-update', {
    type: 'order-status',
    orderId,
    data: orderData,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get the number of clients connected to a specific order room
 * @param {Object} io - Socket.IO instance
 * @param {string} orderId - Order ID
 * @returns {Promise<number>} Number of connected clients
 */
async function getOrderRoomSize(io, orderId) {
  try {
    const roomName = `order-${orderId}`;
    const room = io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  } catch (error) {
    console.error('Error getting room size:', error);
    return 0;
  }
}

/**
 * Emit a test event to verify WebSocket connectivity for an order
 * @param {Object} io - Socket.IO instance
 * @param {string} orderId - Order ID
 */
function testOrderConnection(io, orderId) {
  if (!io || !orderId) {
    console.error('Invalid parameters for testOrderConnection');
    return;
  }

  const roomName = `order-${orderId}`;
  console.log(`Testing connection for room: ${roomName}`);

  io.to(roomName).emit('connection-test', {
    orderId,
    message: 'WebSocket connection test',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  broadcastPaymentUpdate,
  broadcastOrderUpdate,
  getOrderRoomSize,
  testOrderConnection
};
