const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const PortfolioAnalyticsController = require('../controllers/portfolioAnalyticsController');

router.get('/:walletAddress/performance', asyncHandler(PortfolioAnalyticsController.getPerformanceSeries));
router.get('/:walletAddress/allocation',  asyncHandler(PortfolioAnalyticsController.getAllocation));
router.get('/:walletAddress/yield',       asyncHandler(PortfolioAnalyticsController.getYieldBreakdown));
router.get('/:walletAddress/growth',      asyncHandler(PortfolioAnalyticsController.getGrowthMetrics));
router.get('/:walletAddress/summary',     asyncHandler(PortfolioAnalyticsController.getSummary));

module.exports = router;
