import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PortfolioAnalytics from './PortfolioAnalytics';
import { apiService } from '@/services/apiService';

vi.mock('@/services/apiService', () => ({
  apiService: { get: vi.fn() },
}));

const mockGet = apiService.get as ReturnType<typeof vi.fn>;

const EMPTY_RESPONSE = {
  data: { series: [], allocation: [], totalInvested: 0, totalReturns: 0, realizedPnL: 0, roi: 0,
          fees: { total: 0, platform: 0, stellar: 0 }, tradeCounts: { buys: 0, sells: 0 },
          last7Days: { volume: 0, trades: 0 }, last30Days: { volume: 0, trades: 0 },
          allTime: { volume: 0, trades: 0, since: null }, weekOverWeek: 0 },
};

describe('PortfolioAnalytics', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue(EMPTY_RESPONSE);
  });

  it('shows loading state initially', () => {
    render(<PortfolioAnalytics walletAddress="GTEST" />);
    expect(screen.getByText(/loading performance analytics/i)).toBeTruthy();
  });

  it('shows empty state when no data', async () => {
    render(<PortfolioAnalytics walletAddress="GTEST" />);
    await waitFor(() =>
      expect(screen.getByText(/no analytics data yet/i)).toBeTruthy()
    );
  });

  it('calls API with selected timeframe', async () => {
    render(<PortfolioAnalytics walletAddress="GTEST" />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('timeframe=30d')));
  });

  it('switches timeframe on button click', async () => {
    render(<PortfolioAnalytics walletAddress="GTEST" />);
    await waitFor(() => screen.getByText('7d'));
    await userEvent.click(screen.getByText('7d'));
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('timeframe=7d')));
  });

  it('shows error message on fetch failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    render(<PortfolioAnalytics walletAddress="GTEST" />);
    await waitFor(() =>
      expect(screen.getByText(/network error/i)).toBeTruthy()
    );
  });
});
