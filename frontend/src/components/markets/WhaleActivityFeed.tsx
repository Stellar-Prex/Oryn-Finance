import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface WhaleAlert {
  alertId: string;
  walletAddress: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  tradeDetails: {
    amount: number;
    price: number;
    totalCost: number;
    tokenType: string;
    tradeType: string;
  };
  metrics: {
    volumePercentage: number;
    priceImpact: number;
  };
  createdAt: string;
}

const severityColors = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

const severityBorders = {
  low: 'border-l-blue-500',
  medium: 'border-l-yellow-500',
  high: 'border-l-orange-500',
  critical: 'border-l-red-500'
};

export const WhaleActivityFeed: React.FC<{
  alerts: WhaleAlert[];
  isLoading?: boolean;
  onAlertClick?: (alert: WhaleAlert) => void;
}> = ({ alerts, isLoading = false, onAlertClick }) => {
  const formatWalletAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact'
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Whale Activity Feed</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-32">
          <div className="text-muted-foreground">Loading whale activity...</div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Whale Activity Feed</CardTitle>
          <CardDescription>No whale activity detected</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Large transactions will appear here as they happen
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Whale Activity Feed</h2>
        <p className="text-muted-foreground">Track large transactions affecting markets</p>
      </div>

      {alerts.map((alert) => (
        <Card
          key={alert.alertId}
          className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${severityBorders[alert.severity]}`}
          onClick={() => onAlertClick?.(alert)}
        >
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {alert.tradeDetails.tradeType === 'buy' ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <h3 className="font-semibold">{alert.title}</h3>
                  </div>
                  <Badge className={severityColors[alert.severity]}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">
                    {formatUSD(alert.tradeDetails.totalCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground">{alert.description}</p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4 py-2 border-y">
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-semibold">{alert.tradeDetails.amount.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volume %</p>
                  <p className="font-semibold">{alert.metrics.volumePercentage.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Price Impact</p>
                  <p className="font-semibold">{(alert.metrics.priceImpact * 100).toFixed(2)}%</p>
                </div>
              </div>

              {/* Wallet Info */}
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-muted-foreground">Wallet</p>
                  <p className="font-mono">{formatWalletAddress(alert.walletAddress)}</p>
                </div>
                <Button variant="outline" size="sm">
                  View Profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default WhaleActivityFeed;
