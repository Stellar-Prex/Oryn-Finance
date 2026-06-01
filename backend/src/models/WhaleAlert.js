const mongoose = require('mongoose');

const whaleAlertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  whaleTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'WhaleTransaction'
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
  alertType: {
    type: String,
    enum: ['large-trade', 'accumulation', 'distribution', 'manipulation-risk', 'unusual-pattern'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  tradeDetails: {
    amount: Number,
    price: Number,
    totalCost: Number,
    tokenType: String,
    tradeType: String
  },
  metrics: {
    volumePercentage: Number,
    priceImpact: Number,
    marketVolumeChange: Number,
    avgTradeSize: Number
  },
  dismissed: {
    type: Boolean,
    default: false
  },
  dismissedAt: Date,
  dismissedBy: String,
  dismissReason: String,
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: Date,
  viewers: [{
    userAddress: String,
    viewedAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

whaleAlertSchema.index({ createdAt: -1 });
whaleAlertSchema.index({ marketId: 1, createdAt: -1 });
whaleAlertSchema.index({ severity: 1, createdAt: -1 });

module.exports = mongoose.model('WhaleAlert', whaleAlertSchema);
