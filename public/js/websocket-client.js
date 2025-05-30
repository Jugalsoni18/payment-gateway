/**
 * WebSocket client for real-time payment status updates
 */

class PaymentWebSocket {
  constructor() {
    this.socket = null;
    this.orderId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.onPaymentUpdate = null;
    this.onConnectionChange = null;
    this.fallbackPolling = null;
  }

  /**
   * Initialize WebSocket connection for a specific order
   * @param {string} orderId - Order ID to listen for updates
   * @param {Function} onPaymentUpdate - Callback for payment updates
   * @param {Function} onConnectionChange - Callback for connection status changes
   * @param {Function} fallbackPolling - Fallback polling function
   */
  connect(orderId, onPaymentUpdate, onConnectionChange, fallbackPolling) {
    this.orderId = orderId;
    this.onPaymentUpdate = onPaymentUpdate;
    this.onConnectionChange = onConnectionChange;
    this.fallbackPolling = fallbackPolling;

    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
      console.warn('Socket.IO not available, falling back to polling');
      this.startFallbackPolling();
      return;
    }

    try {
      console.log('Connecting to WebSocket server...');
      
      // Initialize Socket.IO connection
      this.socket = io({
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay
      });

      this.setupEventListeners();
      
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      this.startFallbackPolling();
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join the order-specific room
      this.socket.emit('join-order', this.orderId);
      
      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }
    });

    // Successfully joined order room
    this.socket.on('joined-order', (data) => {
      if (data.success) {
        console.log(`Successfully joined room for order: ${data.orderId}`);
      } else {
        console.error('Failed to join order room:', data.error);
      }
    });

    // Payment status update received
    this.socket.on('payment-status-update', (data) => {
      console.log('Received payment status update:', data);
      
      if (data.orderId === this.orderId && this.onPaymentUpdate) {
        this.onPaymentUpdate({
          orderId: data.orderId,
          paymentStatus: data.status,
          paymentId: data.paymentId,
          amount: data.amount,
          timestamp: data.timestamp,
          data: data.data
        });
      }
    });

    // General order update
    this.socket.on('order-update', (data) => {
      console.log('Received order update:', data);
      
      if (data.orderId === this.orderId && this.onPaymentUpdate) {
        this.onPaymentUpdate(data.data);
      }
    });

    // Connection test response
    this.socket.on('connection-test', (data) => {
      console.log('Connection test received:', data);
    });

    // Ping-pong for connection testing
    this.socket.on('pong', () => {
      console.log('Pong received - connection is alive');
    });

    // Connection lost
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      
      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }

      // Start fallback polling if disconnected
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.startFallbackPolling();
      }
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      // If we've exceeded max attempts, fall back to polling
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('Max reconnection attempts reached, falling back to polling');
        this.startFallbackPolling();
      }
    });

    // Reconnection attempt
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`WebSocket reconnection attempt ${attemptNumber}`);
    });

    // Reconnection successful
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Rejoin the order room
      this.socket.emit('join-order', this.orderId);
      
      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }
    });
  }

  /**
   * Start fallback polling mechanism
   */
  startFallbackPolling() {
    if (this.fallbackPolling && typeof this.fallbackPolling === 'function') {
      console.log('Starting fallback polling mechanism');
      this.fallbackPolling();
    }
  }

  /**
   * Send a ping to test connection
   */
  ping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('ping');
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting WebSocket...');
      
      // Leave the order room
      if (this.orderId) {
        this.socket.emit('leave-order', this.orderId);
      }
      
      // Disconnect
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.orderId = null;
    this.onPaymentUpdate = null;
    this.onConnectionChange = null;
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }
}

// Export for use in other scripts
window.PaymentWebSocket = PaymentWebSocket;
