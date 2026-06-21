import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownUp, BarChart3, RefreshCw, Search, ShieldAlert, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Layout } from '@/components/layout/Layout';
import { MagicCard } from '@/components/magicui/magic-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/apiService';

type SortKey = 'rank' | 'apy' | 'feeApy' | 'tvl' | 'volume24h' | 'utilizationPct' | 'riskScore';

interface YieldOpportunity {
  marketId: string;
  question: string;
  category: string;
  rank: number;
  apy: number;
  feeApy: number;
  incentiveApy: number;
  volume24h: number;
  tvl: number;
  utilizationPct: number;
  riskScore: number;
  rankScore: number;
}

interface YieldHistoryRecord {
  snapshotDate: string;
  apy: number;
  feeApy: number;
  incentiveApy: number;
  tvl: number;
}

const CATEGORIES = ['all', 'crypto', 'economics', 'technology', 'politics', 'sports', 'entertainment', 'other'];

const money = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

const pct = (value: number) => `${value.toFixed(2)}%`;

export default function YieldComparison() {
  const [opportunities, setOpportunities] = useState<YieldOpportunity[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<YieldHistoryRecord[]>([]);
  const [selected, setSelected] = useState<YieldOpportunity | null>(null);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('rank');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [minApy, setMinApy] = useState('');
  const [maxRisk, setMaxRisk] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.yield.getComparison({
        category,
        sort,
        direction,
        minApy: minApy ? Number(minApy) : undefined,
        maxRisk: maxRisk ? Number(maxRisk) : undefined,
      });
      setOpportunities(data.opportunities || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load yield opportunities');
    } finally {
      setLoading(false);
    }
  }, [category, direction, maxRisk, minApy, sort]);

  useEffect(() => { fetchComparison(); }, [fetchComparison]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!selected) {
        setHistory([]);
        return;
      }
      try {
        const data = await apiService.yield.getHistory(selected.marketId, 30);
        setHistory(data.records || []);
      } catch {
        setHistory([]);
      }
    };
    loadHistory();
  }, [selected]);

  const visible = useMemo(() => opportunities.filter((item) => (
    !search || item.question.toLowerCase().includes(search.toLowerCase())
  )), [opportunities, search]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDirection(key === 'rank' || key === 'riskScore' ? 'asc' : 'desc');
    }
  };

  const top = summary?.top;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
              <TrendingUp className="h-8 w-8 text-emerald-400" />
              Yield Comparison
            </h1>
            <p className="text-muted-foreground">Compare active yield opportunities by APY, risk, liquidity, and recent fee activity.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchComparison} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MagicCard className="glass-card p-5" gradientColor="#16332a">
            <p className="text-sm text-muted-foreground">Opportunities</p>
            <p className="mt-1 text-2xl font-bold">{summary?.count ?? 0}</p>
          </MagicCard>
          <MagicCard className="glass-card p-5" gradientColor="#16332a">
            <p className="text-sm text-muted-foreground">Average APY</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{summary ? pct(summary.avgApy) : '0.00%'}</p>
          </MagicCard>
          <MagicCard className="glass-card p-5" gradientColor="#16332a">
            <p className="text-sm text-muted-foreground">Tracked TVL</p>
            <p className="mt-1 text-2xl font-bold">{summary ? money(summary.totalTvl) : '$0.00'}</p>
          </MagicCard>
          <MagicCard className="glass-card p-5" gradientColor="#16332a">
            <p className="text-sm text-muted-foreground">Top Ranked</p>
            <p className="mt-1 truncate text-lg font-bold" title={top?.question}>{top?.question || 'No active market'}</p>
          </MagicCard>
        </div>

        <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative w-full xl:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search opportunities..." className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <Button key={item} size="sm" variant={category === item ? 'default' : 'outline'} onClick={() => setCategory(item)} className="capitalize">
                {item}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 xl:ml-auto">
            <Input className="h-9 w-28" inputMode="decimal" placeholder="Min APY" value={minApy} onChange={(event) => setMinApy(event.target.value)} />
            <Input className="h-9 w-28" inputMode="decimal" placeholder="Max risk" value={maxRisk} onChange={(event) => setMaxRisk(event.target.value)} />
          </div>
        </div>

        <MagicCard className="glass-card mb-8 overflow-hidden p-0" gradientColor="#16332a">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Rank</th>
                  <th className="px-4 py-3 text-left font-medium">Opportunity</th>
                  {[
                    ['apy', 'APY'],
                    ['feeApy', 'Fee APY'],
                    ['tvl', 'TVL'],
                    ['volume24h', '24h Volume'],
                    ['utilizationPct', 'Utilization'],
                    ['riskScore', 'Risk'],
                  ].map(([key, label]) => (
                    <th key={key} className="cursor-pointer px-4 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort(key as SortKey)}>
                      {label} <ArrowDownUp className="ml-1 inline h-3 w-3" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Loading yield comparison...</td></tr>}
                {!loading && visible.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No opportunities match these filters.</td></tr>}
                {!loading && visible.map((item) => (
                  <tr key={item.marketId} className="border-b border-border/20 transition-colors hover:bg-muted/10" onClick={() => setSelected(item)}>
                    <td className="px-4 py-3 font-bold text-emerald-400">#{item.rank}</td>
                    <td className="max-w-sm px-4 py-3">
                      <p className="truncate font-medium" title={item.question}>{item.question}</p>
                      <Badge variant="outline" className="mt-1 capitalize">{item.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">{pct(item.apy)}</td>
                    <td className="px-4 py-3 text-right">{pct(item.feeApy)}</td>
                    <td className="px-4 py-3 text-right">{money(item.tvl)}</td>
                    <td className="px-4 py-3 text-right">{money(item.volume24h)}</td>
                    <td className="px-4 py-3 text-right">{pct(item.utilizationPct)}</td>
                    <td className={`px-4 py-3 text-right ${item.riskScore > 65 ? 'text-red-400' : item.riskScore > 35 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {item.riskScore.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MagicCard>

        {selected && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <MagicCard className="glass-card p-5 lg:col-span-2" gradientColor="#16332a">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold">Historical Yield</h2>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.map((item) => ({ ...item, date: new Date(item.snapshotDate).toLocaleDateString() }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)' }} />
                    <Area type="monotone" dataKey="apy" stroke="#34d399" fill="#34d399" fillOpacity={0.18} />
                    <Area type="monotone" dataKey="feeApy" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </MagicCard>
            <MagicCard className="glass-card p-5" gradientColor="#16332a">
              <div className="mb-4 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-yellow-400" />
                <h2 className="text-lg font-bold">Ranking Inputs</h2>
              </div>
              <div className="space-y-4 text-sm">
                <Metric icon={<TrendingUp className="h-4 w-4" />} label="Protocol incentive" value={pct(selected.incentiveApy)} />
                <Metric icon={<Activity className="h-4 w-4" />} label="Rank score" value={selected.rankScore.toFixed(2)} />
                <Metric icon={<BarChart3 className="h-4 w-4" />} label="Historical records" value={String(history.length)} />
              </div>
            </MagicCard>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
