import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BarChart2, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { MagicCard } from '@/components/magicui/magic-card';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/apiService';

type Timeframe = '24h' | '7d' | '30d' | '1y';

interface PerformanceSeries {
  date: string;
  totalCost: number;
  tradeCount: number;
  avgPrice: number;
  totalFees: number;
}

interface AllocationItem {
  tokenType: string;
  totalCost: number;
  tradeCount: number;
  percentage: number;
}

interface YieldData {
  totalInvested: number;
  totalReturns: number;
  realizedPnL: number;
  roi: number;
  fees: { total: number; platform: number; stellar: number };
  tradeCounts: { buys: number; sells: number };
  timeframe: string;
}

interface GrowthData {
  last7Days:    { volume: number; trades: number };
  last30Days:   { volume: number; trades: number };
  allTime:      { volume: number; trades: number; since: string | null };
  weekOverWeek: number;
}

const ALLOC_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444'];
const TIMEFRAMES: Timeframe[] = ['24h', '7d', '30d', '1y'];

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export default function PortfolioAnalytics({ walletAddress }: { walletAddress: string }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [series, setSeries]       = useState<PerformanceSeries[]>([]);
  const [allocation, setAllocation] = useState<AllocationItem[]>([]);
  const [yieldData, setYieldData] = useState<YieldData | null>(null);
  const [growth, setGrowth]       = useState<GrowthData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiService.get(`/portfolio/${walletAddress}/performance?timeframe=${timeframe}`),
      apiService.get(`/portfolio/${walletAddress}/allocation?timeframe=${timeframe}`),
      apiService.get(`/portfolio/${walletAddress}/yield?timeframe=${timeframe}`),
      apiService.get(`/portfolio/${walletAddress}/growth`),
    ])
      .then(([perf, alloc, yld, grw]) => {
        setSeries(perf.data?.series || []);
        setAllocation(alloc.data?.allocation || []);
        setYieldData(yld.data || null);
        setGrowth(grw.data || null);
      })
      .catch((err) => setError(err?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [walletAddress, timeframe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Loading performance analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive text-center py-8">{error}</div>
    );
  }

  if (!yieldData && series.length === 0 && allocation.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No analytics data yet. Start trading to see your performance.
      </div>
    );
  }

  const pnlPositive = (yieldData?.realizedPnL ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Timeframe picker */}
      <div className="flex gap-2 flex-wrap">
        {TIMEFRAMES.map((tf) => (
          <Button
            key={tf}
            size="sm"
            variant={timeframe === tf ? 'default' : 'outline'}
            onClick={() => setTimeframe(tf)}
          >
            {tf}
          </Button>
        ))}
      </div>

      {/* Metric cards */}
      {yieldData && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MagicCard className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Invested
            </div>
            <p className="text-lg font-semibold">{fmtUsd(yieldData.totalInvested)}</p>
          </MagicCard>
          <MagicCard className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Returns
            </div>
            <p className="text-lg font-semibold">{fmtUsd(yieldData.totalReturns)}</p>
          </MagicCard>
          <MagicCard className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              {pnlPositive
                ? <TrendingUp className="w-3 h-3 text-success" />
                : <TrendingDown className="w-3 h-3 text-destructive" />}
              Realized P&amp;L
            </div>
            <p className={`text-lg font-semibold ${pnlPositive ? 'text-success' : 'text-destructive'}`}>
              {fmtUsd(yieldData.realizedPnL)}
            </p>
          </MagicCard>
          <MagicCard className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <BarChart2 className="w-3 h-3" /> ROI
            </div>
            <p className={`text-lg font-semibold ${yieldData.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
              {fmtPct(yieldData.roi)}
            </p>
          </MagicCard>
        </div>
      )}
