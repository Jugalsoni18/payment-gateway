const Bull = require('bull');

// Create payment webhook queue with Redis configuration
const createPaymentQueue = () => {
  let redisConfig = { host: '127.0.0.1', port: 6379 };
  
  // Use environment variables if available
  if (process.env.REDIS_URL) {
    redisConfig = process.env.REDIS_URL;
  } else if (process.env.REDIS_HOST) {
    redisConfig = {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0
    };
  }

  const paymentQueue = new Bull('payment-webhook', {
    redis: redisConfig,
    defaultJobOptions: {
      removeOnComplete: 50, // Keep last 50 completed jobs
      removeOnFail: 100,    // Keep last 100 failed jobs
      attempts: 5,          // Retry up to 5 times
      backoff: {
        type: 'exponential',
        delay: 30000        // Start with 30 second delay
      }
    }
  });

  // Event listeners for monitoring
  paymentQueue.on('completed', (job, result) => {
    console.log(`Payment webhook job ${job.id} completed:`, result);
  });

  paymentQueue.on('failed', (job, err) => {
    console.error(`Payment webhook job ${job.id} failed:`, err.message);
  });

  paymentQueue.on('stalled', (job) => {
    console.warn(`Payment webhook job ${job.id} stalled`);
  });

  paymentQueue.on('progress', (job, progress) => {
    console.log(`Payment webhook job ${job.id} progress: ${progress}%`);
  });

  return paymentQueue;
};

const paymentQueue = createPaymentQueue();

module.exports = paymentQueue;
