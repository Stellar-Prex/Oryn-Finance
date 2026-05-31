const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { authenticate } = require('../middleware/auth');
const WhaleMonitoringService = require('../services/whaleMonitoringService');
const logger = require('../config/logger');

/**
 * GET /api/whale-activity/feed
 * Get whale activity feed
 */
router.get('/feed', asyncHandler(async (req, res) => {
  const {
    marketId,
    walletAddress,
    severity,
    alertType,
    timeframe = 86400000, // 24 hours
    limit = 50,
    skip = 0
  } = req.query;

  try {
    const result = await WhaleMonitoringService.getWhaleActivityFeed(
      {
        marketId,
        walletAddress,
        severity,
        alertType,
        timeframe: parseInt(timeframe)
      },
      parseInt(limit),
      parseInt(skip)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching whale activity feed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching whale activity feed' 
    });
  }
}));

/**
 * GET /api/whale-activity/profile/:walletAddress
 * Get whale profile for a wallet
 */
router.get('/profile/:walletAddress', asyncHandler(async (req, res) => {
  const { walletAddress } = req.params;

  try {
    const profile = await WhaleMonitoringService.getWhaleProfile(walletAddress);

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Error fetching whale profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching whale profile' 
    });
  }
}));

/**
 * GET /api/whale-activity/alerts/:marketId
 * Get whale alerts for a market
 */
router.get('/alerts/:marketId', asyncHandler(async (req, res) => {
  const { marketId } = req.params;
  const { severity, limit = 50, skip = 0 } = req.query;

  try {
    const result = await WhaleMonitoringService.getWhaleActivityFeed(
      {
        marketId,
        severity
      },
      parseInt(limit),
      parseInt(skip)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching market alerts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching alerts' 
    });
  }
}));

/**
 * POST /api/whale-activity/dismiss/:alertId
 * Dismiss a whale alert
 */
router.post('/dismiss/:alertId', authenticate, asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const { dismissReason } = req.body;

  try {
    const alert = await WhaleMonitoringService.dismissAlert(
      alertId,
      req.user.walletAddress,
      dismissReason
    );

    res.json({
      success: true,
      data: alert,
      message: 'Alert dismissed'
    });
  } catch (error) {
    logger.error('Error dismissing alert:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error dismissing alert' 
    });
  }
}));

/**
 * GET /api/whale-activity/alert/:alertId
 * Get alert details
 */
router.get('/alert/:alertId', asyncHandler(async (req, res) => {
  const { alertId } = req.params;

  try {
    const { WhaleAlert } = require('../models');
    const alert = await WhaleAlert.findOne({ alertId });

    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        message: 'Alert not found' 
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching alert' 
    });
  }
}));

/**
 * POST /api/whale-activity/detect
 * Manually detect whale transaction
 * (for testing/admin purposes)
 */
router.post('/detect', authenticate, asyncHandler(async (req, res) => {
  const tradeData = req.body;

  // In production, validate that user has admin rights
  // if (!req.user.isAdmin) {
  //   return res.status(403).json({ success: false, message: 'Unauthorized' });
  // }

  try {
    const whaleTransaction = await WhaleMonitoringService.detectWhaleTransaction(tradeData);

    res.json({
      success: true,
      data: whaleTransaction,
      message: whaleTransaction ? 'Whale transaction detected' : 'Not a whale transaction'
    });
  } catch (error) {
    logger.error('Error detecting whale transaction:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
}));

/**
 * GET /api/whale-activity/stats
 * Get overall whale activity statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { timeframe = 86400000 } = req.query; // Default 24 hours

  try {
    const { WhaleAlert } = require('../models');
    
    const timeAgo = new Date(Date.now() - parseInt(timeframe));
    
    const stats = await WhaleAlert.aggregate([
      {
        $match: { createdAt: { $gte: timeAgo } }
      },
      {
        $group: {
          _id: null,
          totalAlerts: { $sum: 1 },
          criticalAlerts: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
          },
          highAlerts: {
            $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
          },
          uniqueWallets: { $addToSet: '$walletAddress' },
          affectedMarkets: { $addToSet: '$marketId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalAlerts: 1,
          criticalAlerts: 1,
          highAlerts: 1,
          uniqueWalletsCount: { $size: '$uniqueWallets' },
          affectedMarketsCount: { $size: '$affectedMarkets' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalAlerts: 0,
        criticalAlerts: 0,
        highAlerts: 0,
        uniqueWalletsCount: 0,
        affectedMarketsCount: 0
      }
    });
  } catch (error) {
    logger.error('Error fetching whale activity stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching statistics' 
    });
  }
}));

module.exports = router;
