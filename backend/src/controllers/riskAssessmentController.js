const { RiskAssessmentService, defaultService } = require('../services/riskAssessmentService');
const logger = require('../config/logger');
const { ValidationError } = require('../middleware/errorHandler');

class RiskAssessmentController {
  /**
   * POST /api/risk-assessment/pools
   * Assess a single yield pool or batch of pools
   */
  static async assessPools(req, res) {
    const { pools, config } = req.body;

    if (!pools) {
      throw new ValidationError('Missing required field: pools');
    }

    const poolsArray = Array.isArray(pools) ? pools : [pools];

    if (poolsArray.length === 0) {
      throw new ValidationError('At least one pool must be provided');
    }

    if (poolsArray.length > 100) {
      throw new ValidationError('Maximum 100 pools allowed per request');
    }

    // Use custom config if provided, otherwise default
    const service = config
      ? new RiskAssessmentService(config)
      : defaultService;

    const result = service.assessPools(poolsArray);

    logger.info(`Risk assessment completed: ${result.summary.assessed}/${result.summary.total} pools assessed`);

    return res.json({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/risk-assessment/pool/:poolId
   * Assess a specific pool by ID (body contains metrics)
   */
  static async assessPoolById(req, res) {
    const { poolId } = req.params;
    const metrics = req.body;

    if (!poolId) {
      throw new ValidationError('Pool ID is required');
    }

    const pool = {
      poolId,
      ...metrics,
    };

    const result = defaultService.assessPool(pool);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/risk-assessment/config
   * Retrieve current default configuration
   */
  static async getConfig(req, res) {
    return res.json({
      success: true,
      data: defaultService.getConfig(),
    });
  }

  /**
   * PUT /api/risk-assessment/config
   * Update default scoring configuration (admin only)
   */
  static async updateConfig(req, res) {
    const config = req.body;

    if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
      throw new ValidationError('Configuration object is required');
    }

    try {
      const updatedConfig = defaultService.updateConfig(config);
      logger.info('Risk assessment configuration updated via API');

      return res.json({
        success: true,
        message: 'Configuration updated successfully',
        data: updatedConfig,
      });
    } catch (error) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * GET /api/risk-assessment/categories
   * Get risk category definitions and thresholds
   */
  static async getCategories(req, res) {
    const config = defaultService.getConfig();

    return res.json({
      success: true,
      data: {
        low: {
          maxScore: config.thresholds.low,
          description: 'Low risk pools with strong fundamentals and proven track records',
          color: '#22c55e',
        },
        medium: {
          minScore: config.thresholds.low + 1,
          maxScore: config.thresholds.medium,
          description: 'Medium risk pools with acceptable metrics but some uncertainty',
          color: '#f59e0b',
        },
        high: {
          minScore: config.thresholds.medium + 1,
          maxScore: 100,
          description: 'High risk pools with significant volatility or limited track record',
          color: '#ef4444',
        },
      },
    });
  }

  /**
   * POST /api/risk-assessment/simulate
   * Simulate scores with hypothetical pool metrics and custom config
   */
  static async simulateScores(req, res) {
    const { pools, config } = req.body;

    if (!Array.isArray(pools) || pools.length === 0) {
      throw new ValidationError('An array of pool metrics is required');
    }

    if (pools.length > 50) {
      throw new ValidationError('Maximum 50 pools allowed for simulation');
    }

    const service = config
      ? new RiskAssessmentService(config)
      : defaultService;

    const results = pools.map(pool => service.assessPool(pool));

    return res.json({
      success: true,
      data: {
        results,
        configUsed: service.getConfig(),
      },
    });
  }
}

module.exports = RiskAssessmentController;
