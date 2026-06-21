const YieldComparisonService = require('../../src/services/yieldComparisonService');

describe('YieldComparisonService', () => {
  const now = new Date('2026-06-19T12:00:00.000Z');

  it('calculates APY from recent trading fees and incentives', () => {
    const market = {
      marketId: 'btc-150k',
      question: 'Will BTC reach 150k?',
      category: 'crypto',
      status: 'active',
      initialLiquidity: 1000,
      totalVolume: 5000,
      platformFee: 0.005,
      volatility: { score: 20 },
    };
    const trades = [
      { totalCost: 1000, timestamp: '2026-06-19T10:00:00.000Z' },
      { totalCost: 500, timestamp: '2026-06-18T10:00:00.000Z' },
      { totalCost: 200, timestamp: '2026-06-01T10:00:00.000Z' },
    ];

    const result = YieldComparisonService.calculateOpportunity(market, trades, now);

    expect(result.volume24h).toBe(1000);
    expect(result.volume7d).toBe(1500);
    expect(result.feeApy).toBe(39.11);
    expect(result.incentiveApy).toBe(6);
    expect(result.apy).toBe(45.11);
    expect(result.utilizationPct).toBe(100);
  });

  it('ranks higher quality opportunities first', () => {
    const markets = [
      { marketId: 'low', question: 'Low', category: 'other', status: 'active', initialLiquidity: 1000, totalVolume: 100, volatility: { score: 10 } },
      { marketId: 'high', question: 'High', category: 'crypto', status: 'active', initialLiquidity: 2000, totalVolume: 3000, volatility: { score: 15 } },
    ];
    const tradesByMarket = {
      low: [{ totalCost: 25, timestamp: now }],
      high: [{ totalCost: 1500, timestamp: now }],
    };

    const ranked = YieldComparisonService.compare(markets, tradesByMarket, now);

    expect(ranked[0].marketId).toBe('high');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });
});
