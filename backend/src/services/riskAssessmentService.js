const logger = require('../config/logger');

/**
 * Risk Assessment Service for Yield Pools
 * 
 * Provides a deterministic, configurable scoring engine that assigns
 * risk levels to yield pool investment opportunities based on protocol metrics.
 */

// Default configuration for risk scoring weights and thresholds
const DEFAULT_CONFIG = {
  // Factor weights (must sum to 1.0)
  weights: {
    tvlStability: 0.20,
    poolAge: 0.15,
    apyStability: 0.20,
    auditStatus: 0.15,
    liquidityDepth: 0.15,
    protocolReputation: 0.15,
  },

  // Score thresholds for risk categories (0-100 scale)
  thresholds: {
    low: 33,
    medium: 66,
  },

  // TVL thresholds in USD
  tvl: {
    excellent: 10_000_000,   // $10M+
    good: 1_000_000,         // $1M+
    minimum: 100_000,        // $100K+
  },

  // Pool age thresholds in days
  age: {
    excellent: 365,   // 1 year+
    good: 180,        // 6 months+
    minimum: 30,      // 1 month+
  },

  // APY volatility thresholds (coefficient of variation)
  apy: {
    excellent: 0.05,  // <5% CV
    good: 0.15,       // <15% CV
    maximum: 0.50,    // <50% CV
  },

  // Liquidity depth thresholds (pool depth vs TVL ratio)
  liquidity: {
    excellent: 0.50,  // 50%+ immediately liquid
    good: 0.25,       // 25%+ immediately liquid
    minimum: 0.10,    // 10%+ immediately liquid
  },

  // Protocol reputation score thresholds (0-100)
  reputation: {
    excellent: 90,
    good: 70,
    minimum: 40,
  },
};

class RiskAssessmentService {
  constructor(config = {}) {
    this.config = this.mergeConfig(config);
    this.validateConfig();
  }

