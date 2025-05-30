// Initialize cart from localStorage or create empty cart
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Function to add a product to the cart
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  
  if (!product) return;
  
  // Check if product is already in cart
  const existingItem = cart.find(item => item.id === productId);
  
  if (existingItem) {
    // Increase quantity if product already exists in cart
    existingItem.quantity += 1;
  } else {
    // Add new product to cart
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1
    });
  }
  
  // Save cart to localStorage
  saveCart();
  
  // Update cart count
  updateCartCount();
  
  // Show notification
  showNotification(`${product.name} added to cart!`);
}

// Function to remove a product from the cart
function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartCount();
  updateCartDisplay();
}

// Function to update product quantity in cart
function updateQuantity(productId, change) {
  const item = cart.find(item => item.id === productId);
  
  if (!item) return;
  
  item.quantity += change;
  
  // Remove item if quantity is 0 or less
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  
  saveCart();
  updateCartCount();
  updateCartDisplay();
}

// Function to save cart to localStorage
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

// Function to update cart count in the header
function updateCartCount() {
  const cartCount = document.getElementById('cart-count');
  
  if (!cartCount) return;
  
  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
  cartCount.textContent = totalItems;
}

// Function to calculate cart total
function calculateCartTotal() {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Function to update cart display in the modal
function updateCartDisplay() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  
  if (!cartItems || !cartTotal) return;
  
  // Clear current cart items
  cartItems.innerHTML = '';
  
  if (cart.length === 0) {
    cartItems.innerHTML = '<p>Your cart is empty</p>';
    cartTotal.textContent = '0';
    return;
  }
  
  // Add each cart item to the display
  cart.forEach(item => {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    
    cartItem.innerHTML = `
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <div class="cart-item-price">${formatPrice(item.price)}</div>
      </div>
      <div class="cart-item-quantity">
        <button class="quantity-btn decrease" data-id="${item.id}">-</button>
        <span>${item.quantity}</span>
        <button class="quantity-btn increase" data-id="${item.id}">+</button>
      </div>
      <button class="remove-btn" data-id="${item.id}">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    cartItems.appendChild(cartItem);
  });
  
  // Add event listeners to quantity buttons
  const decreaseButtons = document.querySelectorAll('.quantity-btn.decrease');
  const increaseButtons = document.querySelectorAll('.quantity-btn.increase');
  const removeButtons = document.querySelectorAll('.remove-btn');
  
  decreaseButtons.forEach(button => {
    button.addEventListener('click', function() {
      const productId = parseInt(this.getAttribute('data-id'));
      updateQuantity(productId, -1);
    });
  });
  
  increaseButtons.forEach(button => {
    button.addEventListener('click', function() {
      const productId = parseInt(this.getAttribute('data-id'));
      updateQuantity(productId, 1);
    });
  });
  
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const productId = parseInt(this.getAttribute('data-id'));
      removeFromCart(productId);
    });
  });
  
  // Update cart total
  cartTotal.textContent = formatPrice(calculateCartTotal()).replace('₹', '');
}

// Function to show notification
function showNotification(message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  
  // Add notification to the body
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Initialize cart when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  updateCartCount();
  
  // Set up cart modal
  const cartBtn = document.getElementById('cart-btn');
  const cartModal = document.getElementById('cart-modal');
  const closeBtn = document.querySelector('.close');
  const checkoutBtn = document.getElementById('checkout-btn');
  
  if (cartBtn && cartModal) {
    // Open cart modal when cart button is clicked
    cartBtn.addEventListener('click', function(e) {
      e.preventDefault();
      updateCartDisplay();
      cartModal.style.display = 'block';
    });
    
    // Close cart modal when close button is clicked
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        cartModal.style.display = 'none';
      });
    }
    
    // Close cart modal when clicking outside the modal
    window.addEventListener('click', function(e) {
      if (e.target === cartModal) {
        cartModal.style.display = 'none';
      }
    });
    
    // Go to checkout page when checkout button is clicked
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', function() {
        if (cart.length === 0) {
          showNotification('Your cart is empty!');
          return;
        }
        
        window.location.href = 'checkout.html';
      });
    }
  }
});
