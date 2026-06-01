import { useMemo } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Droplets, Radio, UserCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MarketIntegrityScoreProps {
  liquidity: number;
  volume: number;
  resolutionSource: string;
  creatorTrustScore?: number;   // 0-1000, from CreatorReputation
  creatorVerified?: boolean;
  compact?: boolean;
}

interface SubScore {
  label: string;
  value: number;      // 0-100
  weight: number;     // fraction of total
  description: string;
  color: string;
  icon: React.ReactNode;
}

// ── Scoring helpers ────────────────────────────────────────────────────────────

const ORACLE_TIER: Record<string, { score: number; label: string }> = {
  // Tier 1 – on-chain / authoritative APIs
  coingecko:          { score: 95, label: 'CoinGecko API' },
  coinmarketcap:      { score: 93, label: 'CoinMarketCap' },
  chainlink:          { score: 98, label: 'Chainlink Oracle' },
  pyth:               { score: 97, label: 'Pyth Network' },
  // Tier 2 – reputable news / official bodies
  reuters:            { score: 88, label: 'Reuters' },
  'ap news':          { score: 87, label: 'AP News' },
  'bbc news':         { score: 86, label: 'BBC News' },
  'federal reserve':  { score: 92, label: 'Federal Reserve' },
  sec:                { score: 91, label: 'SEC' },
  fdic:               { score: 90, label: 'FDIC' },
  nfl:                { score: 89, label: 'NFL Official' },
  nba:                { score: 89, label: 'NBA Official' },
  fifa:               { score: 89, label: 'FIFA Official' },
  espn:               { score: 82, label: 'ESPN' },
  olympic:            { score: 90, label: 'Olympic Committee' },
  academy:            { score: 85, label: 'Academy Awards' },
  apple:              { score: 84, label: 'Apple Official' },
  github:             { score: 80, label: 'GitHub' },
  // Tier 3 – social / unverified
  twitter:            { score: 45, label: 'Twitter/X' },
  reddit:             { score: 35, label: 'Reddit' },
};

function scoreOracle(source: string): { score: number; tier: 1 | 2 | 3; matchedLabel: string } {
  const lower = source.toLowerCase();
  for (const [key, val] of Object.entries(ORACLE_TIER)) {
    if (lower.includes(key)) {
      const tier: 1 | 2 | 3 = val.score >= 90 ? 1 : val.score >= 80 ? 2 : 3;
      return { score: val.score, tier, matchedLabel: val.label };
    }
  }
  // Unknown source — moderate penalty
  return { score: 50, tier: 3, matchedLabel: 'Unverified source' };
}

function scoreLiquidity(liquidity: number): number {
  // Logarithmic scale: $10k = ~50, $100k = ~75, $1M = ~95
  if (liquidity <= 0) return 0;
  const score = (Math.log10(liquidity) / Math.log10(2_000_000)) * 100;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreCreator(trustScore: number, verified: boolean): number {
  const base = Math.min(100, Math.round((trustScore / 1000) * 100));
  return verified ? Math.min(100, base + 10) : base;
}

function integrityColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#16a34a';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function integrityLabel(score: number): string {
  if (score >= 80) return 'High Integrity';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Low';
  return 'Poor';
}

function integrityIcon(score: number) {
  if (score >= 60) return ShieldCheck;
  if (score >= 30) return ShieldAlert;
  return ShieldX;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketIntegrityScore({
  liquidity,
  volume,
  resolutionSource,
  creatorTrustScore = 500,
  creatorVerified = false,
  compact = false,
}: MarketIntegrityScoreProps) {

  const { overall, subScores, oracle } = useMemo(() => {
    const liq = scoreLiquidity(liquidity);
    const oracleResult = scoreOracle(resolutionSource);
    const creator = scoreCreator(creatorTrustScore, creatorVerified);

    const subScores: SubScore[] = [
      {
        label: 'Liquidity',
        value: liq,
        weight: 0.35,
        description: `$${liquidity >= 1000 ? (liquidity / 1000).toFixed(0) + 'K' : liquidity} in pool`,
        color: integrityColor(liq),
        icon: <Droplets className="w-3.5 h-3.5" />,
      },
      {
        label: 'Oracle Quality',
        value: oracleResult.score,
        weight: 0.40,
        description: oracleResult.matchedLabel,
        color: integrityColor(oracleResult.score),
        icon: <Radio className="w-3.5 h-3.5" />,
      },
      {
        label: 'Creator Rep.',
        value: creator,
        weight: 0.25,
        description: creatorVerified ? 'Verified creator' : `Trust score ${creatorTrustScore}`,
        color: integrityColor(creator),
        icon: <UserCheck className="w-3.5 h-3.5" />,
      },
    ];

    const overall = Math.round(
      subScores.reduce((sum, s) => sum + s.value * s.weight, 0)
    );

    return { overall, subScores, oracle: oracleResult };
  }, [liquidity, resolutionSource, creatorTrustScore, creatorVerified]);

  const color = integrityColor(overall);
  const label = integrityLabel(overall);
  const Icon = integrityIcon(overall);

  // ── Compact badge ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold"
        style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
        title={`Market Integrity: ${overall}/100 — ${label}`}
      >
        <Icon className="w-3 h-3" />
        <span>{overall}</span>
        <span className="font-normal opacity-70">{label}</span>
      </div>
    );
  }

  // ── Full card ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className="text-sm font-semibold">Market Integrity</span>
          <div className="group relative">
            <Info className="w-3.5 h-3.5 text-white/30 cursor-help" />
            <div className="absolute left-0 bottom-5 hidden group-hover:block w-56 text-[10px] text-white/70 bg-black/80 border border-white/10 rounded-lg p-2 z-10 leading-relaxed">
              Composite score based on liquidity depth (35%), oracle source quality (40%), and creator reputation (25%).
            </div>
          </div>
        </div>
        <div
          className="text-2xl font-black tabular-nums"
          style={{ color }}
        >
          {overall}<span className="text-sm font-normal text-white/30">/100</span>
        </div>
      </div>

      {/* Overall bar */}
      <div className="space-y-1.5">
        <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${overall}%`,
              background: `linear-gradient(90deg, ${color}80, ${color})`,
              boxShadow: `0 0 10px ${color}40`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/30">
          <span>Poor</span>
          <span
            className="font-bold px-2 py-0.5 rounded-full"
            style={{ color, backgroundColor: `${color}15` }}
          >
            {label}
          </span>
          <span>High Integrity</span>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="space-y-3 pt-1">
        {subScores.map((s) => (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5" style={{ color: s.color }}>
                {s.icon}
                <span className="font-semibold">{s.label}</span>
                <span className="text-white/30 font-normal">— {s.description}</span>
              </div>
              <span className="font-bold tabular-nums" style={{ color: s.color }}>
                {s.value}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${s.value}%`,
                  backgroundColor: s.color,
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Oracle warning */}
      {oracle.tier === 3 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Resolution source could not be verified as a trusted oracle. Trade with caution.
          </span>
        </div>
      )}
    </div>
  );
}
