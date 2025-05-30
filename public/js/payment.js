document.addEventListener('DOMContentLoaded', function() {
  console.log('Payment page loaded, initializing...');

  // Get order details from sessionStorage
  let orderDetails = JSON.parse(sessionStorage.getItem('orderDetails'));

  // If no order details in sessionStorage, try to get from URL parameters
  // This helps when returning from UPI apps
  if (!orderDetails) {
    console.log('No order details in sessionStorage, checking URL parameters');
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const status = urlParams.get('status');

    if (orderId) {
      // If we have an orderId in the URL, fetch the order details from the server
      console.log('Found orderId in URL:', orderId);

      // If status is provided in URL (from UPI callback), show appropriate message
      if (status) {
        console.log('Payment status from URL:', status);
        const statusMessage = document.getElementById('status-message');

        if (status === 'completed') {
          console.log('URL indicates payment completed, showing success message');
          statusMessage.className = 'success';
          statusMessage.innerHTML = '<i class="fas fa-check-circle"></i><p>Payment Successful!</p>';

          // Store payment success details and redirect after a delay
          setTimeout(() => {
            window.location.href = 'success.html';
          }, 2000);

          // Still fetch order details to update the UI
          fetchOrderDetails(orderId, true);
          return;
        } else if (status === 'failed') {
          console.log('URL indicates payment failed, showing failure message');
          statusMessage.className = 'failed';
          statusMessage.innerHTML = '<i class="fas fa-times-circle"></i><p>Payment Failed</p><p class="small">Please try again</p>';

          // Still fetch order details to update the UI
          fetchOrderDetails(orderId, true);
          return;
        }
      }

      // If no status or status is pending, just fetch order details
      fetchOrderDetails(orderId);
      return;
    } else {
      console.error('No order details found in sessionStorage or URL');
      window.location.href = 'index.html';
      return;
    }
  }

  console.log('Using order details from sessionStorage:', orderDetails);

  // Display order details
  document.getElementById('order-id').textContent = orderDetails.orderId;
  document.getElementById('order-amount').textContent = orderDetails.amount;

  // Display QR code
  const qrCodeImg = document.getElementById('qr-code-img');
  const qrLoading = document.getElementById('qr-loading');

  if (orderDetails.qrCode) {
    qrCodeImg.src = orderDetails.qrCode;
    qrCodeImg.onload = function() {
      qrLoading.style.display = 'none';
    };
    qrCodeImg.onerror = function() {
      console.error('Error loading QR code');
      qrLoading.innerHTML = '<p style="color: red;">Error loading QR code. Please try again.</p>';
    };
  } else {
    console.error('No QR code in order details');
    qrLoading.innerHTML = '<p style="color: red;">QR code not available. Please try again.</p>';
  }

  // Add direct payment buttons with dynamic merchant configuration if UPI link is available
  if (orderDetails.upiLink) {
    addPaymentButtons(orderDetails);
  }

  // Note: Auto-update functionality has been removed
  // Payment status will only be updated based on real payment confirmations

  // Start countdown timer (15 minutes)
  let timeLeft = 15 * 60; // 15 minutes in seconds
  const countdownElement = document.getElementById('countdown');

  const countdown = setInterval(function() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(countdown);
      countdownElement.textContent = 'Expired';
      countdownElement.style.color = 'red';
      // Disable QR code and payment button
      qrCodeImg.style.opacity = '0.5';
      const directPayBtn = document.getElementById('direct-pay-btn');
      if (directPayBtn) {
        directPayBtn.disabled = true;
        directPayBtn.style.opacity = '0.5';
      }
    }
    timeLeft--;
  }, 1000);

  // Initialize WebSocket connection for real-time updates
  console.log('Initializing WebSocket connection for order:', orderDetails.orderId);
  initializeWebSocketConnection(orderDetails.orderId);

  // Check payment status immediately when page loads
  console.log('Starting initial payment status check for order:', orderDetails.orderId);
  checkPaymentStatus(orderDetails.orderId).then(statusChecked => {
    console.log('Initial status check result:', statusChecked);
    if (!statusChecked) {
      // Only start periodic checking if payment is not already completed
      console.log('Payment not completed, starting periodic status checking');
      startPaymentStatusCheck(orderDetails.orderId);
    } else {
      console.log('Payment already completed, no need for periodic checking');
    }
  }).catch(error => {
    console.warn('Initial status check failed:', error);
    // Start periodic checking anyway
    console.log('Starting periodic checking despite initial failure');
    startPaymentStatusCheck(orderDetails.orderId);
  });
});

