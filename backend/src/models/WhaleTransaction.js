const mongoose = require('mongoose');

const whaleTransactionSchema = new mongoose.Schema({
  tradeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  marketId: {
    type: String,
    required: true,
    index: true
  },
  walletAddress: {
    type: String,
    required: true,
    index: true
  },
  walletLabel: {
    type: String,
    default: null
  },
  tradeType: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  tokenType: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  volumePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    description: 'Percentage of total market volume this trade represents'
  },
  impactOnPrice: {
    type: Number,
    default: 0,
    description: 'Price impact percentage caused by this whale trade'
  },
  marketQuestion: {
    type: String,
    required: true
  },
  alertGenerated: {
    type: Boolean,
    default: false
  },
  alertSeverity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: null
  },
  historicalContext: {
    walletTotalVolume: {
      type: Number,
      default: 0
    },
    marketTotalVolume: {
      type: Number,
      default: 0
    },
    isNewToMarket: {
      type: Boolean,
      default: false
    },
    walletAge: {
      type: Number,
      default: 0,
      description: 'Days since wallet first appeared'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

whaleTransactionSchema.index({ createdAt: -1 });
whaleTransactionSchema.index({ marketId: 1, createdAt: -1 });
whaleTransactionSchema.index({ walletAddress: 1, createdAt: -1 });

module.exports = mongoose.model('WhaleTransaction', whaleTransactionSchema);