  /**
   * Merge user-provided config with defaults.
   * If weights are provided, they completely replace default weights.
   */
  mergeConfig(config) {
    const mergedWeights = config.weights
      ? config.weights
      : DEFAULT_CONFIG.weights;

    return {
      weights: mergedWeights,
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...config.thresholds },
      tvl: { ...DEFAULT_CONFIG.tvl, ...config.tvl },
      age: { ...DEFAULT_CONFIG.age, ...config.age },
      apy: { ...DEFAULT_CONFIG.apy, ...config.apy },
      liquidity: { ...DEFAULT_CONFIG.liquidity, ...config.liquidity },
      reputation: { ...DEFAULT_CONFIG.reputation, ...config.reputation },
    };
  }

  /**
   * Validate configuration (weights must sum to ~1.0)
   */
  validateConfig() {
    const weightSum = Object.values(this.config.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.001) {
      throw new Error(
        `Risk assessment weights must sum to 1.0, got ${weightSum.toFixed(3)}`
      );
    }
  }

  /**
   * Score a single yield pool deterministically.
   * Lower score = lower risk (0 is safest, 100 is riskiest).
   * 
   * @param {Object} pool - Yield pool metrics
   * @returns {Object} Risk score breakdown and category
   */
  assessPool(pool) {
    if (!pool || typeof pool !== 'object') {
      logger.warn('RiskAssessmentService received invalid pool data');
      return this.buildResult(null, null, 'Invalid pool data provided');
    }

    try {
      const scores = {
        tvlStability: this.scoreTvl(pool.tvlUsd),
        poolAge: this.scoreAge(pool.ageDays),
        apyStability: this.scoreApyStability(pool.apyCurrent, pool.apyHistory),
        auditStatus: this.scoreAudit(pool.audited, pool.auditCount, pool.lastAuditDate),
        liquidityDepth: this.scoreLiquidity(pool.liquidityUsd, pool.tvlUsd),
        protocolReputation: this.scoreReputation(pool.protocolReputationScore),
      };

      const weightedScore = this.calculateWeightedScore(scores);
      const category = this.categorizeRisk(weightedScore);

      return this.buildResult(weightedScore, scores, null, pool.poolId || pool.id);
    } catch (error) {
      logger.error('Risk assessment calculation error:', error);
      return this.buildResult(null, null, `Assessment failed: ${error.message}`);
    }
  }

  /**
   * Batch assess multiple pools
   */
  assessPools(pools) {
    if (!Array.isArray(pools)) {
      return {
        success: false,
        error: 'Expected an array of pools',
        results: [],
      };
    }

    const results = pools.map(pool => this.assessPool(pool));
    const validResults = results.filter(r => r.success);

    return {
      success: true,
      summary: {
        total: pools.length,
        assessed: validResults.length,
        failed: pools.length - validResults.length,
        lowRisk: validResults.filter(r => r.category === 'Low').length,
        mediumRisk: validResults.filter(r => r.category === 'Medium').length,
        highRisk: validResults.filter(r => r.category === 'High').length,
        averageScore: validResults.length
          ? Number((validResults.reduce((s, r) => s + r.score, 0) / validResults.length).toFixed(2))
          : null,
      },
      results,
    };
  }

  // ─── Individual Factor Scorers ───────────────────────────────

  /**
   * TVL Stability Score
   * Higher TVL = lower risk (lower score value)
   * Returns 0-100 where 0 = safest
   */
  scoreTvl(tvlUsd) {
    const value = this.parseNumber(tvlUsd);
    if (value === null) return 50; // neutral if unknown

    const { excellent, good, minimum } = this.config.tvl;

    if (value >= excellent) return 0;
    if (value >= good) return 25;
    if (value >= minimum) return 50;
    if (value > 0) return 75;
    return 100;
  }

  /**
   * Pool Age Score
   * Older pools = lower risk
   */
  scoreAge(ageDays) {
    const value = this.parseNumber(ageDays);
    if (value === null) return 50;

    const { excellent, good, minimum } = this.config.age;

    if (value >= excellent) return 0;
    if (value >= good) return 25;
    if (value >= minimum) return 50;
    if (value > 0) return 75;
    return 100;
  }

  /**
   * APY Stability Score
   * Lower volatility = lower risk
   * If history is provided, calculates coefficient of variation.
   * Otherwise uses current APY as a heuristic.
   */
  scoreApyStability(apyCurrent, apyHistory) {
    const current = this.parseNumber(apyCurrent);

    // If we have history, calculate volatility
    if (Array.isArray(apyHistory) && apyHistory.length >= 2) {
      const values = apyHistory.map(v => this.parseNumber(v)).filter(v => v !== null);
      if (values.length >= 2) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        if (mean === 0) return 50;
        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        const cv = Math.sqrt(variance) / Math.abs(mean);

        const { excellent, good, maximum } = this.config.apy;
        if (cv <= excellent) return 0;
        if (cv <= good) return 25;
        if (cv <= maximum) return 50;
        return 100;
      }
    }

    // Fallback: extremely high APY is inherently riskier
    if (current !== null) {
      if (current > 1_000_000) return 100; // >1,000,000% APY — likely unsustainable
      if (current > 100_000) return 90;
      if (current > 10_000) return 75;
      if (current > 1_000) return 60;
      if (current < 0) return 80; // Negative APY indicates problems
      return 30; // Moderate default for reasonable APY without history
    }

    return 50;
  }

  /**
   * Audit Status Score
   * Audited protocols = lower risk
   */
  scoreAudit(audited, auditCount, lastAuditDate) {
    const isAudited = Boolean(audited);
    const count = this.parseNumber(auditCount) || 0;

    if (!isAudited || count === 0) return 100;
    if (count >= 3) {
      // Check if audits are recent (< 1 year)
      if (lastAuditDate) {
        const auditDate = new Date(lastAuditDate);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (auditDate < oneYearAgo) return 35; // Stale audit
      }
      return 0;
    }
    if (count === 2) return 20;
    return 40;
  }

  /**
   * Liquidity Depth Score
   * Higher liquid proportion of TVL = lower risk
   */
  scoreLiquidity(liquidityUsd, tvlUsd) {
    const liquidity = this.parseNumber(liquidityUsd);
    const tvl = this.parseNumber(tvlUsd);

    if (liquidity === null || tvl === null || tvl <= 0) return 50;

    const ratio = liquidity / tvl;
    const { excellent, good, minimum } = this.config.liquidity;

    if (ratio >= excellent) return 0;
    if (ratio >= good) return 25;
    if (ratio >= minimum) return 50;
    return 75;
  }

  /**
   * Protocol Reputation Score
   * Higher reputation = lower risk
   */
  scoreReputation(protocolReputationScore) {
    const score = this.parseNumber(protocolReputationScore);
    if (score === null) return 50;

    const { excellent, good, minimum } = this.config.reputation;

    if (score >= excellent) return 0;
    if (score >= good) return 25;
    if (score >= minimum) return 50;
    if (score > 0) return 75;
    return 100;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  calculateWeightedScore(scores) {
    let total = 0;
    for (const [factor, score] of Object.entries(scores)) {
      const weight = this.config.weights[factor] || 0;
      total += score * weight;
    }
    return Math.round(Math.max(0, Math.min(100, total)));
  }

  categorizeRisk(score) {
    if (score <= this.config.thresholds.low) return 'Low';
    if (score <= this.config.thresholds.medium) return 'Medium';
    return 'High';
  }

  buildResult(score, factorScores, error, poolId = null) {
    if (error) {
      return {
        success: false,
        poolId,
        score: null,
        category: null,
        factorScores: null,
        error,
      };
    }

    return {
      success: true,
      poolId,
      score,
      category: this.categorizeRisk(score),
      factorScores,
      error: null,
    };
  }

  /**
   * Safely parse a number value, returning null for invalid data.
   */
  parseNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  }

  /**
   * Get current configuration (useful for debugging/documentation)
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(partialConfig) {
    this.config = this.mergeConfig(partialConfig);
    this.validateConfig();
    logger.info('RiskAssessmentService configuration updated');
    return this.getConfig();
  }
}

// Export singleton with default config for typical usage
module.exports = {
  RiskAssessmentService,
  defaultService: new RiskAssessmentService(),
};
