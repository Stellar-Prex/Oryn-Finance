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
