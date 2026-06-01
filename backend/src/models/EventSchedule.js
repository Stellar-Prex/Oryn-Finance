const mongoose = require('mongoose');

const eventScheduleSchema = new mongoose.Schema({
  marketId: {
    type: String,
    required: true,
    index: true,
    ref: 'Market'
  },
  eventType: {
    type: String,
    enum: ['market-open', 'market-close', 'resolution', 'custom'],
    required: true
  },
  baseDateTime: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  recurrence: {
    type: String,
    enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'],
    default: 'once'
  },
  recurrenceEndDate: {
    type: Date,
    default: null
  },
  localizedTimes: [{
    timezone: {
      type: String,
      required: true
    },
    formattedTime: {
      type: String,
      required: true
    },
    offsetMinutes: {
      type: Number,
      required: true
    },
    localDate: {
      type: Date,
      required: true
    }
  }],
  description: {
    type: String,
    maxlength: 500
  },
  notificationMinutesBefore: [{
    type: Number,
    default: [5, 15, 60] // 5 mins, 15 mins, 1 hour
  }],
  notificationsSent: [{
    timezone: String,
    minutesBefore: Number,
    sentAt: Date,
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'pending'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

eventScheduleSchema.index({ marketId: 1, eventType: 1 });

module.exports = mongoose.model('EventSchedule', eventScheduleSchema);
