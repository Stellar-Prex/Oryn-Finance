const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { authenticate } = require('../middleware/auth');
const MobileTradingService = require('../services/mobileTradingService');
const logger = require('../config/logger');

/**
 * GET /api/mobile-trading/preferences
 * Get mobile trading preferences for authenticated user
 */
router.get('/preferences', authenticate, asyncHandler(async (req, res) => {
  try {
    const preferences = await MobileTradingService.getMobileTradingPreferences(
      req.user.walletAddress
    );

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    logger.error('Error fetching mobile trading preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching preferences'
    });
  }
}));

/**
 * PUT /api/mobile-trading/preferences
 * Update mobile trading preferences
 */
router.put('/preferences', authenticate, asyncHandler(async (req, res) => {
  const preferences = req.body;

  try {
    const updated = await MobileTradingService.updateMobileTradingPreferences(
      req.user.walletAddress,
      preferences
    );

    res.json({
      success: true,
      data: updated,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    logger.error('Error updating mobile trading preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating preferences'
    });
  }
}));

/**
 * POST /api/mobile-trading/enable
 * Enable mobile trading mode
 */
router.post('/enable', authenticate, asyncHandler(async (req, res) => {
  try {
    const result = await MobileTradingService.enableMobileTrading(
      req.user.walletAddress
    );

    res.json({
      success: true,
      data: result,
      message: 'Mobile trading mode enabled'
    });
  } catch (error) {
    logger.error('Error enabling mobile trading:', error);
    res.status(500).json({
      success: false,
      message: 'Error enabling mobile trading'
    });
  }
}));

/**
 * POST /api/mobile-trading/disable
 * Disable mobile trading mode
 */
router.post('/disable', authenticate, asyncHandler(async (req, res) => {
  try {
    const result = await MobileTradingService.disableMobileTrading(
      req.user.walletAddress
    );

    res.json({
      success: true,
      data: result,
      message: 'Mobile trading mode disabled'
    });
  } catch (error) {
    logger.error('Error disabling mobile trading:', error);
    res.status(500).json({
      success: false,
      message: 'Error disabling mobile trading'
    });
  }
}));

/**
 * GET /api/mobile-trading/chart-config
 * Get optimized mobile chart configuration
 */
router.get('/chart-config', authenticate, asyncHandler(async (req, res) => {
  try {
    const { User } = require('../models');
    const user = await User.findOne({ walletAddress: req.user.walletAddress });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const config = MobileTradingService.getMobileChartConfiguration(
      user.preferences.mobileTrading
    );

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error fetching chart configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching configuration'
    });
  }
}));

/**
 * GET /api/mobile-trading/quick-trade-config
 * Get quick trade panel configuration
 */
router.get('/quick-trade-config', authenticate, asyncHandler(async (req, res) => {
  try {
    const { User } = require('../models');
    const user = await User.findOne({ walletAddress: req.user.walletAddress });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const config = MobileTradingService.getQuickTradePanelConfiguration(
      user.preferences.mobileTrading
    );

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error fetching quick trade configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching configuration'
    });
  }
}));

/**
 * GET /api/mobile-trading/gestures
 * Get gesture interaction setup
 */
router.get('/gestures', authenticate, asyncHandler(async (req, res) => {
  try {
    const { User } = require('../models');
    const user = await User.findOne({ walletAddress: req.user.walletAddress });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const gestures = MobileTradingService.getGestureInteractions(
      user.preferences.mobileTrading
    );

    res.json({
      success: true,
      data: gestures
    });
  } catch (error) {
    logger.error('Error fetching gesture configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching configuration'
    });
  }
}));

/**
 * POST /api/mobile-trading/validate-trade
 * Validate mobile trade execution
 */
router.post('/validate-trade', authenticate, asyncHandler(async (req, res) => {
  const tradeData = req.body;

  try {
    const { User } = require('../models');
    const user = await User.findOne({ walletAddress: req.user.walletAddress });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const validation = MobileTradingService.validateMobileTrade(
      tradeData,
      user.preferences.mobileTrading
    );

    res.json({
      success: validation.valid,
      data: validation
    });
  } catch (error) {
    logger.error('Error validating trade:', error);
    res.status(400).json({
      success: false,
      message: 'Error validating trade',
      data: { valid: false, errors: [error.message] }
    });
  }
}));

/**
 * GET /api/mobile-trading/analytics
 * Get mobile trading analytics
 */
router.get('/analytics', authenticate, asyncHandler(async (req, res) => {
  const { timeframe = '7d' } = req.query;

  try {
    const analytics = await MobileTradingService.getMobileTradingAnalytics(
      req.user.walletAddress,
      timeframe
    );

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error fetching mobile trading analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics'
    });
  }
}));

/**
 * POST /api/mobile-trading/update-order-size
 * Update default order size for quick trades
 */
router.post('/update-order-size', authenticate, asyncHandler(async (req, res) => {
  const { orderSize } = req.body;

  if (!orderSize || orderSize <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid order size is required'
    });
  }

  try {
    const updated = await MobileTradingService.updateMobileTradingPreferences(
      req.user.walletAddress,
      { defaultOrderSize: orderSize }
    );

    res.json({
      success: true,
      data: updated,
      message: 'Order size updated successfully'
    });
  } catch (error) {
    logger.error('Error updating order size:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order size'
    });
  }
}));

module.exports = router;
