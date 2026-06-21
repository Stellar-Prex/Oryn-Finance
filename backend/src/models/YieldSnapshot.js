const mongoose = require('mongoose');

const yieldSnapshotSchema = new mongoose.Schema({
  marketId: {
    type: String,
    required: true,
    index: true,
  },
  question: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    index: true,
  },
  snapshotDate: {
    type: Date,
    required: true,
    index: true,
  },
  apy: {
    type: Number,
    required: true,
    min: 0,
  },
  feeApy: {
    type: Number,
    required: true,
    min: 0,
  },
  incentiveApy: {
    type: Number,
    required: true,
    min: 0,
  },
  volume24h: {
    type: Number,
    default: 0,
    min: 0,
  },
  tvl: {
    type: Number,
    default: 0,
    min: 0,
  },
  utilizationPct: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  rankScore: {
    type: Number,
    default: 0,
    min: 0,
  },
  rank: {
    type: Number,
    min: 1,
  },
}, {
  timestamps: true,
  collection: 'yield_snapshots',
});

yieldSnapshotSchema.index({ marketId: 1, snapshotDate: 1 }, { unique: true });
yieldSnapshotSchema.index({ snapshotDate: -1, rankScore: -1 });

module.exports = mongoose.model('YieldSnapshot', yieldSnapshotSchema);
