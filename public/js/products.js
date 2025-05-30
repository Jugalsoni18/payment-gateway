// Sample product data
const products = [
  {
    id: 1,
    name: 'Smartphone',
    price: 15999,
    image: 'https://via.placeholder.com/300x200?text=Smartphone',
    description: 'Latest smartphone with advanced features'
  },
  {
    id: 2,
    name: 'Laptop',
    price: 49999,
    image: 'https://via.placeholder.com/300x200?text=Laptop',
    description: 'High-performance laptop for work and gaming'
  },
  {
    id: 3,
    name: 'Headphones',
    price: 2499,
    image: 'https://via.placeholder.com/300x200?text=Headphones',
    description: 'Wireless headphones with noise cancellation'
  },
  {
    id: 4,
    name: 'Smartwatch',
    price: 3999,
    image: 'https://via.placeholder.com/300x200?text=Smartwatch',
    description: 'Fitness tracker and smartwatch with heart rate monitor'
  },
  {
    id: 5,
    name: 'Camera',
    price: 29999,
    image: 'https://via.placeholder.com/300x200?text=Camera',
    description: 'Digital camera with 4K video recording'
  },
  {
    id: 6,
    name: 'Bluetooth Speaker',
    price: 1,
    image: 'https://via.placeholder.com/300x200?text=Speaker',
    description: 'Portable Bluetooth speaker with deep bass'
  }
];

// Function to format price in Indian Rupees
function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(price);
}

// Function to load products on the page
function loadProducts() {
  const productList = document.getElementById('product-list');

  if (!productList) return;

  productList.innerHTML = '';

  products.forEach(product => {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';

    productCard.innerHTML = `
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-price">${formatPrice(product.price)}</div>
        <button class="btn add-to-cart" data-id="${product.id}">Add to Cart</button>
      </div>
    `;

    productList.appendChild(productCard);
  });

  // Add event listeners to "Add to Cart" buttons
  const addToCartButtons = document.querySelectorAll('.add-to-cart');
  addToCartButtons.forEach(button => {
    button.addEventListener('click', function() {
      const productId = parseInt(this.getAttribute('data-id'));
      addToCart(productId);
    });
  });
}

// Load products when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', loadProducts);
