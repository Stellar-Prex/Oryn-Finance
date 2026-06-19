const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const RiskAssessmentController = require('../controllers/riskAssessmentController');

/**
 * @swagger
 * tags:
 *   name: Risk Assessment
 *   description: Yield pool risk scoring engine
 */

/**
 * @swagger
 * /api/risk-assessment/pools:
 *   post:
 *     summary: Assess risk for one or more yield pools
 *     tags: [Risk Assessment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pools
 *             properties:
 *               pools:
 *                 oneOf:
 *                   - type: object
 *                   - type: array
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: Risk assessment results
 *       400:
 *         description: Invalid input
 */
router.post('/pools', asyncHandler(RiskAssessmentController.assessPools));

/**
 * @swagger
 * /api/risk-assessment/pool/{poolId}:
 *   post:
 *     summary: Assess risk for a specific pool by ID
 *     tags: [Risk Assessment]
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Risk assessment result
 *       400:
 *         description: Invalid input
 */
router.post('/pool/:poolId', asyncHandler(RiskAssessmentController.assessPoolById));

/**
 * @swagger
 * /api/risk-assessment/config:
 *   get:
 *     summary: Get current scoring configuration
 *     tags: [Risk Assessment]
 *     responses:
 *       200:
 *         description: Configuration object
 */
router.get('/config', asyncHandler(RiskAssessmentController.getConfig));

/**
 * @swagger
 * /api/risk-assessment/config:
 *   put:
 *     summary: Update scoring configuration (admin)
 *     tags: [Risk Assessment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated configuration
 *       400:
 *         description: Invalid configuration
 */
router.put('/config', asyncHandler(RiskAssessmentController.updateConfig));

/**
 * @swagger
 * /api/risk-assessment/categories:
 *   get:
 *     summary: Get risk category definitions
 *     tags: [Risk Assessment]
 *     responses:
 *       200:
 *         description: Category definitions
 */
router.get('/categories', asyncHandler(RiskAssessmentController.getCategories));

/**
 * @swagger
 * /api/risk-assessment/simulate:
 *   post:
 *     summary: Simulate risk scores with custom configuration
 *     tags: [Risk Assessment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pools
 *             properties:
 *               pools:
 *                 type: array
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: Simulated results
 *       400:
 *         description: Invalid input
 */
router.post('/simulate', asyncHandler(RiskAssessmentController.simulateScores));

module.exports = router;
