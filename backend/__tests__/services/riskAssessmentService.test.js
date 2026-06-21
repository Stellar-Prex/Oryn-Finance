const { RiskAssessmentService, defaultService } = require('../../src/services/riskAssessmentService');

describe('RiskAssessmentService', () => {
  describe('Configuration', () => {
    test('should initialize with default config', () => {
      const service = new RiskAssessmentService();
      const config = service.getConfig();

      expect(config.weights).toBeDefined();
      expect(config.thresholds).toBeDefined();
      expect(Object.values(config.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 3);
    });

    test('should merge custom config with defaults', () => {
      const service = new RiskAssessmentService({
        weights: { tvlStability: 0.50, poolAge: 0.50 },
      });
      const config = service.getConfig();

      expect(config.weights.tvlStability).toBe(0.50);
      expect(config.weights.poolAge).toBe(0.50);
    });

    test('should throw if weights do not sum to 1.0', () => {
      expect(() => {
        new RiskAssessmentService({
          weights: { tvlStability: 0.5, poolAge: 0.3 },
        });
      }).toThrow('Risk assessment weights must sum to 1.0');
    });

    test('should update config at runtime', () => {
      const service = new RiskAssessmentService();
      service.updateConfig({ thresholds: { low: 25, medium: 60 } });

      expect(service.getConfig().thresholds.low).toBe(25);
      expect(service.getConfig().thresholds.medium).toBe(60);
    });
  });

  describe('Deterministic Scoring', () => {
    test('should produce identical scores for identical inputs', () => {
      const pool = {
        poolId: 'pool-1',
        tvlUsd: 5_000_000,
        ageDays: 200,
        apyCurrent: 1500,
        audited: true,
        auditCount: 2,
        liquidityUsd: 2_000_000,
        protocolReputationScore: 85,
      };

      const service1 = new RiskAssessmentService();
      const service2 = new RiskAssessmentService();

      const result1 = service1.assessPool(pool);
      const result2 = service2.assessPool(pool);

      expect(result1.score).toBe(result2.score);
      expect(result1.category).toBe(result2.category);
      expect(result1.factorScores).toEqual(result2.factorScores);
    });

    test('should produce different scores for different configs with same inputs', () => {
      const pool = {
        poolId: 'pool-1',
        tvlUsd: 500_000,
        ageDays: 30,
        apyCurrent: 5000,
        audited: false,
        liquidityUsd: 100_000,
        protocolReputationScore: 50,
      };

      const strictService = new RiskAssessmentService({
        weights: { tvlStability: 0.40, poolAge: 0.10, apyStability: 0.20, auditStatus: 0.10, liquidityDepth: 0.10, protocolReputation: 0.10 },
      });

      const lenientService = new RiskAssessmentService({
        weights: { tvlStability: 0.10, poolAge: 0.10, apyStability: 0.10, auditStatus: 0.10, liquidityDepth: 0.10, protocolReputation: 0.50 },
      });

      const strictResult = strictService.assessPool(pool);
      const lenientResult = lenientService.assessPool(pool);

      expect(strictResult.score).not.toBe(lenientResult.score);
    });
  });

  describe('Risk Categories', () => {
    test('should categorize low risk correctly', () => {
      const pool = {
        poolId: 'low-risk',
        tvlUsd: 20_000_000,
        ageDays: 500,
        apyCurrent: 500,
        audited: true,
        auditCount: 3,
        lastAuditDate: new Date().toISOString(),
        liquidityUsd: 12_000_000,
        protocolReputationScore: 95,
      };

      const result = defaultService.assessPool(pool);
      expect(result.category).toBe('Low');
      expect(result.score).toBeLessThanOrEqual(33);
    });

    test('should categorize high risk correctly', () => {
      const pool = {
        poolId: 'high-risk',
        tvlUsd: 10_000,
        ageDays: 5,
        apyCurrent: 2_000_000,
        audited: false,
        liquidityUsd: 1_000,
        protocolReputationScore: 20,
      };

      const result = defaultService.assessPool(pool);
      expect(result.category).toBe('High');
      expect(result.score).toBeGreaterThan(66);
    });

    test('should categorize medium risk correctly', () => {
      const pool = {
        poolId: 'medium-risk',
        tvlUsd: 500_000,
        ageDays: 90,
        apyCurrent: 2000,
        audited: true,
        auditCount: 1,
        liquidityUsd: 150_000,
        protocolReputationScore: 60,
      };

      const result = defaultService.assessPool(pool);
      expect(result.category).toBe('Medium');
      expect(result.score).toBeGreaterThan(33);
      expect(result.score).toBeLessThanOrEqual(66);
    });
  });

  describe('Invalid Data Handling', () => {
    test('should handle null pool gracefully', () => {
      const result = defaultService.assessPool(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid pool data');
    });

    test('should handle undefined pool gracefully', () => {
      const result = defaultService.assessPool(undefined);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid pool data');
    });

    test('should handle non-object pool gracefully', () => {
      const result = defaultService.assessPool('string');
      expect(result.success).toBe(false);
    });

    test('should handle missing optional fields with neutral scores', () => {
      const pool = { poolId: 'minimal' };
      const result = defaultService.assessPool(pool);

      expect(result.success).toBe(true);
      expect(result.score).toBeDefined();
      expect(result.factorScores.tvlStability).toBe(50);
      expect(result.factorScores.poolAge).toBe(50);
      expect(result.factorScores.protocolReputation).toBe(50);
    });

    test('should handle string numbers correctly', () => {
      const pool = {
        poolId: 'str-numbers',
        tvlUsd: '5000000',
        ageDays: '200',
        apyCurrent: '1500',
        liquidityUsd: '2000000',
        protocolReputationScore: '85',
      };

      const result = defaultService.assessPool(pool);
      expect(result.success).toBe(true);
      expect(result.score).toBeDefined();
    });

    test('should handle negative APY gracefully', () => {
      const pool = {
        poolId: 'neg-apy',
        apyCurrent: -50,
      };

      const result = defaultService.assessPool(pool);
      expect(result.success).toBe(true);
      expect(result.factorScores.apyStability).toBe(80);
    });

    test('should handle zero TVL gracefully', () => {
      const pool = {
        poolId: 'zero-tvl',
        tvlUsd: 0,
      };

      const result = defaultService.assessPool(pool);
      expect(result.success).toBe(true);
      expect(result.factorScores.tvlStability).toBe(100);
    });
  });

  describe('Factor Scoring', () => {
    describe('TVL Scoring', () => {
      test('excellent TVL returns 0', () => {
        const service = new RiskAssessmentService();
        expect(service.scoreTvl(20_000_000)).toBe(0);
      });

      test('good TVL returns 25', () => {
        expect(defaultService.scoreTvl(5_000_000)).toBe(25);
      });

      test('minimum TVL returns 50', () => {
        expect(defaultService.scoreTvl(500_000)).toBe(50);
      });

      test('low TVL returns 75', () => {
        expect(defaultService.scoreTvl(50_000)).toBe(75);
      });

      test('zero TVL returns 100', () => {
        expect(defaultService.scoreTvl(0)).toBe(100);
      });
    });

    describe('Age Scoring', () => {
      test('excellent age returns 0', () => {
        expect(defaultService.scoreAge(500)).toBe(0);
      });

      test('good age returns 25', () => {
        expect(defaultService.scoreAge(200)).toBe(25);
      });

      test('minimum age returns 50', () => {
        expect(defaultService.scoreAge(60)).toBe(50);
      });

      test('very new pool returns 75', () => {
        expect(defaultService.scoreAge(15)).toBe(75);
      });
    });

    describe('APY Stability Scoring', () => {
      test('stable history returns low score', () => {
        const history = [1000, 1020, 1010, 1030, 1015];
        expect(defaultService.scoreApyStability(null, history)).toBe(0);
      });

      test('volatile history returns high score', () => {
        const history = [100, 5000, 200, 8000, 50];
        const score = defaultService.scoreApyStability(null, history);
        expect(score).toBeGreaterThan(50);
      });

      test('extremely high APY without history returns high score', () => {
        expect(defaultService.scoreApyStability(2_000_000)).toBe(100);
      });

      test('moderate APY without history returns moderate score', () => {
        expect(defaultService.scoreApyStability(1500)).toBe(60);
      });

      test('invalid history falls back gracefully', () => {
        expect(defaultService.scoreApyStability(null, [])).toBe(50);
        expect(defaultService.scoreApyStability(null, [100])).toBe(50);
      });
    });

    describe('Audit Scoring', () => {
      test('no audit returns 100', () => {
        expect(defaultService.scoreAudit(false, 0)).toBe(100);
      });

      test('single audit returns 40', () => {
        expect(defaultService.scoreAudit(true, 1)).toBe(40);
      });

      test('two audits returns 20', () => {
        expect(defaultService.scoreAudit(true, 2)).toBe(20);
      });

      test('three recent audits returns 0', () => {
        expect(defaultService.scoreAudit(true, 3, new Date().toISOString())).toBe(0);
      });

      test('stale audit returns higher score', () => {
        const oldDate = new Date('2020-01-01').toISOString();
        expect(defaultService.scoreAudit(true, 3, oldDate)).toBe(35);
      });
    });

    describe('Liquidity Scoring', () => {
      test('excellent liquidity ratio returns 0', () => {
        expect(defaultService.scoreLiquidity(6_000_000, 10_000_000)).toBe(0);
      });

      test('good liquidity ratio returns 25', () => {
        expect(defaultService.scoreLiquidity(3_000_000, 10_000_000)).toBe(25);
      });

      test('missing tvl returns neutral', () => {
        expect(defaultService.scoreLiquidity(100_000, null)).toBe(50);
      });

      test('zero tvl returns neutral', () => {
        expect(defaultService.scoreLiquidity(100_000, 0)).toBe(50);
      });
    });

    describe('Reputation Scoring', () => {
      test('excellent reputation returns 0', () => {
        expect(defaultService.scoreReputation(95)).toBe(0);
      });

      test('good reputation returns 25', () => {
        expect(defaultService.scoreReputation(75)).toBe(25);
      });

      test('minimum reputation returns 50', () => {
        expect(defaultService.scoreReputation(50)).toBe(50);
      });

      test('low reputation returns 75', () => {
        expect(defaultService.scoreReputation(20)).toBe(75);
      });
    });
  });

  describe('Batch Assessment', () => {
    test('should assess multiple pools', () => {
      const pools = [
        {
          poolId: 'a',
          tvlUsd: 20_000_000,
          ageDays: 500,
          apyCurrent: 500,
          audited: true,
          auditCount: 3,
          lastAuditDate: new Date().toISOString(),
          liquidityUsd: 12_000_000,
          protocolReputationScore: 95,
        },
        {
          poolId: 'b',
          tvlUsd: 10_000,
          ageDays: 5,
          apyCurrent: 2_000_000,
          audited: false,
          liquidityUsd: 1_000,
          protocolReputationScore: 20,
        },
        {
          poolId: 'c',
          tvlUsd: 500_000,
          ageDays: 90,
          apyCurrent: 2000,
          audited: true,
          auditCount: 1,
          liquidityUsd: 150_000,
          protocolReputationScore: 60,
        },
      ];

      const result = defaultService.assessPools(pools);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.summary.total).toBe(3);
      expect(result.summary.assessed).toBe(3);
      expect(result.summary.lowRisk).toBe(1);
      expect(result.summary.highRisk).toBe(1);
      expect(result.summary.mediumRisk).toBe(1);
      expect(result.summary.averageScore).toBeDefined();
    });

    test('should handle empty array', () => {
      const result = defaultService.assessPools([]);
      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(0);
    });

    test('should handle non-array input gracefully', () => {
      const result = defaultService.assessPools('not-an-array');
      expect(result.success).toBe(false);
      expect(result.error).toContain('array');
    });

    test('should count failed assessments', () => {
      const pools = [
        { poolId: 'valid', tvlUsd: 1_000_000 },
        null,
        undefined,
      ];

      const result = defaultService.assessPools(pools);
      expect(result.summary.assessed).toBe(1);
      expect(result.summary.failed).toBe(2);
    });
  });

  describe('Score Bounds', () => {
    test('should never return score below 0', () => {
      const perfectPool = {
        tvlUsd: Infinity,
        ageDays: Infinity,
        apyCurrent: 1,
        audited: true,
        auditCount: 100,
        liquidityUsd: Infinity,
        protocolReputationScore: 100,
      };

      const result = defaultService.assessPool(perfectPool);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test('should never return score above 100', () => {
      const terriblePool = {
        tvlUsd: -1,
        ageDays: -1,
        apyCurrent: Infinity,
        audited: false,
        liquidityUsd: -1,
        protocolReputationScore: -1,
      };

      const result = defaultService.assessPool(terriblePool);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
