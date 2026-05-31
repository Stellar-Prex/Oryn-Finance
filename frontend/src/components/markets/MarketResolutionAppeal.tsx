import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, X } from 'lucide-react';

interface Evidence {
  type: 'link' | 'document' | 'screenshot' | 'article' | 'other';
  url: string;
  description: string;
}

export const MarketResolutionAppeal: React.FC<{
  marketId: string;
  marketQuestion: string;
  currentResolution: 'yes' | 'no' | 'invalid';
  onSubmitAppeal: (appeal: any) => Promise<void>;
}> = ({ marketId, marketQuestion, currentResolution, onSubmitAppeal }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const appealReasons = [
    'resolution-criteria-not-met',
    'oracle-error',
    'subjective-interpretation',
    'new-evidence',
    'other'
  ];

  const addEvidence = (newEvidence: Evidence) => {
    setEvidence([...evidence, newEvidence]);
  };

  const removeEvidence = (index: number) => {
    setEvidence(evidence.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reason || !description) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      setSuccessMessage('');

      await onSubmitAppeal({
        marketId,
        reason,
        description,
        evidence
      });

      setSuccessMessage('Appeal submitted successfully! Your appeal is now under review.');
      setReason('');
      setDescription('');
      setEvidence([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit appeal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Appeal Market Resolution</CardTitle>
        <CardDescription>
          Challenge the resolution of this market and provide evidence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market Info */}
        <Alert>
          <AlertDescription>
            <p className="font-semibold mb-2">Market Question</p>
            <p>{marketQuestion}</p>
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Current Resolution:</span>{' '}
              <Badge>{currentResolution.toUpperCase()}</Badge>
            </p>
          </AlertDescription>
        </Alert>

        {/* Messages */}
        {successMessage && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
          </Alert>
        )}
        {errorMessage && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Appeal Reason */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Appeal Reason *</label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue placeholder="Select reason for appeal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resolution-criteria-not-met">
                Resolution Criteria Not Met
              </SelectItem>
              <SelectItem value="oracle-error">Oracle Error/Malfunction</SelectItem>
              <SelectItem value="subjective-interpretation">
                Subjective Interpretation Dispute
              </SelectItem>
              <SelectItem value="new-evidence">New Evidence Available</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Detailed Description *</label>
          <Textarea
            placeholder="Explain why you believe the resolution is incorrect..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Be clear and specific about your concerns
          </p>
        </div>

        {/* Evidence */}
        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list">Evidence ({evidence.length})</TabsTrigger>
            <TabsTrigger value="add">Add Evidence</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-3">
            {evidence.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No evidence added yet</p>
            ) : (
              evidence.map((ev, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <Badge variant="outline" className="mb-2">
                      {ev.type.toUpperCase()}
                    </Badge>
                    <p className="text-sm font-medium">{ev.description}</p>
                    <p className="text-xs text-muted-foreground break-all">{ev.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEvidence(idx)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <EvidenceForm onAdd={addEvidence} />
          </TabsContent>
        </Tabs>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !reason || !description}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? 'Submitting Appeal...' : 'Submit Appeal'}
        </Button>

        <Alert>
          <AlertDescription className="text-sm">
            💡 Your appeal will be reviewed by a panel of community reviewers. They will evaluate
            your arguments and evidence to determine if the resolution should be changed.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

const EvidenceForm: React.FC<{
  onAdd: (evidence: Evidence) => void;
}> = ({ onAdd }) => {
  const [type, setType] = useState<'link' | 'document' | 'screenshot' | 'article' | 'other'>('link');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (url && description) {
      onAdd({ type, url, description });
      setUrl('');
      setDescription('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Evidence Type</label>
        <Select value={type} onValueChange={(v: any) => setType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="link">Link/URL</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="screenshot">Screenshot</SelectItem>
            <SelectItem value="article">Article/News</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">URL/Source</label>
        <input
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          placeholder="Describe this evidence and how it supports your appeal..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      <Button
        onClick={handleAdd}
        disabled={!url || !description}
        variant="outline"
        className="w-full"
      >
        <Upload className="w-4 h-4 mr-2" />
        Add Evidence
      </Button>
    </div>
  );
};

export default MarketResolutionAppeal;
