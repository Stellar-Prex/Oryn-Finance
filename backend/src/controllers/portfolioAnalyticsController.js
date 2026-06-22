const Trade = require('../models/Trade');
const logger = require('../config/logger');

const TIMEFRAME_OFFSETS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '1y':  365 * 24 * 60 * 60 * 1000,
};

function parseTimeframe(tf) {
  return new Date(Date.now() - (TIMEFRAME_OFFSETS[tf] || TIMEFRAME_OFFSETS['30d']));
}

function groupByDate(tf) {
  const fmt = tf === '24h' ? '%Y-%m-%dT%H:00' : '%Y-%m-%d';
  return { $dateToString: { format: fmt, date: '$timestamp' } };
}

async function fetchPerformanceSeries(walletAddress, tf) {
  const since = parseTimeframe(tf);
  const series = await Trade.aggregate([
    {
      $match: {
        userWalletAddress: walletAddress,
        status: { $in: ['confirmed', 'partially_filled'] },
        timestamp: { $gte: since },
      },
    },
    {
      $group: {
        _id: groupByDate(tf),
        totalCost: { $sum: '$totalCost' },
        tradeCount: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        totalFees: { $sum: { $add: ['$fees.platformFee', '$fees.stellarFee'] } },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        totalCost: { $round: ['$totalCost', 2] },
        tradeCount: 1,
        avgPrice: { $round: ['$avgPrice', 6] },
        totalFees: { $round: ['$totalFees', 2] },
        _id: 0,
      },
    },
  ]);
  return { series, timeframe: tf };
}

async function fetchAllocation(walletAddress, tf) {
  const since = parseTimeframe(tf);
  const allocation = await Trade.aggregate([
    {
      $match: {
        userWalletAddress: walletAddress,
        status: { $in: ['confirmed', 'partially_filled'] },
        timestamp: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$tokenType',
        totalCost: { $sum: '$totalCost' },
        tradeCount: { $sum: 1 },
      },
    },
    { $project: { tokenType: '$_id', totalCost: { $round: ['$totalCost', 2] }, tradeCount: 1, _id: 0 } },
  ]);
  const total = allocation.reduce((sum, item) => sum + item.totalCost, 0);
  return {
    allocation: allocation.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.totalCost / total) * 10000) / 100 : 0,
    })),
    total: Math.round(total * 100) / 100,
    timeframe: tf,
  };
}

async function fetchYieldBreakdown(walletAddress, tf) {
  const since = parseTimeframe(tf);
  const base = { userWalletAddress: walletAddress, status: { $in: ['confirmed', 'partially_filled'] }, timestamp: { $gte: since } };
  const [buyStats, sellStats] = await Promise.all([
    Trade.aggregate([
      { $match: { ...base, tradeType: 'buy' } },
      { $group: { _id: null, totalInvested: { $sum: '$totalCost' }, totalFees: { $sum: { $add: ['$fees.platformFee', '$fees.stellarFee'] } }, platformFees: { $sum: '$fees.platformFee' }, stellarFees: { $sum: '$fees.stellarFee' }, count: { $sum: 1 } } },
    ]),
    Trade.aggregate([
      { $match: { ...base, tradeType: 'sell' } },
      { $group: { _id: null, totalReturns: { $sum: '$totalCost' }, count: { $sum: 1 } } },
    ]),
  ]);
  const buy  = buyStats[0]  || { totalInvested: 0, totalFees: 0, platformFees: 0, stellarFees: 0, count: 0 };
  const sell = sellStats[0] || { totalReturns: 0, count: 0 };
  const realizedPnL = sell.totalReturns - buy.totalInvested;
  const roi = buy.totalInvested > 0 ? (realizedPnL / buy.totalInvested) * 100 : 0;
  return {
    totalInvested: Math.round(buy.totalInvested * 100) / 100,
    totalReturns:  Math.round(sell.totalReturns  * 100) / 100,
    realizedPnL:   Math.round(realizedPnL        * 100) / 100,
    roi:           Math.round(roi                * 100) / 100,
    fees: {
      total:    Math.round(buy.totalFees    * 100) / 100,
      platform: Math.round(buy.platformFees * 100) / 100,
      stellar:  Math.round(buy.stellarFees  * 100) / 100,
    },
    tradeCounts: { buys: buy.count, sells: sell.count },
    timeframe: tf,
  };
}