// Global WebSocket instance
let paymentWebSocket = null;

// Function to initialize WebSocket connection for real-time payment updates
function initializeWebSocketConnection(orderId) {
  console.log('Setting up WebSocket connection for order:', orderId);

  // Check if PaymentWebSocket class is available
  if (typeof PaymentWebSocket === 'undefined') {
    console.warn('PaymentWebSocket class not available, WebSocket functionality disabled');
    return;
  }

  try {
    // Create new WebSocket instance
    paymentWebSocket = new PaymentWebSocket();

    // Define callback functions
    const onPaymentUpdate = (updateData) => {
      console.log('Received WebSocket payment update:', updateData);

      // Update UI with the received data
      updatePaymentStatusUI(updateData);

      // If payment is completed or failed, stop polling
      if (updateData.paymentStatus === 'completed' || updateData.paymentStatus === 'failed') {
        console.log('Payment finished via WebSocket, stopping polling');
        stopPolling();
      }
    };

    const onConnectionChange = (isConnected) => {
      console.log('WebSocket connection status changed:', isConnected ? 'Connected' : 'Disconnected');

      // Update UI to show connection status
      const statusMessage = document.getElementById('status-message');
      if (statusMessage && !isConnected) {
        // Add a small indicator that we're using fallback polling
        const existingContent = statusMessage.innerHTML;
        if (!existingContent.includes('(polling)')) {
          statusMessage.innerHTML = existingContent.replace('<p>Waiting for payment...</p>', '<p>Waiting for payment... (polling)</p>');
        }
      }
    };

    const fallbackPolling = () => {
      console.log('Starting fallback polling due to WebSocket unavailability');
      startPaymentStatusCheck(orderId);
    };

    // Connect WebSocket
    paymentWebSocket.connect(orderId, onPaymentUpdate, onConnectionChange, fallbackPolling);

  } catch (error) {
    console.error('Error initializing WebSocket:', error);
    console.log('Falling back to polling mechanism');
  }
}

// Function to stop polling
function stopPolling() {
  if (window.paymentStatusInterval) {
    clearInterval(window.paymentStatusInterval);
    window.paymentStatusInterval = null;
    console.log('Polling stopped');
  }
}

// Function to cleanup WebSocket connection
function cleanupWebSocket() {
  if (paymentWebSocket) {
    paymentWebSocket.disconnect();
    paymentWebSocket = null;
    console.log('WebSocket connection cleaned up');
  }
}

// Cleanup when page is unloaded
window.addEventListener('beforeunload', () => {
  cleanupWebSocket();
  stopPolling();
});

