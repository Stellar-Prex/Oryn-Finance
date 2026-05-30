const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { validateRequest } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const TimezoneService = require('../services/timezoneService');
const { EventSchedule } = require('../models');
const logger = require('../config/logger');

/**
 * GET /api/timezones
 * Get all available timezones
 */
router.get('/all', asyncHandler(async (req, res) => {
  const timezones = TimezoneService.getAllTimezones();
  res.json({
    success: true,
    data: timezones,
    count: timezones.length
  });
}));

/**
 * GET /api/timezones/user
 * Get user's current timezone setting
 */
router.get('/user', authenticate, asyncHandler(async (req, res) => {
  const userTimezone = await TimezoneService.getUserTimezone(req.user.walletAddress);
  res.json({
    success: true,
    timezone: userTimezone
  });
}));

/**
 * POST /api/timezones/convert
 * Convert UTC time to multiple timezones
 */
router.post('/convert', asyncHandler(async (req, res) => {
  const { utcDateTime, timezones } = req.body;

  if (!utcDateTime) {
    return res.status(400).json({ 
      success: false, 
      message: 'UTC datetime is required' 
    });
  }

  try {
    const converted = TimezoneService.convertToTimezones(utcDateTime, timezones || []);
    res.json({
      success: true,
      data: converted
    });
  } catch (error) {
    logger.error('Timezone conversion error:', error);
    res.status(400).json({ 
      success: false, 
      message: 'Invalid datetime or timezones' 
    });
  }
}));

/**
 * GET /api/timezones/countdown/:marketId
 * Get countdown in user's timezone
 */
router.get('/countdown/:marketId', authenticate, asyncHandler(async (req, res) => {
  const { marketId } = req.params;
  
  const eventSchedule = await EventSchedule.findOne({ marketId });
  if (!eventSchedule) {
    return res.status(404).json({ 
      success: false, 
      message: 'Event schedule not found' 
    });
  }

  const userTimezone = await TimezoneService.getUserTimezone(req.user.walletAddress);
  const countdown = TimezoneService.getCountdownInTimezone(
    eventSchedule.baseDateTime,
    userTimezone
  );

  res.json({
    success: true,
    data: countdown
  });
}));

/**
 * POST /api/timezones/event-schedule
 * Create or update event schedule with localized times
 */
router.post('/event-schedule', authenticate, asyncHandler(async (req, res) => {
  const { marketId, eventType, baseDateTime, timezone, localizationTimezones } = req.body;

  if (!marketId || !eventType || !baseDateTime || !timezone) {
    return res.status(400).json({ 
      success: false, 
      message: 'marketId, eventType, baseDateTime, and timezone are required' 
    });
  }

  try {
    const eventSchedule = await TimezoneService.createEventSchedule(
      marketId,
      {
        eventType,
        baseDateTime,
        timezone,
        localizationTimezones,
        ...req.body
      }
    );

    res.status(201).json({
      success: true,
      data: eventSchedule
    });
  } catch (error) {
    logger.error('Event schedule creation error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
}));

/**
 * GET /api/timezones/event-schedule/:marketId
 * Get event schedule with localized times
 */
router.get('/event-schedule/:marketId', asyncHandler(async (req, res) => {
  const { marketId } = req.params;

  const eventSchedule = await EventSchedule.findOne({ marketId });
  if (!eventSchedule) {
    return res.status(404).json({ 
      success: false, 
      message: 'Event schedule not found' 
    });
  }

  res.json({
    success: true,
    data: eventSchedule
  });
}));

/**
 * GET /api/timezones/format
 * Format datetime according to user preferences
 */
router.get('/format', authenticate, asyncHandler(async (req, res) => {
  const { dateTime } = req.query;

  if (!dateTime) {
    return res.status(400).json({ 
      success: false, 
      message: 'dateTime parameter is required' 
    });
  }

  try {
    const { User } = require('../models');
    const user = await User.findOne({ walletAddress: req.user.walletAddress });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const formatted = TimezoneService.formatForUser(dateTime, user.preferences);
    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    logger.error('Datetime formatting error:', error);
    res.status(400).json({ 
      success: false, 
      message: 'Invalid datetime' 
    });
  }
}));

/**
 * GET /api/timezones/is-coming-up/:marketId
 * Check if event is coming up for user
 */
router.get('/is-coming-up/:marketId', authenticate, asyncHandler(async (req, res) => {
  const { marketId } = req.params;
  const { minutesWindow } = req.query;

  const eventSchedule = await EventSchedule.findOne({ marketId });
  if (!eventSchedule) {
    return res.status(404).json({ 
      success: false, 
      message: 'Event schedule not found' 
    });
  }

  const userTimezone = await TimezoneService.getUserTimezone(req.user.walletAddress);
  const isComingUp = TimezoneService.isEventComingUp(
    eventSchedule.baseDateTime,
    userTimezone,
    parseInt(minutesWindow) || 60
  );

  res.json({
    success: true,
    data: isComingUp
  });
}));

/**
 * GET /api/timezones/schedule/:marketId
 * Get all scheduled events for a market
 */
router.get('/schedule/:marketId', asyncHandler(async (req, res) => {
  const { marketId } = req.params;

  const schedules = await EventSchedule.find({ marketId }).sort({ baseDateTime: 1 });

  res.json({
    success: true,
    data: schedules,
    count: schedules.length
  });
}));

module.exports = router;
