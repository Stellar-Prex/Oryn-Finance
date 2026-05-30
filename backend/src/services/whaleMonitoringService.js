const { v4: uuidv4 } = require('uuid');
const { WhaleTransaction, WhaleAlert, Trade, Market, User } = require('../models');
const logger = require('../config/logger');

class WhaleMonitoringService {
  // Configuration for whale detection
  static WHALE_CONFIG = {
    minTradeVolume: 10000, // USD minimum
    largeTradeVolumePercentage: 5, // 5% of market volume
    accumulationThreshold: 3, // 3 large trades in short period
    priceImpactThreshold: 0.02, // 2% price impact
    reviewPeriod: 24 * 60 * 60 * 1000 // 24 hours
  };

  /**
   * Detect whale transaction and create alert if necessary
   */
  static async detectWhaleTransaction(tradeData) {
    try {
      const { tradeId, marketId, userWalletAddress, amount, price, totalCost } = tradeData;

      // Get market info for volume calculation
      const market = await Market.findOne({ marketId });
      if (!market) {
        logger.warn(`Market ${marketId} not found`);
        return null;
      }

      // Calculate metrics
      const volumePercentage = market.totalVolume > 0 
        ? (amount / market.totalVolume) * 100 
        : 0;

      // Check if this is a whale transaction
      const isWhaleTransaction = 
        totalCost >= this.WHALE_CONFIG.minTradeVolume || 
        volumePercentage >= this.WHALE_CONFIG.largeTradeVolumePercentage;

      if (!isWhaleTransaction) {
        return null;
      }

      // Create whale transaction record
      const whaleTransaction = await WhaleTransaction.create({
        tradeId,
        marketId,
        walletAddress: userWalletAddress,
        tradeType: tradeData.tradeType,
        tokenType: tradeData.tokenType,
        amount,
        price,
        totalCost,
        volumePercentage,
        impactOnPrice: this._calculatePriceImpact(price, volumePercentage),
        marketQuestion: market.question,
        historicalContext: await this._getWalletContext(userWalletAddress, marketId)
      });

      // Generate alert if thresholds met
      if (this._shouldGenerateAlert(whaleTransaction)) {
        await this.generateAlert(whaleTransaction);
      }

      return whaleTransaction;
    } catch (error) {
      logger.error('Error detecting whale transaction:', error);
      throw error;
    }
  }

  /**
   * Generate alert for whale activity
   */
  static async generateAlert(whaleTransaction) {
    try {
      const severity = this._calculateAlertSeverity(whaleTransaction);
      const alertType = this._determineAlertType(whaleTransaction);

      const alert = await WhaleAlert.create({
        alertId: uuidv4(),
        whaleTransactionId: whaleTransaction._id,
        marketId: whaleTransaction.marketId,
        walletAddress: whaleTransaction.walletAddress,
        alertType,
        severity,
        title: this._generateAlertTitle(alertType, whaleTransaction),
        description: this._generateAlertDescription(whaleTransaction),
        tradeDetails: {
          amount: whaleTransaction.amount,
          price: whaleTransaction.price,
          totalCost: whaleTransaction.totalCost,
          tokenType: whaleTransaction.tokenType,
          tradeType: whaleTransaction.tradeType
        },
        metrics: {
          volumePercentage: whaleTransaction.volumePercentage,
          priceImpact: whaleTransaction.impactOnPrice,
          avgTradeSize: await this._getWalletAverageTradeSize(whaleTransaction.walletAddress)
        }
      });

      // Update whale transaction to link to alert
      await WhaleTransaction.updateOne(
        { _id: whaleTransaction._id },
        { alertGenerated: true, alertSeverity: severity }
      );

      // Send notifications to relevant users
      await this._notifyUsersOfAlert(alert);

      return alert;
    } catch (error) {
      logger.error('Error generating whale alert:', error);
      throw error;
    }
  }

