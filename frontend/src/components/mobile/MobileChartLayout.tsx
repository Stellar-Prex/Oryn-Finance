import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, TrendingUp, TrendingDown } from 'lucide-react';

interface MobileChartLayoutProps {
  marketId: string;
  priceHistory: Array<{
    timestamp: number;
    yes: number;
    no: number;
  }>;
  currentYesPrice: number;
  currentNoPrice: number;
  compact?: boolean;
}

export const MobileChartLayout: React.FC<MobileChartLayoutProps> = ({
  marketId,
  priceHistory,
  currentYesPrice,
  currentNoPrice,
  compact = true
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [candleLimit, setCandleLimit] = useState(50);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const timeframes = ['5m', '15m', '1h', '4h', '1d'];

  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      setZoomLevel(Math.min(zoomLevel + 0.2, 3));
      setCandleLimit(Math.max(candleLimit - 10, 20));
    } else {
      setZoomLevel(Math.max(zoomLevel - 0.2, 0.5));
      setCandleLimit(Math.min(candleLimit + 10, 200));
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !priceHistory.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Get data to display
    const displayData = priceHistory.slice(-candleLimit);

    // Calculate dimensions
    const width = rect.width;
    const height = rect.height;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Find min and max prices
    const allPrices = displayData.flatMap(d => [d.yes, d.no]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 0.1;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw candlesticks or lines
    const candleWidth = Math.max(chartWidth / displayData.length, 2);

    displayData.forEach((point, index) => {
      const x = padding + (index * chartWidth) / displayData.length;

      // YES price (green)
      const yPrice = padding + chartHeight - ((point.yes - minPrice) / priceRange) * chartHeight;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x, yPrice, 2, 0, Math.PI * 2);
      ctx.fill();

      // NO price (red)
      const noY = padding + chartHeight - ((point.no - minPrice) / priceRange) * chartHeight;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x, noY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Connect lines
      if (index > 0) {
        const prevPoint = displayData[index - 1];
        const prevX = padding + ((index - 1) * chartWidth) / displayData.length;
        const prevYPrice = padding + chartHeight - ((prevPoint.yes - minPrice) / priceRange) * chartHeight;
        const prevNoY = padding + chartHeight - ((prevPoint.no - minPrice) / priceRange) * chartHeight;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(prevX, prevYPrice);
        ctx.lineTo(x, yPrice);
        ctx.stroke();

        ctx.strokeStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(prevX, prevNoY);
        ctx.lineTo(x, noY);
        ctx.stroke();
      }
    });

    // Draw axes
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  }, [priceHistory, candleLimit]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Market Price Chart</CardTitle>
            <CardDescription>Optimized for mobile trading</CardDescription>
          </div>
          <Badge variant="outline">{selectedTimeframe}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Prices */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-lg p-3 bg-green-50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">YES</span>
            </div>
            <p className="text-lg font-bold text-green-700">${currentYesPrice.toFixed(2)}</p>
          </div>
          <div className="border rounded-lg p-3 bg-red-50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">NO</span>
            </div>
            <p className="text-lg font-bold text-red-700">${currentNoPrice.toFixed(2)}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="border rounded-lg bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: compact ? '200px' : '400px' }}
          />
        </div>

        {/* Timeframe Selection */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Timeframe</p>
          <div className="grid grid-cols-5 gap-1">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant={selectedTimeframe === tf ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeframe(tf)}
                className="text-xs"
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleZoom('in')}
            className="flex-1"
          >
            <ZoomIn className="w-4 h-4 mr-1" />
            Zoom In
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleZoom('out')}
            className="flex-1"
          >
            <ZoomOut className="w-4 h-4 mr-1" />
            Zoom Out
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <p>
            Zoom Level: {zoomLevel.toFixed(1)}x | Showing {candleLimit} candles
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MobileChartLayout;