// Function to check payment status for a specific order
window.checkPaymentStatus = async function checkPaymentStatus(orderId) {
  console.log('Checking payment status for order:', orderId);
  try {
    // Set timeout for fetch requests to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      // First try enhanced status endpoint that includes webhook data
      console.log('Trying enhanced status endpoint...');
      const enhancedResponse = await fetch(
        `/api/payment/enhanced-status/${orderId}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId); // Clear the timeout if fetch completes

      if (enhancedResponse.ok) {
        const enhancedData = await enhancedResponse.json();
        console.log('Enhanced payment status response:', enhancedData);

        // If we got a valid response, use the order data
        if (enhancedData.success && enhancedData.order) {
          console.log('Processing enhanced status data...');

          // Check if there are any payments recorded from webhooks
          if (enhancedData.paymentCount > 0 && enhancedData.latestPayment) {
            console.log('Found payment data from webhook:', enhancedData.latestPayment);

            // Use the latest payment status if it's more recent than order status
            const paymentStatus = enhancedData.latestPayment.status;
            if (paymentStatus === 'captured' || paymentStatus === 'completed') {
              // Update order data with payment info
              enhancedData.order.paymentStatus = 'completed';
              enhancedData.order.paymentId = enhancedData.latestPayment.razorpayPaymentId;
              enhancedData.order.paymentMethod = enhancedData.latestPayment.method;
              console.log('Updated order status to completed based on webhook data');
            } else if (paymentStatus === 'failed') {
              enhancedData.order.paymentStatus = 'failed';
              enhancedData.order.paymentId = enhancedData.latestPayment.razorpayPaymentId;
              console.log('Updated order status to failed based on webhook data');
            }
          }

          // Always update UI with current status
          console.log('Updating UI with order status:', enhancedData.order.paymentStatus);
          updatePaymentStatusUI(enhancedData.order);

          // Return true if payment is completed or failed (stop checking)
          const isFinished = enhancedData.order.paymentStatus === 'completed' ||
                           enhancedData.order.paymentStatus === 'failed';

          if (isFinished) {
            console.log(`Payment finished with status: ${enhancedData.order.paymentStatus}`);
          } else {
            console.log(`Payment still pending, will continue checking`);
          }

          return isFinished;
        }
      } else {
        console.warn('Enhanced status endpoint returned non-OK status:', enhancedResponse.status);
      }
    } catch (fetchError) {
      console.warn('Enhanced status check failed, trying basic status:', fetchError.message);
      // If enhanced check fails, we'll try the basic status below
    }

    // Set a new timeout for the basic status check
    const basicController = new AbortController();
    const basicTimeoutId = setTimeout(() => basicController.abort(), 5000);

    try {
      // Check basic payment status endpoint
      console.log('Trying basic status endpoint...');
      const response = await fetch(
        `/api/payment/check-status/${orderId}`,
        { signal: basicController.signal }
      );

      clearTimeout(basicTimeoutId); // Clear the timeout if fetch completes

      if (response.ok) {
        const data = await response.json();
        console.log('Basic payment status response:', data);

        // If we got a valid response, use it
        if (data.success) {
          console.log('Updating UI with basic status data');
          updatePaymentStatusUI(data);
          const isFinished = data.paymentStatus !== 'pending';
          console.log('Basic status check - is finished:', isFinished);
          return isFinished;
        }
      } else {
        console.warn('Basic status endpoint returned non-OK status:', response.status);
      }
    } catch (basicError) {
      console.warn('Basic status check failed, trying fallback:', basicError.message);
      // If basic check fails, we'll try the fallback below
    }

    // Set a new timeout for the fallback request
    const fallbackController = new AbortController();
    const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 5000);

    try {
      // Fallback to the regular order endpoint
      console.log('Trying fallback order endpoint...');
      const response = await fetch(
        `/api/order/${orderId}`,
        { signal: fallbackController.signal }
      );

      clearTimeout(fallbackTimeoutId); // Clear the timeout if fetch completes

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const order = await response.json();
      console.log('Fallback order status response:', order);

      // Update UI based on order status
      console.log('Updating UI with fallback order data');
      updatePaymentStatusUI(order);

      // Return true if status is not pending (completed or failed)
      const isFinished = order.paymentStatus !== 'pending';
      console.log('Fallback status check - is finished:', isFinished);
      return isFinished;
    } catch (fallbackError) {
      console.error('Fallback status check failed:', fallbackError.message);
      throw fallbackError; // Re-throw to be caught by the outer catch
    }
  } catch (error) {
    console.error('All payment status checks failed:', error.message);

    // Don't update UI on connection errors to avoid disrupting the user experience
    // Just return false to continue checking
    return false;
  }
}

// Function to update the UI based on payment status
window.updatePaymentStatusUI = function updatePaymentStatusUI(order) {
  console.log('Updating payment status UI with order:', order);
  const statusMessage = document.getElementById('status-message');

  if (!statusMessage) {
    console.error('Status message element not found!');
    return;
  }

  console.log('Current payment status:', order.paymentStatus);

  if (order.paymentStatus === 'completed') {
    console.log('Payment completed, showing success message and preparing redirect');
    statusMessage.className = 'success';
    statusMessage.innerHTML = '<i class="fas fa-check-circle"></i><p>Payment Successful!</p>';

    // Store payment success details
    const successData = {
      orderId: order.orderId,
      amount: order.amount,
      paymentId: order.paymentId || order.paymentId
    };
    sessionStorage.setItem('paymentSuccess', JSON.stringify(successData));
    console.log('Stored payment success data:', successData);

    // Redirect to success page after 2 seconds
    console.log('Redirecting to success page in 2 seconds...');
    setTimeout(() => {
      console.log('Redirecting now...');
      window.location.href = 'success.html';
    }, 2000);
  } else if (order.paymentStatus === 'failed') {
    console.log('Payment failed, showing failure message');
    statusMessage.className = 'failed';
    statusMessage.innerHTML = '<i class="fas fa-times-circle"></i><p>Payment Failed</p><p class="small">Please try again</p>';
  } else if (order.paymentStatus === 'authorized') {
    console.log('Payment authorized, showing processing message');
    statusMessage.className = 'processing';
    statusMessage.innerHTML = '<i class="fas fa-clock"></i><p>Payment Authorized</p><p class="small">Processing...</p>';
  } else {
    // For pending status, show a processing message
    console.log('Payment pending, showing waiting message');
    statusMessage.className = 'pending';
    statusMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Waiting for payment...</p>';
  }
}

// Function to fetch order details from the server
async function fetchOrderDetails(orderId, skipStatusCheck = false) {
  try {
    // Show loading state
    document.getElementById('qr-loading').innerHTML = '<p>Loading payment details...</p>';

    // Fetch order details from the server
    const response = await fetch(`/api/order/${orderId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch order details: ${response.status}`);
    }

    const order = await response.json();
    console.log('Fetched order details:', order);

    // If order exists, fetch the payment details
    if (order) {
      // Check if payment is already completed
      if (order.paymentStatus === 'completed' && !skipStatusCheck) {
        // Update UI to show payment completed
        const statusMessage = document.getElementById('status-message');
        statusMessage.className = 'success';
        statusMessage.innerHTML = '<i class="fas fa-check-circle"></i><p>Payment Successful!</p>';

        // Store payment success details
        sessionStorage.setItem('paymentSuccess', JSON.stringify({
          orderId: order.orderId,
          amount: order.amount,
          paymentId: order.paymentId
        }));

        // Redirect to success page after 2 seconds
        setTimeout(() => {
          window.location.href = 'success.html';
        }, 2000);

        return;
      }

      // Create a simplified orderDetails object
      const orderDetails = {
        orderId: order.orderId,
        amount: order.amount,
        paymentStatus: order.paymentStatus
      };

      // Fetch payment details to regenerate QR code
      const paymentResponse = await fetch('/api/payment/regenerate-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId: order.orderId, amount: order.amount })
      });

      if (!paymentResponse.ok) {
        throw new Error(`Failed to regenerate payment details: ${paymentResponse.status}`);
      }

      const paymentData = await paymentResponse.json();
      console.log('Regenerated payment details:', paymentData);

      // Update the orderDetails with payment info
      orderDetails.qrCode = paymentData.qrCode;
      orderDetails.upiLink = paymentData.upiLink;

      // Store in sessionStorage
      sessionStorage.setItem('orderDetails', JSON.stringify(orderDetails));

      // Update the UI with order details
      document.getElementById('order-id').textContent = orderDetails.orderId;
      document.getElementById('order-amount').textContent = orderDetails.amount;

      // Display QR code
      const qrCodeImg = document.getElementById('qr-code-img');
      const qrLoading = document.getElementById('qr-loading');

      if (orderDetails.qrCode) {
        qrCodeImg.src = orderDetails.qrCode;
        qrCodeImg.onload = function() {
          qrLoading.style.display = 'none';
        };
      }

      // Add direct payment buttons with dynamic merchant configuration
      if (orderDetails.upiLink) {
        addPaymentButtons(orderDetails);
      }

      // Start checking payment status
      if (!skipStatusCheck) {
        startPaymentStatusCheck(orderId);
      }
    } else {
      throw new Error('Order not found');
    }
  } catch (error) {
    console.error('Error fetching order details:', error);
    document.getElementById('qr-loading').innerHTML =
      `<p style="color: red;">Error: ${error.message}</p>
       <p><a href="index.html" class="btn">Return to Home</a></p>`;
  }
}

// Function to add payment buttons with dynamic merchant configuration
async function addPaymentButtons(orderDetails) {
  try {
    console.log('Fetching merchant configuration for payment buttons...');

    // Fetch merchant configuration from the server
    const configResponse = await fetch('/api/payment/merchant-config');
    if (!configResponse.ok) {
      throw new Error('Failed to fetch merchant configuration');
    }

    const configData = await configResponse.json();
    if (!configData.success) {
      throw new Error('Invalid merchant configuration response');
    }

    const merchantConfig = configData.config;
    console.log('Merchant configuration loaded:', merchantConfig);

    const paymentInstructions = document.querySelector('.payment-instructions');

    // Remove existing buttons if any
    const existingButtons = paymentInstructions.querySelectorAll('button');
    existingButtons.forEach(btn => btn.remove());

    // Add UPI payment button (uses the backend-generated UPI link)
    const directPayBtn = document.createElement('button');
    directPayBtn.id = 'direct-pay-btn';
    directPayBtn.className = 'btn';
    directPayBtn.style.marginRight = '10px';
    directPayBtn.innerHTML = '<i class="fas fa-mobile-alt"></i> Pay Directly with UPI';
    directPayBtn.onclick = function() {
      console.log('Opening UPI link:', orderDetails.upiLink);
      window.location.href = orderDetails.upiLink;
    };
    paymentInstructions.appendChild(directPayBtn);

    // Add Google Pay button with dynamic UPI VPA
    const gpayBtn = document.createElement('button');
    gpayBtn.id = 'gpay-btn';
    gpayBtn.className = 'btn';
    gpayBtn.style.marginRight = '10px';
    gpayBtn.style.backgroundColor = '#4285F4';
    gpayBtn.innerHTML = '<i class="fas fa-wallet"></i> Google Pay';
    gpayBtn.onclick = function() {
      // Create a direct intent URL for Google Pay using dynamic merchant config
      const upiId = merchantConfig.upiVpa;
      const amount = orderDetails.amount;
      const note = `Order ${orderDetails.orderId.substring(0, 8)}`;
      const name = merchantConfig.merchantName;
      const gpayUrl = `tez://upi/pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
      console.log('Opening Google Pay with UPI VPA:', upiId);
      window.location.href = gpayUrl;
    };
    paymentInstructions.appendChild(gpayBtn);

    // Add PhonePe button with dynamic UPI VPA
    const phonepeBtn = document.createElement('button');
    phonepeBtn.id = 'phonepe-btn';
    phonepeBtn.className = 'btn';
    phonepeBtn.style.marginRight = '10px';
    phonepeBtn.style.backgroundColor = '#5f259f';
    phonepeBtn.innerHTML = '<i class="fas fa-mobile"></i> PhonePe';
    phonepeBtn.onclick = function() {
      // Create a direct intent URL for PhonePe using dynamic merchant config
      const upiId = merchantConfig.upiVpa;
      const amount = orderDetails.amount;
      const note = `Order ${orderDetails.orderId.substring(0, 8)}`;
      const name = merchantConfig.merchantName;
      const phonepeUrl = `phonepe://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
      console.log('Opening PhonePe with UPI VPA:', upiId);
      window.location.href = phonepeUrl;
    };
    paymentInstructions.appendChild(phonepeBtn);

    // Add Paytm button with dynamic UPI VPA
    const paytmBtn = document.createElement('button');
    paytmBtn.id = 'paytm-btn';
    paytmBtn.className = 'btn';
    paytmBtn.style.marginRight = '10px';
    paytmBtn.style.backgroundColor = '#00BAF2';
    paytmBtn.innerHTML = '<i class="fas fa-wallet"></i> Paytm';
    paytmBtn.onclick = function() {
      // Create a direct intent URL for Paytm using dynamic merchant config
      const upiId = merchantConfig.upiVpa;
      const amount = orderDetails.amount;
      const note = `Order ${orderDetails.orderId.substring(0, 8)}`;
      const name = merchantConfig.merchantName;
      // Paytm uses a different URL format
      const paytmUrl = `paytmmp://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
      console.log('Opening Paytm with UPI VPA:', upiId);
      window.location.href = paytmUrl;
    };
    paymentInstructions.appendChild(paytmBtn);

    console.log('Payment buttons added successfully with UPI VPA:', merchantConfig.upiVpa);

  } catch (error) {
    console.error('Error adding payment buttons:', error);

    // Fallback: Add basic UPI button only
    const paymentInstructions = document.querySelector('.payment-instructions');
    const fallbackBtn = document.createElement('button');
    fallbackBtn.id = 'direct-pay-btn';
    fallbackBtn.className = 'btn';
    fallbackBtn.innerHTML = '<i class="fas fa-mobile-alt"></i> Pay with UPI';
    fallbackBtn.onclick = function() {
      window.location.href = orderDetails.upiLink;
    };
    paymentInstructions.appendChild(fallbackBtn);

    console.log('Added fallback UPI button due to configuration error');
  }
}

// Function to start checking payment status
function startPaymentStatusCheck(orderId) {
  console.log('Starting payment status checking for order:', orderId);

  // Track consecutive failures to implement exponential backoff
  let consecutiveFailures = 0;
  let checkInterval = 2000; // Start with 2 seconds for better reliability

  // Check immediately first
  console.log('Performing immediate status check...');
  checkPaymentStatus(orderId).catch(error => {
    console.warn('Initial status check failed:', error);
    consecutiveFailures++;
  });

  // Then check with adaptive frequency
  window.paymentStatusInterval = setInterval(async function() {
    console.log(`Performing periodic status check (interval: ${checkInterval}ms)...`);
    try {
      const statusChecked = await checkPaymentStatus(orderId);

      if (statusChecked) {
        // If status is completed or failed, stop checking
        console.log('Payment status is final, stopping periodic checks');
        clearInterval(window.paymentStatusInterval);
        window.removeEventListener('focus', focusHandler);
        return;
      }

      // Reset consecutive failures on success
      if (consecutiveFailures > 0) {
        console.log('Status check succeeded, resetting failure count');
        consecutiveFailures = 0;
        // If we had backed off, gradually return to normal frequency
        if (checkInterval > 2000) {
          checkInterval = Math.max(2000, checkInterval / 1.5);
          console.log(`Reducing check interval to ${checkInterval}ms`);
          clearInterval(window.paymentStatusInterval);
          startAdaptiveChecking();
        }
      }
    } catch (error) {
      console.error('Status check failed in interval:', error);
      consecutiveFailures++;

      // Implement exponential backoff for consecutive failures
      if (consecutiveFailures > 2) {
        const newInterval = Math.min(15000, checkInterval * 1.5); // Max 15 seconds
        if (newInterval !== checkInterval) {
          checkInterval = newInterval;
          console.log(`Backing off to ${checkInterval}ms interval after ${consecutiveFailures} failures`);
          clearInterval(window.paymentStatusInterval);
          startAdaptiveChecking();
        }
      }
    }
  }, checkInterval);

  // Function to start checking with the current adaptive interval
  function startAdaptiveChecking() {
    console.log(`Starting adaptive checking with ${checkInterval}ms interval`);
    window.paymentStatusInterval = setInterval(async function() {
      console.log(`Performing adaptive status check (interval: ${checkInterval}ms)...`);
      try {
        const statusChecked = await checkPaymentStatus(orderId);
        if (statusChecked) {
          console.log('Payment status is final in adaptive check, stopping');
          clearInterval(window.paymentStatusInterval);
          window.removeEventListener('focus', focusHandler);
        }
      } catch (error) {
        console.error('Status check failed in adaptive interval:', error);
        consecutiveFailures++;
      }
    }, checkInterval);
  }

  // Define focus handler as a named function so we can remove it later
  const focusHandler = function() {
    console.log('Window regained focus, performing immediate payment status check');
    checkPaymentStatus(orderId).catch(error => {
      console.warn('Focus status check failed:', error);
    });
  };

  // Add focus event listener
  console.log('Adding window focus event listener for payment status checks');
  window.addEventListener('focus', focusHandler);
}