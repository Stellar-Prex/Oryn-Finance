# Risk Assessment Framework for Yield Pools

**Issue:** #187  
**Status:** Implemented  
**Components:** Service, Controller, Routes, Tests, Documentation

---

## Overview

The Risk Assessment Framework provides a deterministic, configurable scoring engine that assigns risk levels to yield pool investment opportunities based on protocol metrics. It evaluates pools across six weighted risk factors and categorizes them into Low, Medium, or High risk tiers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Endpoints                             │
│  POST /api/risk-assessment/pools                             │
│  POST /api/risk-assessment/pool/:poolId                      │
│  GET  /api/risk-assessment/config                            │
│  PUT  /api/risk-assessment/config                            │
│  GET  /api/risk-assessment/categories                        │
│  POST /api/risk-assessment/simulate                          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              RiskAssessmentController                        │
│         (validation, orchestration, response)                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              RiskAssessmentService                           │
│    (configurable scoring engine, deterministic logic)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Risk Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| **TVL Stability** | 20% | Total Value Locked — higher TVL indicates lower risk |
| **Pool Age** | 15% | Time since launch — older pools have proven track records |
| **APY Stability** | 20% | Yield volatility — stable APY indicates sustainable economics |
| **Audit Status** | 15% | Number and recency of security audits |
| **Liquidity Depth** | 15% | Ratio of liquid assets to total TVL |
| **Protocol Reputation** | 15% | External reputation score (0-100) |

### Thresholds

