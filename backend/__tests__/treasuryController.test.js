const request = require('supertest');
const mongoose = require('mongoose');
const { TreasuryTransaction, Market, LiquidityPosition, Position, Trade } = require('../src/models');
const treasuryController = require('../src/controllers/treasuryController');

describe('Treasury Controller', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oryn-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await TreasuryTransaction.deleteMany({});
    await Market.deleteMany({});
    await LiquidityPosition.deleteMany({});
    await Position.deleteMany({});
    await Trade.deleteMany({});
  });

  describe('getTVL', () => {
    it('should calculate TVL from markets, liquidity, and positions', async () => {
      // Create test data
      await Market.create([
        { marketId: 'market-1', status: 'active', totalVolume: 100000, totalTrades: 50 },
        { marketId: 'market-2', status: 'active', totalVolume: 200000, totalTrades: 100 }
      ]);

      await LiquidityPosition.create([
        { poolAddress: 'pool-1', status: 'active', totalLiquidity: 50000 },
        { poolAddress: 'pool-2', status: 'active', totalLiquidity: 75000 }
      ]);

      await Position.create([
        { marketId: 'market-1', userWalletAddress: 'GABC123', totalInvested: 25000 },
        { marketId: 'market-2', userWalletAddress: 'GDEF456', totalInvested: 35000 }
      ]);

      const mockReq = {};
      const mockRes = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis()
      };

      await treasuryController.getTVL(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalTVL: expect.any(Number),
          breakdown: expect.objectContaining({
            markets: expect.any(Object),
            liquidity: expect.any(Object),
            positions: expect.any(Object)
          })
        })
      });

      const responseData = mockRes.json.mock.calls[0][0].data;
      expect(responseData.totalTVL).toBe(485000); // 300000 + 125000 + 60000
    });

    it('should return zero TVL when no data exists', async () => {
      const mockReq = {};
      const mockRes = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis()
      };

      await treasuryController.getTVL(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalTVL: 0
        })
      });
    });
  });

  describe('getAssetAllocation', () => {
    it('should calculate treasury asset allocation', async () => {
      await TreasuryTransaction.create([
        {
          transactionId: 'tx-1',
          type: 'fee_inflow',
          asset: 'USDC',
          amount: 10000,
          status: 'completed'
        },
        {
          transactionId: 'tx-2',
          type: 'fee_inflow',
          asset: 'XLM',
          amount: 5000,
          status: 'completed'
        },
        {
          transactionId: 'tx-3',
          type: 'distribution_outflow',
          asset: 'USDC',
          amount: 2000,
          status: 'completed'
        }
      ]);

      await Market.create([
        { marketId: 'market-1', status: 'active', category: 'crypto', totalVolume: 50000 },
        { marketId: 'market-2', status: 'active', category: 'sports', totalVolume: 30000 }
      ]);

      const mockReq = {};
      const mockRes = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis()
      };

      await treasuryController.getAssetAllocation(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          treasury: expect.any(Array),
          markets: expect.any(Array),
          totalTreasuryBalance: expect.any(Number)
        })
      });

      const responseData = mockRes.json.mock.calls[0][0].data;
      expect(responseData.treasury).toHaveLength(2);
      expect(responseData.totalTreasuryBalance).toBe(13000); // 10000 + 5000 - 2000
    });
  });

  describe('getActivePositions', () => {
    it('should return active positions', async () => {
      await Position.create([
        {
          marketId: 'market-1',
          userWalletAddress: 'GABC123',
          totalInvested: 10000,
          yesTokens: 5000,
          noTokens: 2000,
          lastUpdated: new Date()
        }
      ]);

      await LiquidityPosition.create([
        {
          poolAddress: 'pool-1',
          status: 'active',
          totalLiquidity: 25000,
          tokenA: 'USDC',
          tokenB: 'XLM'
        }
      ]);

      await Trade.create([
        {
          tradeId: 'trade-1',
          marketId: 'market-1',
          userWalletAddress: 'GABC123',
          status: 'confirmed',
          totalCost: 100,
          timestamp: new Date()
        }
      ]);

      const mockReq = { query: { limit: 10 } };
      const mockRes = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis()
      };

      await treasuryController.getActivePositions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          userPositions: expect.any(Object),
          liquidityPositions: expect.any(Object),
          recentActivity: expect.any(Array)
        })
      });
    });
  });

  describe('getYieldStatistics', () => {
    it('should calculate yield statistics', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await TreasuryTransaction.create([
        {
          transactionId: 'tx-1',
          type: 'fee_inflow',
          asset: 'USDC',
          amount: 1000,
          source: 'trading_fees',
          status: 'completed',
          createdAt: yesterday
        },
        {
          transactionId: 'tx-2',
          type: 'fee_inflow',
          asset: 'USDC',
          amount: 500,
          source: 'liquidity_fees',
          status: 'completed',
          createdAt: yesterday
        }
      ]);

      const mockReq = {};
      const mockRes = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis()
      };

      await treasuryController.getYieldStatistics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          yield: expect.objectContaining({
            last24h: expect.any(Number),
            last7d: expect.any(Number),
            last30d: expect.any(Number),
            apy: expect.any(Number)
          }),
          yieldBySource: expect.any(Array),
          transactionCounts: expect.any(Object)
        })
      });
    });
  });

  describe('getRiskMetrics', () => {
    it('should calculate risk metrics', async () => {
      await Market.create([
        { marketId: 'market-1', status: 'active', totalVolume: 100000 },
        { marketId: 'market-2', status: 'active', totalVolume: 50000 }
      ]);

      await LiquidityPosition.create([
        { poolAddress: 'pool-1', status: 'active', totalLiquidity: 30000 },
        { poolAddress: 'pool-2', status: 'active', totalLiquidity: 20000 }
      ]);

      await Position.create([
        { marketId: 'market-1', userWalletAddress: 'GABC123', totalInvested: 10000 },
        { marketId: 'market-1', userWalletAddress: 'GDEF456', totalInvested: 5000 }
      ]);

      await Trade.create([
        {
          tradeId: 'trade-1',
          marketId: 'market-1',
          userWalletAddress: 'GABC123',
          status: 'confirmed',
          totalCost: 100,
          timestamp: new Date()
        }
      ]);

      const mockReq = {};
      const mockRes = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis()
      };

      await treasuryController.getRiskMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          overallRiskScore: expect.any(Number),
          riskBreakdown: expect.objectContaining({
            market: expect.any(Object),
            liquidity: expect.any(Object),
            concentration: expect.any(Object),
            volatility: expect.any(Object)
          })
        })
      });

      const responseData = mockRes.json.mock.calls[0][0].data;
      expect(responseData.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(responseData.overallRiskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('getDashboardData', () => {
    it('should return comprehensive dashboard data', async () => {
      await TreasuryTransaction.create([
        {
          transactionId: 'tx-1',
          type: 'fee_inflow',
          asset: 'USDC',
          amount: 10000,
          status: 'completed'
        }
      ]);

      await Market.create([
        { marketId: 'market-1', status: 'active', totalVolume: 50000, totalTrades: 25 }
      ]);

      const mockReq = {};
      const mockRes = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis()
      };

      await treasuryController.getDashboardData(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          overview: expect.any(Object),
          tvl: expect.any(Object),
          allocation: expect.any(Object),
          positions: expect.any(Object),
          yield: expect.any(Object),
          risk: expect.any(Object),
          lastUpdated: expect.any(String)
        })
      });
    });
  });
});
