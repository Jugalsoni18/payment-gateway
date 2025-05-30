document.addEventListener('DOMContentLoaded', function() {
  // Get payment success details from sessionStorage
  const paymentSuccess = JSON.parse(sessionStorage.getItem('paymentSuccess'));
  
  // Redirect to home if no payment success details
  if (!paymentSuccess) {
    window.location.href = 'index.html';
    return;
  }
  
  // Display payment success details
  document.getElementById('success-order-id').textContent = paymentSuccess.orderId;
  document.getElementById('success-amount').textContent = paymentSuccess.amount;
  document.getElementById('success-payment-id').textContent = paymentSuccess.paymentId;
  
  // Clear sessionStorage
  sessionStorage.removeItem('orderDetails');
  sessionStorage.removeItem('paymentSuccess');
});
