import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock3,
  DollarSign,
  History,
  Layers,
  PieChart as PieChartIcon,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Layout } from '@/components/layout/Layout';
import { apiService } from '@/services/apiService';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useWebSocket } from '@/contexts/WebSocketContext';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const CHART_COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#a855f7', '#f43f5e', '#14b8a6', '#f97316', '#6366f1'];

function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getRiskColor(score: number) {
  if (score < 25) return 'text-green-400';
  if (score < 50) return 'text-yellow-400';
  if (score < 75) return 'text-orange-400';
  return 'text-red-400';
}

function getRiskLabel(score: number) {
  if (score < 25) return 'Low';
  if (score < 50) return 'Medium';
  if (score < 75) return 'High';
  return 'Critical';
}

export default function TreasuryDashboard() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { socket, isConnected } = useWebSocket();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get('/treasury/dashboard');
      setDashboardData(response.data);
      setLastUpdated(new Date(response.data.lastUpdated));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to treasury updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('subscribe_treasury');

    const handleTreasuryUpdate = (data: any) => {
      setDashboardData(data);
      setLastUpdated(new Date(data.ts));
    };

    socket.on('treasury_update', handleTreasuryUpdate);

    return () => {
      socket.emit('unsubscribe_treasury');
      socket.off('treasury_update', handleTreasuryUpdate);
    };
  }, [socket, isConnected]);

  const tvlBreakdown = useMemo(() => {
    if (!dashboardData?.tvl?.breakdown) return [];
    const { markets, liquidity, positions } = dashboardData.tvl.breakdown;
    return [
      { name: 'Markets', value: markets.tvl, count: markets.count },
      { name: 'Liquidity', value: liquidity.tvl, count: liquidity.count },
      { name: 'Positions', value: positions.tvl, count: positions.count },
    ];
  }, [dashboardData]);

  const assetAllocation = useMemo(() => {
    if (!dashboardData?.allocation?.treasury) return [];
    return dashboardData.allocation.treasury.map((item: any) => ({
      name: item.asset,
      value: item.balance,
      percentage: parseFloat(item.percentage),
    }));
  }, [dashboardData]);

  const riskMetrics = useMemo(() => {
    if (!dashboardData?.risk) return null;
    return dashboardData.risk;
  }, [dashboardData]);

  const yieldStats = useMemo(() => {
    if (!dashboardData?.yield) return null;
    return dashboardData.yield;
  }, [dashboardData]);

  const topMetrics = useMemo(() => {
    if (!dashboardData) return [];
    return [
      { 
        label: 'Total TVL', 
        value: fmt(dashboardData.tvl?.totalTVL || 0), 
        icon: Layers, 
        color: 'text-primary',
        change: '+12.5%',
        changePositive: true
      },
      { 
        label: 'Net Treasury', 
        value: fmt(dashboardData.overview?.netBalance || 0), 
        icon: Wallet, 
        color: 'text-success',
        change: '+8.2%',
        changePositive: true
      },
      { 
        label: 'APY', 
        value: `${yieldStats?.yield?.apy || 0}%`, 
        icon: Zap, 
        color: 'text-yellow-400',
        change: '+2.1%',
        changePositive: true
      },
      { 
        label: 'Risk Score', 
        value: `${riskMetrics?.overallRiskScore || 0}/100`, 
        icon: ShieldAlert, 
        color: getRiskColor(riskMetrics?.overallRiskScore || 0),
        change: '-5.3%',
        changePositive: true
      },
    ];
  }, [dashboardData, riskMetrics, yieldStats]);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading treasury data...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="text-destructive">Error Loading Data</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={fetchData} className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wallet className="w-8 h-8 text-primary" />
              Treasury Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Protocol treasury metrics, TVL, asset allocation, and risk analysis
              {lastUpdated && (
                <span className="ml-2 text-xs">
                  • Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {topMetrics.map(({ label, value, icon: Icon, color, change, changePositive }) => (
            <MagicCard key={label} className="glass-card p-6" gradientColor="#262626">
              <div className="flex items-start justify-between">
                <Icon className={`w-5 h-5 mb-2 ${color}`} />
                {change && (
                  <Badge variant="outline" className={changePositive ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'}>
                    {change}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </MagicCard>
          ))}
        </div>

        {/* TVL and Asset Allocation */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              TVL Breakdown
            </h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tvlBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {tvlBreakdown.map((_: any, index: number) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              {tvlBreakdown.map((item: any) => (
                <div key={item.name}>
                  <p className="text-xs text-muted-foreground">{item.name}</p>
                  <p className="font-semibold">{fmt(item.value)}</p>
                  <p className="text-xs text-muted-foreground">{item.count} items</p>
                </div>
              ))}
            </div>
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              Treasury Asset Allocation
            </h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetAllocation}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => fmt(value)} />
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Total Treasury Balance: {fmt(dashboardData.allocation?.totalTreasuryBalance || 0)}</p>
            </div>
          </MagicCard>
        </div>

        {/* Yield Statistics */}
        <MagicCard className="glass-card p-6 mb-8" gradientColor="#262626">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Yield Generation Statistics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">24h Yield</p>
              <p className="text-xl font-bold">{fmt(yieldStats?.yield?.last24h || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">7d Yield</p>
              <p className="text-xl font-bold">{fmt(yieldStats?.yield?.last7d || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">30d Yield</p>
              <p className="text-xl font-bold">{fmt(yieldStats?.yield?.last30d || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Annualized APY</p>
              <p className="text-xl font-bold text-yellow-400">{yieldStats?.yield?.apy || 0}%</p>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yieldStats?.yieldBySource || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="_id" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => fmt(value)} />
                <Tooltip formatter={(value: number) => fmt(value)} />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MagicCard>

        {/* Risk Metrics */}
        <MagicCard className="glass-card p-6 mb-8" gradientColor="#262626">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            Risk Exposure Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Overall Risk</p>
                <Badge className={getRiskColor(riskMetrics?.overallRiskScore || 0)}>
                  {getRiskLabel(riskMetrics?.overallRiskScore || 0)}
                </Badge>
              </div>
              <p className="text-3xl font-bold">{riskMetrics?.overallRiskScore || 0}/100</p>
              <Progress value={riskMetrics?.overallRiskScore || 0} className="mt-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Market Risk</p>
              <p className="text-xl font-bold">{riskMetrics?.riskBreakdown?.market?.score?.toFixed(1) || 0}</p>
              <Progress value={riskMetrics?.riskBreakdown?.market?.score || 0} className="mt-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Liquidity Risk</p>
              <p className="text-xl font-bold">{riskMetrics?.riskBreakdown?.liquidity?.score?.toFixed(1) || 0}</p>
              <Progress value={riskMetrics?.riskBreakdown?.liquidity?.score || 0} className="mt-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Concentration Risk</p>
              <p className="text-xl font-bold">{riskMetrics?.riskBreakdown?.concentration?.score?.toFixed(1) || 0}</p>
              <Progress value={riskMetrics?.riskBreakdown?.concentration?.score || 0} className="mt-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-white/5">
              <p className="text-muted-foreground mb-1">Market Volume</p>
              <p className="font-semibold">{fmt(riskMetrics?.riskBreakdown?.market?.totalVolume || 0)}</p>
              <p className="text-xs text-muted-foreground">{riskMetrics?.riskBreakdown?.market?.marketCount || 0} active markets</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5">
              <p className="text-muted-foreground mb-1">Liquidity Depth</p>
              <p className="font-semibold">{fmt(riskMetrics?.riskBreakdown?.liquidity?.totalLiquidity || 0)}</p>
              <p className="text-xs text-muted-foreground">{riskMetrics?.riskBreakdown?.liquidity?.positionCount || 0} positions</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5">
              <p className="text-muted-foreground mb-1">Concentration Ratio</p>
              <p className="font-semibold">{riskMetrics?.riskBreakdown?.concentration?.ratio || 0}%</p>
              <p className="text-xs text-muted-foreground">Top 10 positions</p>
            </div>
          </div>
        </MagicCard>

        {/* Active Positions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Active User Positions
            </h2>
            <div className="space-y-3">
              {dashboardData?.positions?.userPositions?.positions?.slice(0, 5).map((pos: any, i: number) => (
                <div key={pos._id || i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{pos.marketId?.question || 'Unknown Market'}</p>
                    <p className="text-xs text-muted-foreground">{pos.userWalletAddress?.slice(0, 8)}...</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmt(pos.totalInvested || 0)}</p>
                    <p className="text-xs text-muted-foreground">{pos.yesTokens?.toFixed(2) || 0} YES / {pos.noTokens?.toFixed(2) || 0} NO</p>
                  </div>
                </div>
              ))}
              {dashboardData?.positions?.userPositions?.positions?.length === 0 && (
                <p className="text-muted-foreground text-sm py-4 text-center">No active positions</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-muted-foreground">
                Showing {dashboardData?.positions?.userPositions?.showing || 0} of {dashboardData?.positions?.userPositions?.total || 0} total positions
              </p>
            </div>
          </MagicCard>

          <MagicCard className="glass-card p-6" gradientColor="#262626">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Liquidity Positions
            </h2>
            <div className="space-y-3">
              {dashboardData?.positions?.liquidityPositions?.positions?.slice(0, 5).map((pos: any, i: number) => (
                <div key={pos._id || i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{pos.poolAddress?.slice(0, 12)}...</p>
                    <p className="text-xs text-muted-foreground">{pos.tokenA} / {pos.tokenB}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmt(pos.totalLiquidity || 0)}</p>
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  </div>
                </div>
              ))}
              {dashboardData?.positions?.liquidityPositions?.positions?.length === 0 && (
                <p className="text-muted-foreground text-sm py-4 text-center">No liquidity positions</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-muted-foreground">
                Showing {dashboardData?.positions?.liquidityPositions?.showing || 0} of {dashboardData?.positions?.liquidityPositions?.total || 0} total positions
              </p>
            </div>
          </MagicCard>
        </div>

        <div className="mt-8 text-center">
          <Link to="/admin">
            <Button variant="outline">
              View Full Admin Dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