  /**
   * Get whale activity feed
   */
  static async getWhaleActivityFeed(filters = {}, limit = 50, skip = 0) {
    try {
      const {
        marketId,
        walletAddress,
        severity,
        alertType,
        timeframe = 24 * 60 * 60 * 1000
      } = filters;

      const query = {};
      if (marketId) query.marketId = marketId;
      if (walletAddress) query.walletAddress = walletAddress;
      if (severity) query.severity = severity;
      if (alertType) query.alertType = alertType;

      // Add time filter
      const timeAgo = new Date(Date.now() - timeframe);
      query.createdAt = { $gte: timeAgo };

      const alerts = await WhaleAlert.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await WhaleAlert.countDocuments(query);

      return {
        alerts,
        total,
        limit,
        skip
      };
    } catch (error) {
      logger.error('Error getting whale activity feed:', error);
      throw error;
    }
  }

  /**
   * Get whale profile for a wallet
   */
  static async getWhaleProfile(walletAddress) {
    try {
      const transactions = await WhaleTransaction.find({ walletAddress })
        .sort({ createdAt: -1 })
        .lean();

      const alerts = await WhaleAlert.find({ walletAddress })
        .sort({ createdAt: -1 })
        .lean();

      const totalVolume = transactions.reduce((sum, t) => sum + t.totalCost, 0);
      const totalTrades = transactions.length;
      const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

      const marketsInvolved = [...new Set(transactions.map(t => t.marketId))].length;
      const highSeverityAlerts = alerts.filter(a => 
        a.severity === 'critical' || a.severity === 'high'
      ).length;

      return {
        walletAddress,
        totalVolume,
        totalTrades,
        averageTradeSize,
        marketsInvolved,
        alertCount: alerts.length,
        highSeverityAlerts,
        recentTransactions: transactions.slice(0, 10),
        recentAlerts: alerts.slice(0, 10),
        accountAge: await this._getWalletAge(walletAddress)
      };
    } catch (error) {
      logger.error('Error getting whale profile:', error);
      throw error;
    }
  }

  /**
   * Dismiss a whale alert
   */
  static async dismissAlert(alertId, dismissedBy, dismissReason = '') {
    try {
      const alert = await WhaleAlert.findOneAndUpdate(
        { alertId },
        {
          dismissed: true,
          dismissedAt: new Date(),
          dismissedBy,
          dismissReason
        },
        { new: true }
      );

      return alert;
    } catch (error) {
      logger.error('Error dismissing alert:', error);
      throw error;
    }
  }

  // Private helper methods

  static _calculatePriceImpact(price, volumePercentage) {
    // Rough estimation of price impact based on volume percentage
    return volumePercentage * 0.001; // 0.1% impact per 1% of volume
  }

  static _shouldGenerateAlert(whaleTransaction) {
    return whaleTransaction.totalCost >= this.WHALE_CONFIG.minTradeVolume ||
           whaleTransaction.volumePercentage >= this.WHALE_CONFIG.largeTradeVolumePercentage;
  }

  static _calculateAlertSeverity(whaleTransaction) {
    if (whaleTransaction.volumePercentage > 15) return 'critical';
    if (whaleTransaction.volumePercentage > 10) return 'high';
    if (whaleTransaction.volumePercentage > 7) return 'medium';
    return 'low';
  }

  static _determineAlertType(whaleTransaction) {
    const context = whaleTransaction.historicalContext;
    
    if (context.isNewToMarket) return 'large-trade';
    if (context.walletTotalVolume > 1000000) return 'accumulation';
    
    return 'large-trade';
  }

  static _generateAlertTitle(alertType, whaleTransaction) {
    const amount = whaleTransaction.amount.toFixed(2);
    const costK = (whaleTransaction.totalCost / 1000).toFixed(0);
    
    const titles = {
      'large-trade': `Large Trade: ${whaleTransaction.tokenType.toUpperCase()} - ${amount} tokens ($${costK}k)`,
      'accumulation': `Whale Accumulating: ${whaleTransaction.tokenType.toUpperCase()} position`,
      'distribution': `Whale Distribution: ${whaleTransaction.tokenType.toUpperCase()} position`
    };
    
    return titles[alertType] || titles['large-trade'];
  }

