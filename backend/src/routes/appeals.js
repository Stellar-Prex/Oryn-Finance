const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { authenticate } = require('../middleware/auth');
const AppealService = require('../services/appealService');
const logger = require('../config/logger');

/**
 * POST /api/appeals
 * Submit a new appeal
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { marketId, reason, description, evidence = [] } = req.body;

  if (!marketId || !reason || !description) {
    return res.status(400).json({
      success: false,
      message: 'marketId, reason, and description are required'
    });
  }

  try {
    const appeal = await AppealService.submitAppeal({
      marketId,
      appealedBy: req.user.walletAddress,
      reason,
      description,
      evidence
    });

    res.status(201).json({
      success: true,
      data: appeal,
      message: 'Appeal submitted successfully'
    });
  } catch (error) {
    logger.error('Error submitting appeal:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * GET /api/appeals/:appealId
 * Get appeal details
 */
router.get('/:appealId', asyncHandler(async (req, res) => {
  const { appealId } = req.params;

  try {
    const appeal = await AppealService.getAppealDetails(appealId);

    res.json({
      success: true,
      data: appeal
    });
  } catch (error) {
    logger.error('Error fetching appeal:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * GET /api/appeals
 * Get appeals with filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    status,
    marketId,
    appealedBy,
    priority,
    sortBy = '-createdAt',
    limit = 50,
    skip = 0
  } = req.query;

  try {
    const result = await AppealService.getAppeals(
      {
        status,
        marketId,
        appealedBy,
        priority,
        sortBy
      },
      parseInt(limit),
      parseInt(skip)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching appeals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appeals'
    });
  }
}));

/**
 * POST /api/appeals/:appealId/assign-reviewers
 * Assign reviewers to appeal
 */
router.post('/:appealId/assign-reviewers', authenticate, asyncHandler(async (req, res) => {
  const { appealId } = req.params;
  const { reviewerAddresses } = req.body;

  if (!reviewerAddresses || !Array.isArray(reviewerAddresses) || reviewerAddresses.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'reviewerAddresses array is required with at least one reviewer'
    });
  }

  try {
    // Check if user is admin/moderator
    // In production, implement proper authorization
    
    const appeal = await AppealService.assignReviewers(appealId, reviewerAddresses);

    res.json({
      success: true,
      data: appeal,
      message: 'Reviewers assigned successfully'
    });
  } catch (error) {
    logger.error('Error assigning reviewers:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * POST /api/appeals/:appealId/vote
 * Submit a review vote
 */
router.post('/:appealId/vote', authenticate, asyncHandler(async (req, res) => {
  const { appealId } = req.params;
  const { vote, reasoning = '' } = req.body;

  if (!vote || !['support-appeal', 'reject-appeal', 'abstain'].includes(vote)) {
    return res.status(400).json({
      success: false,
      message: 'Valid vote is required (support-appeal, reject-appeal, or abstain)'
    });
  }

  try {
    const appeal = await AppealService.submitReviewVote(
      appealId,
      req.user.walletAddress,
      vote,
      reasoning
    );

    res.json({
      success: true,
      data: appeal,
      message: 'Vote submitted successfully'
    });
  } catch (error) {
    logger.error('Error submitting vote:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * POST /api/appeals/:appealId/finalize
 * Finalize appeal resolution
 */
router.post('/:appealId/finalize', authenticate, asyncHandler(async (req, res) => {
  const { appealId } = req.params;

  try {
    // Check if user is admin/moderator
    // In production, implement proper authorization
    
    const appeal = await AppealService.finalizeAppealResolution(appealId);

    res.json({
      success: true,
      data: appeal,
      message: 'Appeal resolution finalized'
    });
  } catch (error) {
    logger.error('Error finalizing appeal:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * GET /api/appeals/market/:marketId
 * Get all appeals for a market
 */
router.get('/market/:marketId', asyncHandler(async (req, res) => {
  const { marketId } = req.params;
  const { limit = 50, skip = 0 } = req.query;

  try {
    const result = await AppealService.getAppeals(
      { marketId },
      parseInt(limit),
      parseInt(skip)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching market appeals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appeals'
    });
  }
}));

/**
 * GET /api/appeals/user/:userAddress
 * Get all appeals submitted by a user
 */
router.get('/user/:userAddress', asyncHandler(async (req, res) => {
  const { userAddress } = req.params;
  const { limit = 50, skip = 0 } = req.query;

  try {
    const result = await AppealService.getAppeals(
      { appealedBy: userAddress },
      parseInt(limit),
      parseInt(skip)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching user appeals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appeals'
    });
  }
}));

module.exports = router;
