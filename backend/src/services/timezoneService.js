const moment = require('moment-timezone');
const { EventSchedule, User } = require('../models');
const logger = require('../config/logger');

class TimezoneService {
  /**
   * Convert UTC time to multiple timezones
   */
  static convertToTimezones(utcDateTime, timezones = []) {
    try {
      const baseMoment = moment.utc(utcDateTime);
      
      const results = timezones.map(tz => {
        const localMoment = baseMoment.clone().tz(tz);
        return {
          timezone: tz,
          formattedTime: localMoment.format('YYYY-MM-DD HH:mm:ss z'),
          offsetMinutes: localMoment.utcOffset(),
          localDate: localMoment.toDate()
        };
      });
      
      return results;
    } catch (error) {
      logger.error('Error converting to timezones:', error);
      throw error;
    }
  }

  /**
   * Get user's preferred timezone
   */
  static async getUserTimezone(walletAddress) {
    try {
      const user = await User.findOne({ walletAddress });
      return user?.preferences?.localization?.timezone || 'UTC';
    } catch (error) {
      logger.error('Error getting user timezone:', error);
      return 'UTC';
    }
  }

  /**
   * Create or update event schedule with localized times
   */
  static async createEventSchedule(marketId, eventData) {
    try {
      const { eventType, baseDateTime, timezone, localizationTimezones = [] } = eventData;
      
      const localizedTimes = this.convertToTimezones(baseDateTime, [timezone, ...localizationTimezones]);
      
      const eventSchedule = await EventSchedule.findOneAndUpdate(
        { marketId, eventType },
        {
          marketId,
          eventType,
          baseDateTime: moment.utc(baseDateTime).toDate(),
          timezone,
          localizedTimes,
          ...eventData
        },
        { upsert: true, new: true }
      );
      
      return eventSchedule;
    } catch (error) {
      logger.error('Error creating event schedule:', error);
      throw error;
    }
  }

  /**
   * Get countdown time in user's timezone
   */
  static getCountdownInTimezone(eventDateTime, userTimezone = 'UTC') {
    try {
      const eventMoment = moment.utc(eventDateTime);
      const now = moment.utc();
      
      if (now.isAfter(eventMoment)) {
        return {
          passed: true,
          countdown: null,
          message: 'Event has already occurred'
        };
      }
      
      const duration = moment.duration(eventMoment.diff(now));
      const userEventTime = eventMoment.clone().tz(userTimezone);
      
      return {
        passed: false,
        countdown: {
          days: Math.floor(duration.asDays()),
          hours: duration.hours(),
          minutes: duration.minutes(),
          seconds: duration.seconds(),
          totalSeconds: duration.asSeconds(),
          totalMilliseconds: duration.asMilliseconds()
        },
        userLocalTime: userEventTime.format('YYYY-MM-DD HH:mm:ss z'),
        utcTime: eventMoment.format('YYYY-MM-DD HH:mm:ss z')
      };
    } catch (error) {
      logger.error('Error calculating countdown:', error);
      throw error;
    }
  }

  /**
   * Get all timezones
   */
  static getAllTimezones() {
    return moment.tz.names();
  }

  /**
   * Schedule notifications for event in different timezones
   */
  static scheduleTimezoneNotifications(eventSchedule, notificationMinutes = [5, 15, 60]) {
    try {
      const { baseDateTime, localizedTimes } = eventSchedule;
      const notifications = [];
      
      localizedTimes.forEach(localTime => {
        notificationMinutes.forEach(minutes => {
          const notificationTime = moment(localTime.localDate)
            .subtract(minutes, 'minutes')
            .toDate();
          
          notifications.push({
            timezone: localTime.timezone,
            minutesBefore: minutes,
            notificationTime,
            scheduledFor: localTime.localDate
          });
        });
      });
      
      return notifications;
    } catch (error) {
      logger.error('Error scheduling timezone notifications:', error);
      throw error;
    }
  }

  /**
   * Format datetime according to user preferences
   */
  static formatForUser(dateTime, userPreferences) {
    try {
      const { localization } = userPreferences;
      const timezone = localization?.timezone || 'UTC';
      const dateFormat = localization?.dateFormat || 'MM/DD/YYYY';
      const timeFormat = localization?.timeFormat === '24h' ? 'HH:mm:ss' : 'hh:mm:ss A';
      
      const moment_ = moment.utc(dateTime).tz(timezone);
      const date = moment_.format(dateFormat);
      const time = moment_.format(timeFormat);
      const tzAbbr = moment_.format('z');
      
      return {
        date,
        time,
        timezone: tzAbbr,
        fullDateTime: `${date} ${time} ${tzAbbr}`
      };
    } catch (error) {
      logger.error('Error formatting datetime for user:', error);
      throw error;
    }
  }

  /**
   * Check if event is coming up for user based on timezone
   */
  static isEventComingUp(eventDateTime, userTimezone = 'UTC', minutesWindow = 60) {
    try {
      const now = moment.utc();
      const event = moment.utc(eventDateTime);
      const diff = event.diff(now, 'minutes');
      
      return {
        isComingUp: diff > 0 && diff <= minutesWindow,
        minutesUntilEvent: diff,
        eventInUserTimezone: event.clone().tz(userTimezone).format('YYYY-MM-DD HH:mm:ss z')
      };
    } catch (error) {
      logger.error('Error checking if event is coming up:', error);
      throw error;
    }
  }
}

module.exports = TimezoneService;
