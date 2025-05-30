document.addEventListener('DOMContentLoaded', function() {
  // Get cart from localStorage
  const cart = JSON.parse(localStorage.getItem('cart')) || [];

  // Redirect to home if cart is empty
  if (cart.length === 0) {
    window.location.href = 'index.html';
    return;
  }

  // Display order summary
  displayOrderSummary();

  // Set up form submission
  const shippingForm = document.getElementById('shipping-form');
  if (shippingForm) {
    shippingForm.addEventListener('submit', handleFormSubmit);
  }
});

// Function to display order summary
function displayOrderSummary() {
  const checkoutItems = document.getElementById('checkout-items');
  const orderTotal = document.getElementById('order-total');

  if (!checkoutItems || !orderTotal) return;

  // Get cart from localStorage
  const cart = JSON.parse(localStorage.getItem('cart')) || [];

  // Clear current items
  checkoutItems.innerHTML = '';

  // Add each cart item to the display
  cart.forEach(item => {
    const checkoutItem = document.createElement('div');
    checkoutItem.className = 'checkout-item';

    checkoutItem.innerHTML = `
      <div>
        <h4>${item.name}</h4>
        <p>Quantity: ${item.quantity}</p>
      </div>
      <div>${formatPrice(item.price * item.quantity)}</div>
    `;

    checkoutItems.appendChild(checkoutItem);
  });

  // Calculate and display total
  const total = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  orderTotal.textContent = formatPrice(total).replace('₹', '');
}

// Function to handle form submission
function handleFormSubmit(e) {
  e.preventDefault();
  console.log('Form submitted');

  try {
    // Disable the submit button to prevent multiple submissions
    const submitButton = document.getElementById('place-order-btn');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Processing...';
    }

    // Get form data
    const formData = new FormData(e.target);

    // Log form data for debugging
    console.log('Form data:');
    for (let pair of formData.entries()) {
      console.log(pair[0] + ': ' + pair[1]);
    }

    const customerData = {
      customerName: formData.get('name'),
      customerEmail: formData.get('email'),
      customerPhone: formData.get('phone'),
      shippingAddress: {
        street: formData.get('street'),
        city: formData.get('city'),
        state: formData.get('state'),
        pincode: formData.get('pincode'),
        country: 'India'
      }
    };

    console.log('Customer data:', customerData);

    // Get cart data
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    console.log('Cart data:', cart);

    if (cart.length === 0) {
      alert('Your cart is empty. Please add items to your cart before checkout.');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Place Order';
      }
      return;
    }

    const items = cart.map(item => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }));

    // Calculate total amount
    const amount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    console.log('Total amount:', amount);

    // Create order data
    const orderData = {
      ...customerData,
      amount,
      items
    };

    console.log('Order data:', orderData);

    // Store order data in sessionStorage as a backup
    sessionStorage.setItem('lastOrderData', JSON.stringify(orderData));

    // Create order and proceed to payment
    createOrder(orderData);
  } catch (error) {
    console.error('Error in form submission:', error);
    alert('Error processing your order: ' + error.message);

    // Re-enable the submit button
    const submitButton = document.getElementById('place-order-btn');
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Place Order';
    }
  }
}

// Function to create order and generate QR code
async function createOrder(orderData) {
  try {
    console.log('Creating order with data:', orderData);

    // Show loading state
    document.getElementById('place-order-btn').disabled = true;
    document.getElementById('place-order-btn').textContent = 'Processing...';

    // Send order data to server
    const response = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Server response:', data);

    if (data.success) {
      console.log('Order created successfully:', data);

      // Check if QR code is present
      if (!data.qrCode) {
        console.error('No QR code received from server');
        throw new Error('No QR code received from server');
      }

      // Store order details in sessionStorage for payment page
      const orderDetailsObj = {
        orderId: data.orderId,
        amount: data.amount,
        qrCode: data.qrCode,
        upiLink: data.upiLink
      };

      // Clear any existing order details first
      sessionStorage.removeItem('orderDetails');

      // Store the new order details
      const orderDetailsStr = JSON.stringify(orderDetailsObj);
      sessionStorage.setItem('orderDetails', orderDetailsStr);

      // Verify the data was stored correctly
      console.log('Stored order details in sessionStorage:', orderDetailsStr);
      console.log('Verification - Reading back from sessionStorage:', sessionStorage.getItem('orderDetails'));

      // Redirect to payment page with orderId in URL
      window.location.href = `payment.html?orderId=${data.orderId}`;
    } else {
      throw new Error(data.message || 'Failed to create order');
    }
  } catch (error) {
    console.error('Error creating order:', error);
    alert('Error creating order: ' + error.message);

    // Re-enable the submit button
    const submitButton = document.getElementById('place-order-btn');
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Place Order';
    }
  }
}
