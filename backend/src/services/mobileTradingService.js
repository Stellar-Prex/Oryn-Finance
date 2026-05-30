const { User } = require('../models');
const logger = require('../config/logger');

class MobileTradingService {
  /**
   * Get or initialize mobile trading preferences for user
   */
  static async getMobileTradingPreferences(walletAddress) {
    try {
      const user = await User.findOne({ walletAddress });
      if (!user) {
        throw new Error(`User ${walletAddress} not found`);
      }

      return {
        walletAddress,
        mobileTrading: user.preferences.mobileTrading || this._getDefaultPreferences()
      };
    } catch (error) {
      logger.error('Error getting mobile trading preferences:', error);
      throw error;
    }
  }

  /**
   * Update mobile trading preferences
   */
  static async updateMobileTradingPreferences(walletAddress, preferences) {
    try {
      const user = await User.findOneAndUpdate(
        { walletAddress },
        { 'preferences.mobileTrading': preferences },
        { new: true }
      );

      if (!user) {
        throw new Error(`User ${walletAddress} not found`);
      }

      return user.preferences.mobileTrading;
    } catch (error) {
      logger.error('Error updating mobile trading preferences:', error);
      throw error;
    }
  }

  /**
   * Enable mobile trading mode for user
   */
  static async enableMobileTrading(walletAddress) {
    try {
      const user = await User.findOneAndUpdate(
        { walletAddress },
        { 'preferences.mobileTrading.enabled': true },
        { new: true }
      );

      if (!user) {
        throw new Error(`User ${walletAddress} not found`);
      }

      return {
        enabled: true,
        preferences: user.preferences.mobileTrading
      };
    } catch (error) {
      logger.error('Error enabling mobile trading:', error);
      throw error;
    }
  }

  /**
   * Disable mobile trading mode for user
   */
  static async disableMobileTrading(walletAddress) {
    try {
      const user = await User.findOneAndUpdate(
        { walletAddress },
        { 'preferences.mobileTrading.enabled': false },
        { new: true }
      );

      if (!user) {
        throw new Error(`User ${walletAddress} not found`);
      }

      return {
        enabled: false,
        preferences: user.preferences.mobileTrading
      };
    } catch (error) {
      logger.error('Error disabling mobile trading:', error);
      throw error;
    }
  }

  /**
   * Get optimized mobile chart configuration
   */
  static getMobileChartConfiguration(userPreferences = {}) {
    return {
      enabled: userPreferences.optimizedCharts !== false,
      layout: {
        responsive: true,
        compact: true,
        hideVolume: false,
        hideOrderBook: true,
        hiddenIndicators: ['MACD', 'Stochastic'], // Simplified for mobile
        defaultTimeframe: '1h',
        allowedTimeframes: ['5m', '15m', '1h', '4h', '1d']
      },
      performance: {
        updateInterval: 1000, // 1 second for mobile (vs 500ms for desktop)
        candleLimit: 200, // Fewer candles for mobile
        dataPoints: 100
      },
      gestures: {
        enabled: userPreferences.gestureEnabled !== false,
        pinchToZoom: true,
        swipeToNavigate: true,
        longPressToBuy: true,
        doubleTapToSell: true
      }
    };
  }

  /**
   * Get quick trade panel configuration
   */
  static getQuickTradePanelConfiguration(userPreferences = {}) {
    return {
      enabled: userPreferences.quickTradePanel !== false,
      defaultOrderSize: userPreferences.defaultOrderSize || 100,
      defaultSlippage: userPreferences.defaultSlippageMobile || 0.02,
      oneClickTradingEnabled: userPreferences.oneClickTrading || false,
      layout: {
        position: 'bottom', // Can be: 'bottom', 'fullscreen', 'side'
        showPercentages: true,
        quickButtons: ['10%', '25%', '50%', '75%', '100%'],
        presets: [
          { label: 'Small', amount: 50 },
          { label: 'Medium', amount: 100 },
          { label: 'Large', amount: 500 }
        ]
      },
      confirmations: {
        requireConfirmation: !userPreferences.oneClickTrading,
        showPriceImpact: true,
        showSlippage: true,
        showGasFee: true
      }
    };
  }

