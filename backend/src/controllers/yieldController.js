const { Market, Trade, YieldSnapshot } = require('../models');
const logger = require('../config/logger');
const YieldComparisonService = require('../services/yieldComparisonService');

class YieldController {
  static async getComparison(req, res) {
    try {
      const {
        category,
        sort = 'rank',
        direction,
        minApy,
        maxRisk,
        limit = 50,
      } = req.query;

      const marketFilter = { status: 'active' };
      if (category && category !== 'all') marketFilter.category = category;

      const markets = await Market.find(marketFilter).limit(Math.min(parseInt(limit, 10) || 50, 100)).lean();
      const marketIds = markets.map((market) => market.marketId);
      const since = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
      const trades = await Trade.find({
        marketId: { $in: marketIds },
        status: 'confirmed',
        timestamp: { $gte: since },
      }).lean();

      const tradesByMarket = trades.reduce((acc, trade) => {
        acc[trade.marketId] = acc[trade.marketId] || [];
        acc[trade.marketId].push(trade);
        return acc;
      }, {});

      let opportunities = YieldComparisonService.compare(markets, tradesByMarket);
      if (minApy !== undefined) opportunities = opportunities.filter((item) => item.apy >= Number(minApy));
      if (maxRisk !== undefined) opportunities = opportunities.filter((item) => item.riskScore <= Number(maxRisk));

      const sortKey = ['rank', 'apy', 'feeApy', 'tvl', 'volume24h', 'utilizationPct', 'riskScore'].includes(sort) ? sort : 'rank';
      const sortDirection = direction || (sortKey === 'rank' || sortKey === 'riskScore' ? 'asc' : 'desc');
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      opportunities.sort((a, b) => {
        if (sortKey === 'rank') return (a.rank - b.rank) * multiplier;
        return ((a[sortKey] || 0) - (b[sortKey] || 0)) * multiplier;
      });

      const summary = YieldController._summary(opportunities);
      await YieldController._persistSnapshots(opportunities);

      res.json({ success: true, data: { opportunities, summary, updatedAt: new Date() } });
    } catch (error) {
      logger.error('getComparison failed:', error);
      res.status(500).json({ success: false, message: 'Failed to compare yield opportunities' });
    }
  }

  static async getHistory(req, res) {
    try {
      const { marketId } = req.params;
      const days = Math.min(parseInt(req.query.days, 10) || 30, 365);
      const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      const records = await YieldSnapshot.find({ marketId, snapshotDate: { $gte: since } })
        .sort({ snapshotDate: 1 })
        .lean();

      res.json({ success: true, data: { marketId, records } });
    } catch (error) {
      logger.error('getHistory failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch yield history' });
    }
  }

  static _summary(opportunities) {
    const count = opportunities.length || 1;
    const avgApy = opportunities.reduce((sum, item) => sum + item.apy, 0) / count;
    const totalTvl = opportunities.reduce((sum, item) => sum + item.tvl, 0);
    const top = opportunities.slice().sort((a, b) => a.rank - b.rank)[0] || null;
    return { count: opportunities.length, avgApy: round(avgApy), totalTvl: round(totalTvl), top };
  }

  static async _persistSnapshots(opportunities) {
    if (!opportunities.length) return;
    const snapshotDate = new Date();
    snapshotDate.setUTCHours(0, 0, 0, 0);

    await Promise.all(opportunities.map((item) => YieldSnapshot.findOneAndUpdate(
      { marketId: item.marketId, snapshotDate },
      {
        ...item,
        snapshotDate,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )));
  }
}

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

module.exports = YieldController;
