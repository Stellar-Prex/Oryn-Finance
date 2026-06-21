const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const YieldController = require('../controllers/yieldController');

router.get('/comparison', asyncHandler(YieldController.getComparison));
router.get('/history/:marketId', asyncHandler(YieldController.getHistory));

module.exports = router;
