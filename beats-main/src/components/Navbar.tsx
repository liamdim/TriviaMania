import React from 'react';
import { Music, Code2, Play, Radio, KeyRound, Sparkles } from 'lucide-react';

export type ActiveTab = 'play' | 'generator' | 'export' | 'spotify';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  questionCount: number;
  hasSpotifyConnected: boolean;
  onQuickPlay: () => void;
  onAutoAddQuestions?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  questionCount,
  hasSpotifyConnected,
  onQuickPlay,
  onAutoAddQuestions,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 md:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Brand title wordmark */}
        <button
          onClick={() => setActiveTab('play')}
          className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <Music className="w-4 h-4" />
          </div>
          <span className="font-extrabold tracking-tight">
            Beat<span className="text-emerald-400">IQ</span>
          </span>
        </button>

        {/* Zone 2: 4 clean single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('play')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'play'
                ? 'text-emerald-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Play Quiz
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'generator'
                ? 'text-emerald-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Question Generator
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'export'
                ? 'text-emerald-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>GitHub Export Studio</span>
            <span className="text-xs font-mono text-zinc-500 tabular-nums">({questionCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('spotify')}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'spotify'
                ? 'text-emerald-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-zinc-400" />
            <span>Spotify API</span>
            {hasSpotifyConnected && (
              <span className="text-emerald-400 text-xs font-mono">Live</span>
            )}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onAutoAddQuestions && (
            <button
              onClick={onAutoAddQuestions}
              className="px-2.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 shadow-sm"
              title="Auto-generate 25 fresh questions across genres and add to bundle"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>+25 Fresh</span>
            </button>
          )}

          {activeTab === 'play' ? (
            <button
              onClick={() => setActiveTab('export')}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export for GitHub</span>
            </button>
          ) : (
            <button
              onClick={onQuickPlay}
              className="px-4 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Quiz</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
