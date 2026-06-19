const DAY_MS = 24 * 60 * 60 * 1000;

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
};

class YieldComparisonService {
  static compare(markets, tradesByMarket = {}, now = new Date()) {
    const opportunities = markets.map((market) => {
      const trades = tradesByMarket[market.marketId] || [];
      return YieldComparisonService.calculateOpportunity(market, trades, now);
    });

    return opportunities
      .sort((a, b) => b.rankScore - a.rankScore)
      .map((opportunity, index) => ({ ...opportunity, rank: index + 1 }));
  }

  static calculateOpportunity(market, trades = [], now = new Date()) {
    const liquidity = Math.max(Number(market.initialLiquidity) || 0, 1);
    const totalVolume = Number(market.totalVolume) || 0;
    const platformFee = Number(market.platformFee) || 0.005;
    const volume24h = YieldComparisonService.sumRecentVolume(trades, now, 1);
    const volume7d = YieldComparisonService.sumRecentVolume(trades, now, 7);
    const dailyVolume = volume7d > 0 ? volume7d / 7 : volume24h;
    const feeApy = (dailyVolume * platformFee / liquidity) * 365 * 100;
    const utilizationPct = Math.min((totalVolume / liquidity) * 100, 100);
    const tvl = liquidity * (1 + (totalVolume / liquidity) * 0.1);
    const volatilityScore = Number(market.volatility?.score) || 0;
    const riskScore = Math.min(100, (volatilityScore * 0.55) + (utilizationPct > 85 ? 25 : 0) + (liquidity < 250 ? 20 : 0));
    const incentiveApy = YieldComparisonService.incentiveApyFor(market.category, utilizationPct);
    const apy = feeApy + incentiveApy;
    const liquidityScore = Math.min(100, Math.log10(liquidity + 1) * 25);
    const activityScore = Math.min(100, Math.log10(volume24h + 1) * 35);
    const rankScore = (apy * 2.2) + (liquidityScore * 0.25) + (activityScore * 0.2) - (riskScore * 0.35);

    return {
      marketId: market.marketId,
      question: market.question,
      category: market.category,
      status: market.status,
      apy: round(apy),
      feeApy: round(feeApy),
      incentiveApy: round(incentiveApy),
      volume24h: round(volume24h),
      volume7d: round(volume7d),
      tvl: round(tvl),
      liquidity: round(liquidity),
      utilizationPct: round(utilizationPct),
      riskScore: round(riskScore),
      rankScore: round(Math.max(rankScore, 0)),
      expiresAt: market.expiresAt,
      updatedAt: now,
    };
  }

  static sumRecentVolume(trades, now, days) {
    const cutoff = now.getTime() - (days * DAY_MS);
    return trades
      .filter((trade) => new Date(trade.timestamp).getTime() >= cutoff)
      .reduce((sum, trade) => sum + (Number(trade.totalCost) || 0), 0);
  }

  static incentiveApyFor(category, utilizationPct) {
    const baseByCategory = {
      crypto: 6,
      economics: 5,
      technology: 4.5,
      politics: 4,
      sports: 3.5,
      entertainment: 3,
      other: 3,
    };
    const utilizationBoost = utilizationPct < 35 ? 2 : utilizationPct < 65 ? 1 : 0;
    return (baseByCategory[category] || baseByCategory.other) + utilizationBoost;
  }
}

module.exports = YieldComparisonService;