  /**
   * Get gesture interaction setup
   */
  static getGestureInteractions(userPreferences = {}) {
    if (!userPreferences.gestureEnabled) {
      return {
        enabled: false,
        gestures: []
      };
    }

    return {
      enabled: true,
      gestures: [
        {
          name: 'swipe-left',
          action: 'next-market',
          description: 'Swipe left to go to next market',
          enabled: true
        },
        {
          name: 'swipe-right',
          action: 'previous-market',
          description: 'Swipe right to go to previous market',
          enabled: true
        },
        {
          name: 'swipe-up',
          action: 'open-quick-trade',
          description: 'Swipe up to open quick trade panel',
          enabled: true
        },
        {
          name: 'swipe-down',
          action: 'close-quick-trade',
          description: 'Swipe down to close quick trade panel',
          enabled: true
        },
        {
          name: 'long-press',
          action: 'quick-buy',
          description: 'Long press to execute quick buy',
          enabled: true
        },
        {
          name: 'double-tap',
          action: 'quick-sell',
          description: 'Double tap to execute quick sell',
          enabled: true
        },
        {
          name: 'pinch-in',
          action: 'zoom-in-chart',
          description: 'Pinch in to zoom in on chart',
          enabled: true
        },
        {
          name: 'pinch-out',
          action: 'zoom-out-chart',
          description: 'Pinch out to zoom out on chart',
          enabled: true
        }
      ]
    };
  }

  /**
   * Validate mobile trade execution
   */
  static validateMobileTrade(tradeData, userPreferences) {
    const errors = [];

    if (!tradeData.marketId) {
      errors.push('Market ID is required');
    }

    if (!tradeData.amount || tradeData.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!tradeData.tokenType || !['yes', 'no'].includes(tradeData.tokenType)) {
      errors.push('Token type must be yes or no');
    }

    if (!tradeData.tradeType || !['buy', 'sell'].includes(tradeData.tradeType)) {
      errors.push('Trade type must be buy or sell');
    }

    // Check against user's default order size
    if (tradeData.amount > (userPreferences.defaultOrderSize || 100) * 10) {
      errors.push('Order size exceeds recommended maximum for mobile trading');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: this._validateMobileTradeWarnings(tradeData, userPreferences)
    };
  }

  /**
   * Get mobile trading analytics
   */
  static async getMobileTradingAnalytics(walletAddress, timeframe = '7d') {
    try {
      const user = await User.findOne({ walletAddress }).lean();
      if (!user) {
        throw new Error(`User ${walletAddress} not found`);
      }

      // This would fetch actual trading data from the database
      // For now, returning a template structure
      return {
        walletAddress,
        timeframe,
        mobileTradesCount: 0,
        desktopTradesCount: 0,
        totalMobileVolume: 0,
        totalDesktopVolume: 0,
        mobileWinRate: 0,
        desktopWinRate: 0,
        averageMobileTradeSize: 0,
        averageDesktopTradeSize: 0,
        preferredTradingTime: 'evening', // Most trading happens in evening
        preferredTradingMarket: null,
        deviceBreakdown: {
          ios: 0,
          android: 0,
          other: 0
        },
        mostUsedFeature: 'quick-trade-panel'
      };
    } catch (error) {
      logger.error('Error getting mobile trading analytics:', error);
      throw error;
    }
  }

  // Private helper methods

  static _getDefaultPreferences() {
    return {
      enabled: false,
      quickTradePanel: true,
      optimizedCharts: true,
      gestureEnabled: true,
      oneClickTrading: false,
      defaultOrderSize: 100,
      defaultSlippageMobile: 0.02
    };
  }

  static _validateMobileTradeWarnings(tradeData, userPreferences) {
    const warnings = [];

    if (!userPreferences.oneClickTrading && !tradeData.confirmedByUser) {
      warnings.push('Trade must be confirmed by user');
    }

    if (tradeData.slippage > (userPreferences.defaultSlippageMobile || 0.02)) {
      warnings.push(`Slippage (${(tradeData.slippage * 100).toFixed(2)}%) exceeds default (${(userPreferences.defaultSlippageMobile * 100).toFixed(2)}%)`);
    }

    return warnings;
  }
}

module.exports = MobileTradingService;