  static _generateAlertDescription(whaleTransaction) {
    const market = whaleTransaction.marketQuestion;
    const type = whaleTransaction.tradeType.toUpperCase();
    const token = whaleTransaction.tokenType.toUpperCase();
    const amount = whaleTransaction.amount.toFixed(2);
    const volumePercent = whaleTransaction.volumePercentage.toFixed(2);
    
    return `A whale wallet just ${type} ${amount} ${token} tokens (${volumePercent}% of market volume) in market: "${market}"`;
  }

  static async _getWalletContext(walletAddress, marketId) {
    try {
      const allTransactions = await WhaleTransaction.find({ walletAddress });
      const marketTransactions = allTransactions.filter(t => t.marketId === marketId);
      
      const walletTotalVolume = allTransactions.reduce((sum, t) => sum + t.totalCost, 0);
      const isNewToMarket = marketTransactions.length === 0;
      
      // Estimate wallet age
      const walletAge = allTransactions.length > 0 
        ? Math.floor((Date.now() - new Date(allTransactions[0].createdAt)) / (24 * 60 * 60 * 1000))
        : 0;

      return {
        walletTotalVolume,
        marketTotalVolume: 0, // Would be fetched from market
        isNewToMarket,
        walletAge
      };
    } catch (error) {
      logger.error('Error getting wallet context:', error);
      return {
        walletTotalVolume: 0,
        marketTotalVolume: 0,
        isNewToMarket: true,
        walletAge: 0
      };
    }
  }

  static async _getWalletAverageTradeSize(walletAddress) {
    try {
      const transactions = await WhaleTransaction.find({ walletAddress });
      if (transactions.length === 0) return 0;
      
      const total = transactions.reduce((sum, t) => sum + t.totalCost, 0);
      return total / transactions.length;
    } catch (error) {
      logger.error('Error getting wallet average trade size:', error);
      return 0;
    }
  }

  static async _getWalletAge(walletAddress) {
    try {
      const transactions = await WhaleTransaction.find({ walletAddress })
        .sort({ createdAt: 1 })
        .limit(1);
      
      if (transactions.length === 0) return 0;
      
      return Math.floor((Date.now() - new Date(transactions[0].createdAt)) / (24 * 60 * 60 * 1000));
    } catch (error) {
      logger.error('Error getting wallet age:', error);
      return 0;
    }
  }

  static async _notifyUsersOfAlert(alert) {
    try {
      const userPreferences = await User.find({
        'preferences.whaleAlerts.enabled': true,
        'preferences.whaleAlerts.minSeverity': { $in: ['critical', 'high', 'medium', 'low'] }
      });

      // Filter users based on their severity preference and watched markets
      const relevantUsers = userPreferences.filter(user => {
        const minSev = user.preferences.whaleAlerts.minSeverity;
        const severities = ['low', 'medium', 'high', 'critical'];
        
        const shouldNotify = severities.indexOf(alert.severity) >= severities.indexOf(minSev);
        const watchesMarket = user.preferences.whaleAlerts.watchedMarkets.includes(alert.marketId);
        const notMuted = !user.preferences.whaleAlerts.mutedWallets.includes(alert.walletAddress);
        
        return shouldNotify && (watchesMarket || !user.preferences.whaleAlerts.watchedMarkets.length) && notMuted;
      });

      // Queue notifications for these users
      // Implementation would depend on your notification service
      logger.info(`Queued whale alert notifications for ${relevantUsers.length} users`);
      
      return relevantUsers.length;
    } catch (error) {
      logger.error('Error notifying users of alert:', error);
      return 0;
    }
  }
}

module.exports = WhaleMonitoringService;
