import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import moment from 'moment-timezone';

interface TimezoneSetting {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  showCountdownsInLocalTime: boolean;
}

interface TimezoneCountdown {
  passed: boolean;
  countdown?: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  userLocalTime: string;
  utcTime: string;
}

export const TimezoneSettings: React.FC<{
  currentSettings: TimezoneSetting;
  onSettingsChange: (settings: TimezoneSetting) => void;
}> = ({ currentSettings, onSettingsChange }) => {
  const [timezones, setTimezones] = useState<string[]>([]);
  const [localizedCountdown, setLocalizedCountdown] = useState<TimezoneCountdown | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    // Fetch available timezones
    const allTimezones = moment.tz.names();
    setTimezones(allTimezones);

    // Update countdown every second
    const interval = setInterval(() => {
      if (currentSettings.timezone) {
        const event = moment.utc().add(1, 'day'); // Example: event in 1 day
        const countdown = moment.duration(event.diff(moment.utc()));
        const localEvent = event.clone().tz(currentSettings.timezone);

        setLocalizedCountdown({
          passed: false,
          countdown: {
            days: Math.floor(countdown.asDays()),
            hours: countdown.hours(),
            minutes: countdown.minutes(),
            seconds: countdown.seconds()
          },
          userLocalTime: localEvent.format('YYYY-MM-DD HH:mm:ss z'),
          utcTime: event.format('YYYY-MM-DD HH:mm:ss z')
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSettings.timezone]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Timezone Settings</CardTitle>
        <CardDescription>
          Configure your timezone for localized market times and countdowns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Timezone Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Timezone</label>
            <Select value={currentSettings.timezone} onValueChange={(tz) => {
              onSettingsChange({ ...currentSettings, timezone: tz });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Format</label>
            <Select value={currentSettings.dateFormat} onValueChange={(df) => {
              onSettingsChange({ ...currentSettings, dateFormat: df });
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Time Format</label>
            <Select value={currentSettings.timeFormat} onValueChange={(tf) => {
              onSettingsChange({ ...currentSettings, timeFormat: tf });
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12 Hour</SelectItem>
                <SelectItem value="24h">24 Hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Countdown Display */}
        {localizedCountdown && !localizedCountdown.passed && localizedCountdown.countdown && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="font-semibold mb-2">Market Event Countdown</h4>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold">{localizedCountdown.countdown.days}</div>
                <div className="text-xs text-muted-foreground">Days</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{localizedCountdown.countdown.hours}</div>
                <div className="text-xs text-muted-foreground">Hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{localizedCountdown.countdown.minutes}</div>
                <div className="text-xs text-muted-foreground">Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{localizedCountdown.countdown.seconds}</div>
                <div className="text-xs text-muted-foreground">Seconds</div>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Your timezone:</span> {localizedCountdown.userLocalTime}
              </p>
              <p>
                <span className="text-muted-foreground">UTC:</span> {localizedCountdown.utcTime}
              </p>
            </div>
          </div>
        )}

        {/* Notification Preferences */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
          <div>
            <p className="font-medium">Timezone-based Notifications</p>
            <p className="text-sm text-muted-foreground">Get alerts at important market events in your local time</p>
          </div>
          <Badge variant="outline">Enabled</Badge>
        </div>

        <Alert>
          <AlertDescription>
            💡 Tip: Set your timezone to see all market times converted to your local time automatically.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default TimezoneSettings;
