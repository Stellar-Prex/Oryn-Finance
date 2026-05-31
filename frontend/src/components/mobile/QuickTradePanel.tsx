import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, Smartphone } from 'lucide-react';

interface QuickTradePanelProps {
  marketId: string;
  currentYesPrice: number;
  currentNoPrice: number;
  onTrade: (type: 'yes' | 'no', tradeType: 'buy' | 'sell', amount: number) => Promise<void>;
  userBalance: number;
  defaultOrderSize?: number;
  oneClickEnabled?: boolean;
}

export const QuickTradePanel: React.FC<QuickTradePanelProps> = ({
  marketId,
  currentYesPrice,
  currentNoPrice,
  onTrade,
  userBalance,
  defaultOrderSize = 100,
  oneClickEnabled = false
}) => {
  const [amount, setAmount] = useState(defaultOrderSize);
  const [selectedToken, setSelectedToken] = useState<'yes' | 'no'>('yes');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentPrice = selectedToken === 'yes' ? currentYesPrice : currentNoPrice;
  const estimatedCost = amount * currentPrice;
  const percentageOfBalance = (estimatedCost / userBalance) * 100;

  const handleQuickTrade = async (token: 'yes' | 'no', type: 'buy' | 'sell', qty: number) => {
    try {
      setIsExecuting(true);
      setErrorMessage('');

      if (type === 'buy' && estimatedCost > userBalance) {
        setErrorMessage('Insufficient balance');
        return;
      }

      await onTrade(token, type, qty);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Trade failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card className="w-full bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <CardTitle>Quick Trade</CardTitle>
            <CardDescription>Fast mobile trading panel</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error Message */}
        {errorMessage && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Token Selection */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={selectedToken === 'yes' ? 'default' : 'outline'}
            onClick={() => setSelectedToken('yes')}
            className="text-center"
          >
            <div>
              <div className="font-semibold">YES</div>
              <div className="text-xs">${currentYesPrice.toFixed(2)}</div>
            </div>
          </Button>
          <Button
            variant={selectedToken === 'no' ? 'default' : 'outline'}
            onClick={() => setSelectedToken('no')}
            className="text-center"
          >
            <div>
              <div className="font-semibold">NO</div>
              <div className="text-xs">${currentNoPrice.toFixed(2)}</div>
            </div>
          </Button>
        </div>

        {/* Trade Type Selection */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={tradeType === 'buy' ? 'default' : 'outline'}
            onClick={() => setTradeType('buy')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Buy
          </Button>
          <Button
            variant={tradeType === 'sell' ? 'default' : 'outline'}
            onClick={() => setTradeType('sell')}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Sell
          </Button>
        </div>

        {/* Amount Slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Amount</label>
            <Badge variant="outline">${amount}</Badge>
          </div>
          <Slider
            value={[amount]}
            onValueChange={(val) => setAmount(val[0])}
            min={10}
            max={Math.min(1000, userBalance / currentPrice)}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$10</span>
            <span>${Math.min(1000, userBalance / currentPrice).toFixed(0)}</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Small', amount: 50 },
            { label: 'Medium', amount: 100 },
            { label: 'Large', amount: 500 }
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => setAmount(preset.amount)}
              className="text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Order Summary */}
        <div className="border rounded-lg p-3 bg-muted/50 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated Cost:</span>
            <span className="font-semibold">${estimatedCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Of Balance:</span>
            <span className={percentageOfBalance > 50 ? 'text-orange-600 font-semibold' : ''}>
              {percentageOfBalance.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-medium">Available:</span>
            <span className="font-semibold">${userBalance.toFixed(2)}</span>
          </div>
        </div>

        {/* One-Click Trading */}
        {oneClickEnabled && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-800 text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              One-click trading enabled - swipe or tap to execute
            </AlertDescription>
          </Alert>
        )}

        {/* Execute Button */}
        <Button
          onClick={() => handleQuickTrade(selectedToken, tradeType, amount)}
          disabled={isExecuting || estimatedCost > userBalance}
          className={`w-full h-12 font-semibold text-base ${
            tradeType === 'buy'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isExecuting
            ? 'Processing...'
            : `${tradeType.toUpperCase()} ${amount} ${selectedToken.toUpperCase()} - $${estimatedCost.toFixed(2)}`}
        </Button>

        <Alert>
          <AlertDescription className="text-xs">
            💡 Use the slider or preset buttons for quick order sizing. Confirm before execution.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default QuickTradePanel;