| Category | Score Range | Color |
|----------|-------------|-------|
| **Low** | 0 – 33 | Green (#22c55e) |
| **Medium** | 34 – 66 | Amber (#f59e0b) |
| **High** | 67 – 100 | Red (#ef4444) |

---

## API Reference

### Assess Pools (Single or Batch)

```http
POST /api/risk-assessment/pools
```

**Request Body:**

```json
{
  "pools": [
    {
      "poolId": "pool-001",
      "tvlUsd": 5000000,
      "ageDays": 200,
      "apyCurrent": 1500,
      "apyHistory": [1400, 1500, 1550, 1480, 1520],
      "audited": true,
      "auditCount": 2,
      "lastAuditDate": "2024-06-01T00:00:00Z",
      "liquidityUsd": 2000000,
      "protocolReputationScore": 85
    }
  ],
  "config": {
    "weights": {
      "tvlStability": 0.25,
      "poolAge": 0.15,
      "apyStability": 0.20,
      "auditStatus": 0.15,
      "liquidityDepth": 0.15,
      "protocolReputation": 0.10
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 1,
      "assessed": 1,
      "failed": 0,
      "lowRisk": 1,
      "mediumRisk": 0,
      "highRisk": 0,
      "averageScore": 18
    },
    "results": [
      {
        "success": true,
        "poolId": "pool-001",
        "score": 18,
        "category": "Low",
        "factorScores": {
          "tvlStability": 25,
          "poolAge": 25,
          "apyStability": 0,
          "auditStatus": 20,
          "liquidityDepth": 0,
          "protocolReputation": 0
        },
        "error": null
      }
    ]
  }
}
```

### Assess Pool by ID

```http
POST /api/risk-assessment/pool/:poolId
```

**Request Body:** Pool metrics (same shape as pool object above, minus `poolId`).

### Get Configuration

```http
GET /api/risk-assessment/config
```

Returns the current default scoring configuration.

### Update Configuration

```http
PUT /api/risk-assessment/config
```

**Request Body:** Partial or full configuration object. Weights must sum to `1.0`.

### Get Risk Categories

```http
GET /api/risk-assessment/categories
```

Returns category definitions, thresholds, and display colors.

### Simulate Scores

```http
POST /api/risk-assessment/simulate
```

Same as `/pools` but limited to 50 pools and returns the configuration used alongside results. Ideal for testing scoring models without affecting defaults.

---

## Scoring Logic

### Individual Factor Scores

Each factor returns a value from **0** (safest) to **100** (riskiest).

#### TVL Stability

| TVL | Score |
|-----|-------|
| ≥ $10M | 0 |
| ≥ $1M | 25 |
| ≥ $100K | 50 |
| > $0 | 75 |
| $0 | 100 |

#### Pool Age

| Age | Score |
|-----|-------|
| ≥ 365 days | 0 |
| ≥ 180 days | 25 |
| ≥ 30 days | 50 |
| > 0 days | 75 |
| 0 days | 100 |

#### APY Stability

If `apyHistory` is provided (≥ 2 data points), the coefficient of variation (CV) is calculated:

| CV | Score |
|----|-------|
| ≤ 5% | 0 |
| ≤ 15% | 25 |
| ≤ 50% | 50 |
| > 50% | 100 |

If no history is available, the current APY is used as a heuristic:

| APY | Score |
|-----|-------|
| < 1,000% | 30 |
| 1,000% – 10,000% | 60 |
| 10,000% – 100,000% | 75 |
| 100,000% – 1,000,000% | 90 |
| > 1,000,000% | 100 |
| Negative | 80 |

#### Audit Status

| Audits | Score |
|--------|-------|
| 0 | 100 |
| 1 | 40 |
| 2 | 20 |
| 3+ (recent) | 0 |
| 3+ (stale > 1yr) | 35 |

#### Liquidity Depth

Calculated as `liquidityUsd / tvlUsd`:

| Ratio | Score |
|-------|-------|
| ≥ 50% | 0 |
| ≥ 25% | 25 |
| ≥ 10% | 50 |
| < 10% | 75 |

#### Protocol Reputation

| Score | Risk Score |
|-------|------------|
| ≥ 90 | 0 |
| ≥ 70 | 25 |
| ≥ 40 | 50 |
| > 0 | 75 |
| ≤ 0 | 100 |

### Composite Score

```
Composite = Σ(factorScore × weight)
```

The composite score is rounded to the nearest integer and clamped to `[0, 100]`.

---

## Configuration

The scoring model is fully configurable. Example custom configuration:

```json
{
  "weights": {
    "tvlStability": 0.30,
    "poolAge": 0.10,
    "apyStability": 0.25,
    "auditStatus": 0.15,
    "liquidityDepth": 0.10,
    "protocolReputation": 0.10
  },
  "thresholds": {
    "low": 25,
    "medium": 60
  },
  "tvl": {
    "excellent": 50000000,
    "good": 10000000,
    "minimum": 1000000
  }
}
```

**Constraints:**
- All `weights` values must sum to `1.0` (±0.001).
- Partial configurations are merged with defaults.

---

## Graceful Degradation

The framework handles invalid or missing data safely:

| Scenario | Behavior |
|----------|----------|
| `null` / `undefined` pool | Returns `success: false` with error message |
| Non-object pool | Returns `success: false` |
| Missing optional fields | Neutral score of **50** for that factor |
| String numbers | Parsed automatically |
| Zero TVL | Maximum risk score (100) for TVL factor |
| Negative APY | Elevated risk score (80) |
| Invalid APY history | Falls back to current APY heuristic or neutral |

---

## Determinism

Given identical inputs and configuration, the engine always produces identical scores. This is guaranteed by:

- Pure functions for factor scoring
- No external state or randomness
- Consistent parsing of inputs
- Reproducible mathematical operations

---

## Testing

Run the test suite:

```bash
npm test -- __tests__/services/riskAssessmentService.test.js
npm test -- __tests__/controllers/riskAssessmentController.test.js
```

Coverage includes:
- Configuration validation and merging
- Deterministic scoring verification
- Risk category boundary testing
- Invalid data handling
- Individual factor score logic
- Batch assessment aggregation
- Score bounds (0–100)
- Controller endpoint validation
- Custom configuration simulation

---

## Files Added/Modified

| File | Purpose |
|------|---------|
| `src/services/riskAssessmentService.js` | Core scoring engine |
| `src/controllers/riskAssessmentController.js` | HTTP request handlers |
| `src/routes/riskAssessment.js` | Route definitions |
| `server.js` | Route registration (`/api/risk-assessment`) |
| `__tests__/services/riskAssessmentService.test.js` | Service unit tests |
| `__tests__/controllers/riskAssessmentController.test.js` | Controller integration tests |
| `RISK_ASSESSMENT_FRAMEWORK.md` | This documentation |

---

## Future Enhancements

- **On-chain data ingestion** — auto-populate metrics from Stellar/Soroban contracts
- **Historical score tracking** — time-series analysis of pool risk trajectories
- **Machine learning layer** — train weights based on actual pool outcomes
- **Insurance integration** — factor in coverage from the insurance module
- **Real-time alerts** — WebSocket notifications when a pool's risk category changes
