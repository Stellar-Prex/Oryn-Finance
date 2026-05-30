import { useState } from 'react';
import { Trophy, TrendingUp, Landmark, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MarketTemplate {
  id: string;
  label: string;
  question: string;
  category: 'Crypto' | 'Sports' | 'Politics' | 'Entertainment';
  resolutionSource: string;
  suggestedLiquidity: number;
  suggestedFee: number;
  daysUntilExpiry: number;
  tags?: string[];
}

const templates: MarketTemplate[] = [
  // Sports
  {
    id: 'sports-1',
    label: 'Championship Winner',
    question: 'Will [Team] win the [Championship/League] this season?',
    category: 'Sports',
    resolutionSource: 'Official league website / ESPN',
    suggestedLiquidity: 200,
    suggestedFee: 2,
    daysUntilExpiry: 180,
    tags: ['football', 'championship'],
  },
  {
    id: 'sports-2',
    label: 'Player Performance',
    question: 'Will [Player] score more than [X] goals/points this season?',
    category: 'Sports',
    resolutionSource: 'Official league stats / ESPN',
    suggestedLiquidity: 150,
    suggestedFee: 2,
    daysUntilExpiry: 90,
    tags: ['player', 'stats'],
  },
  {
    id: 'sports-3',
    label: 'Match Result',
    question: 'Will [Team A] beat [Team B] in the [Tournament] on [Date]?',
    category: 'Sports',
    resolutionSource: 'Official match result / BBC Sport',
    suggestedLiquidity: 100,
    suggestedFee: 1.5,
    daysUntilExpiry: 14,
    tags: ['match', 'result'],
  },
  {
    id: 'sports-4',
    label: 'World Cup / Olympics',
    question: 'Will [Country] win a gold medal at the [Event] in [Year]?',
    category: 'Sports',
    resolutionSource: 'Official Olympic/FIFA website',
    suggestedLiquidity: 300,
    suggestedFee: 2,
    daysUntilExpiry: 365,
    tags: ['olympics', 'world cup'],
  },
  // Crypto
  {
    id: 'crypto-1',
    label: 'Price Target',
    question: 'Will [Coin] exceed $[Price] by [Date]?',
    category: 'Crypto',
    resolutionSource: 'CoinGecko API',
    suggestedLiquidity: 200,
    suggestedFee: 2,
    daysUntilExpiry: 90,
    tags: ['price', 'bitcoin', 'altcoin'],
  },
  {
    id: 'crypto-2',
    label: 'ETF / Regulatory Approval',
    question: 'Will the SEC approve a [Coin] spot ETF by [Date]?',
    category: 'Crypto',
    resolutionSource: 'SEC official announcements / Bloomberg',
    suggestedLiquidity: 300,
    suggestedFee: 2.5,
    daysUntilExpiry: 180,
    tags: ['etf', 'sec', 'regulation'],
  },
  {
    id: 'crypto-3',
    label: 'Market Cap Flip',
    question: 'Will [Coin A] flip [Coin B] in market cap by end of [Year]?',
    category: 'Crypto',
    resolutionSource: 'CoinMarketCap',
    suggestedLiquidity: 250,
    suggestedFee: 2,
    daysUntilExpiry: 365,
    tags: ['marketcap', 'flippening'],
  },
  {
    id: 'crypto-4',
    label: 'Protocol Launch',
    question: 'Will [Protocol] mainnet launch before [Date]?',
    category: 'Crypto',
    resolutionSource: 'Official project blog / GitHub',
    suggestedLiquidity: 150,
    suggestedFee: 2,
    daysUntilExpiry: 120,
    tags: ['defi', 'launch', 'protocol'],
  },
  // Politics
  {
    id: 'politics-1',
    label: 'Election Outcome',
    question: 'Will [Candidate] win the [Election] in [Country/State]?',
    category: 'Politics',
    resolutionSource: 'Official election commission results',
    suggestedLiquidity: 300,
    suggestedFee: 2.5,
    daysUntilExpiry: 180,
    tags: ['election', 'vote'],
  },
  {
    id: 'politics-2',
    label: 'Policy Decision',
    question: 'Will [Central Bank / Government] [raise/cut/pass] [policy] by [Date]?',
    category: 'Politics',
    resolutionSource: 'Official government / central bank announcement',
    suggestedLiquidity: 200,
    suggestedFee: 2,
    daysUntilExpiry: 90,
    tags: ['policy', 'fed', 'government'],
  },
  {
    id: 'politics-3',
    label: 'Geopolitical Event',
    question: 'Will [Country A] and [Country B] sign a [Treaty/Deal] by [Date]?',
    category: 'Politics',
    resolutionSource: 'Reuters / AP News',
    suggestedLiquidity: 200,
    suggestedFee: 2,
    daysUntilExpiry: 270,
    tags: ['geopolitics', 'treaty'],
  },
  {
    id: 'politics-4',
    label: 'Leadership Change',
    question: 'Will [Leader] still be [Position] in [Country] by end of [Year]?',
    category: 'Politics',
    resolutionSource: 'BBC News / Reuters',
    suggestedLiquidity: 150,
    suggestedFee: 2,
    daysUntilExpiry: 365,
    tags: ['leadership', 'government'],
  },
];

const categoryConfig = {
  Sports: {
    icon: Trophy,
    color: 'text-success',
    border: 'border-success/30',
    bg: 'bg-success/10',
    activeBg: 'bg-success/20',
    label: 'Sports',
  },
  Crypto: {
    icon: TrendingUp,
    color: 'text-primary',
    border: 'border-primary/30',
    bg: 'bg-primary/10',
    activeBg: 'bg-primary/20',
    label: 'Crypto',
  },
  Politics: {
    icon: Landmark,
    color: 'text-secondary',
    border: 'border-secondary/30',
    bg: 'bg-secondary/10',
    activeBg: 'bg-secondary/20',
    label: 'Politics',
  },
};

type CategoryKey = keyof typeof categoryConfig;

interface PredictionTemplatesProps {
  onSelect: (template: MarketTemplate) => void;
}

export function PredictionTemplates({ onSelect }: PredictionTemplatesProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('Sports');
  const [expanded, setExpanded] = useState(true);

  const filtered = templates.filter((t) => t.category === activeCategory);
  const cfg = categoryConfig[activeCategory];

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Quick Start Templates</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
            {templates.length} templates
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <>
          {/* Category tabs */}
          <div className="flex gap-2">
            {(Object.keys(categoryConfig) as CategoryKey[]).map((cat) => {
              const c = categoryConfig[cat];
              const Icon = c.icon;
              const isActive = cat === activeCategory;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                    isActive
                      ? `${c.activeBg} ${c.color} ${c.border}`
                      : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Template list */}
          <div className="grid gap-2">
            {filtered.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all group',
                  `${cfg.bg} ${cfg.border} hover:${cfg.activeBg}`
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-bold mb-1', cfg.color)}>
                      {template.label}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {template.question}
                    </p>
                    {template.tags && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.tags.map((tag) => (
                          <span key={tag} className="text-[9px] text-white/30">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-white/40 whitespace-nowrap shrink-0 mt-0.5 group-hover:text-primary transition-colors">
                    Use →
                  </span>
                </div>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Click a template to pre-fill the form. Customize before submitting.
          </p>
        </>
      )}
    </div>
  );
}
