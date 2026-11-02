import React, { useState, useEffect, useMemo } from 'react';
import { QuizQuestion, GameSummary, QuizSettings } from './types/quiz';
import { CURATED_TRACKS } from './data/curatedTracks';
import { generateQuiz, generateRoundForGenre } from './services/quizGenerator';
import { spotifyApi } from './services/spotifyApi';
import { Navbar, ActiveTab } from './components/Navbar';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizResults } from './components/QuizResults';
import { QuizGeneratorView } from './components/QuizGeneratorView';
import { ExportStudio } from './components/ExportStudio';
import { SpotifyConfigView } from './components/SpotifyConfigModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [gameState, setGameState] = useState<'playing' | 'summary'>('playing');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [lastSummary, setLastSummary] = useState<GameSummary | null>(null);
  const [hasSpotifyConnected, setHasSpotifyConnected] = useState<boolean>(false);

  // Initialize with initial curated quiz
  useEffect(() => {
    const defaultSettings: QuizSettings = {
      selectedGenres: ['pop', 'classic-rock', 'grunge-90s', 'hip-hop', 'electronic-edm', 'synthpop-80s'],
      questionCount: 10,
      questionTypes: ['guess-artist', 'guess-title', 'guess-year', 'guess-album', 'blind-audio'],
      timeLimitSeconds: 25,
      difficulty: 'all',
      enableAudio: true,
      enableSoundEffects: true,
    };
    const initialQuestions = generateQuiz(CURATED_TRACKS, defaultSettings);
    setQuestions(initialQuestions);

    const creds = spotifyApi.getCredentials();
    if (creds.hasCredentials) {
      spotifyApi.testConnection().then((res) => {
        setHasSpotifyConnected(res.success);
      });
    }
  }, []);

  const handleGameComplete = (summary: GameSummary) => {
    setLastSummary(summary);
    setGameState('summary');
  };

  const handleRestartQuiz = () => {
    setGameState('playing');
  };

  const handlePlayAgainNewQuestions = () => {
    const defaultSettings: QuizSettings = {
      selectedGenres: ['pop', 'classic-rock', 'grunge-90s', 'hip-hop', 'electronic-edm', 'synthpop-80s', 'alt-indie'],
      questionCount: 10,
      questionTypes: ['guess-artist', 'guess-title', 'guess-year', 'guess-album', 'blind-audio'],
      timeLimitSeconds: 25,
      difficulty: 'all',
      enableAudio: true,
      enableSoundEffects: true,
    };
    const fresh = generateQuiz(CURATED_TRACKS, defaultSettings);
    setQuestions(fresh);
    setGameState('playing');
  };

  const handleQuestionsGenerated = (newQuestions: QuizQuestion[]) => {
    setQuestions(newQuestions);
    setGameState('playing');
  };

  const handlePlayQuestions = (newQuestions: QuizQuestion[]) => {
    setQuestions(newQuestions);
    setGameState('playing');
    setActiveTab('play');
  };

  const handleAppendQuestions = (count: number = 25, genreFilter?: string) => {
    const defaultSettings: QuizSettings = {
      selectedGenres: genreFilter ? [genreFilter as any] : [],
      questionCount: count,
      questionTypes: ['guess-title', 'guess-artist', 'guess-year', 'guess-album', 'blind-audio'],
      timeLimitSeconds: 25,
      difficulty: 'all',
      enableAudio: true,
      enableSoundEffects: true,
    };
    const fresh = generateQuiz(CURATED_TRACKS, defaultSettings);
    setQuestions((prev) => [...prev, ...fresh]);
  };

  const handleAppendGenreRound = (genreId: string, count: number = 25) => {
    const fresh = generateRoundForGenre(CURATED_TRACKS, genreId as any, count);
    setQuestions((prev) => [...prev, ...fresh]);
  };

  const handleRegenerateFresh = (count: number = 25) => {
    const defaultSettings: QuizSettings = {
      selectedGenres: [],
      questionCount: count,
      questionTypes: ['guess-title', 'guess-artist', 'guess-year', 'guess-album', 'blind-audio'],
      timeLimitSeconds: 25,
      difficulty: 'all',
      enableAudio: true,
      enableSoundEffects: true,
    };
    const fresh = generateQuiz(CURATED_TRACKS, defaultSettings);
    setQuestions(fresh);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleClearQuestions = () => {
    setQuestions([]);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Navbar Contract */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        questionCount={questions.length}
        hasSpotifyConnected={hasSpotifyConnected}
        onQuickPlay={() => {
          setActiveTab('play');
          setGameState('playing');
        }}
        onAutoAddQuestions={() => handleAppendQuestions(25)}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* TAB 1: PLAY QUIZ */}
        {activeTab === 'play' && (
          <div>
            {gameState === 'playing' ? (
              <QuizPlayer
                questions={questions}
                timeLimitSeconds={25}
                onGameComplete={handleGameComplete}
                onRestart={handleRestartQuiz}
                onOpenGenerator={() => setActiveTab('generator')}
              />
            ) : lastSummary ? (
              <QuizResults
                summary={lastSummary}
                questions={questions}
                onPlayAgain={handlePlayAgainNewQuestions}
                onOpenExport={() => setActiveTab('export')}
                onOpenGenerator={() => setActiveTab('generator')}
              />
            ) : null}
          </div>
        )}

        {/* TAB 2: QUESTION GENERATOR */}
        {activeTab === 'generator' && (
          <QuizGeneratorView
            onQuestionsGenerated={handleQuestionsGenerated}
            onPlayQuestions={handlePlayQuestions}
            onNavigateToExport={() => setActiveTab('export')}
            onAppendQuestions={(newQ) => setQuestions((prev) => [...prev, ...newQ])}
          />
        )}

        {/* TAB 3: GITHUB EXPORT STUDIO */}
        {activeTab === 'export' && (
          <ExportStudio
            questions={questions}
            onRemoveQuestion={handleRemoveQuestion}
            onClearQuestions={handleClearQuestions}
            onPlayQuiz={() => {
              setGameState('playing');
              setActiveTab('play');
            }}
            onOpenGenerator={() => setActiveTab('generator')}
            onAppendQuestions={handleAppendQuestions}
            onAppendGenreRound={handleAppendGenreRound}
            onRegenerateFresh={handleRegenerateFresh}
          />
        )}

        {/* TAB 4: SPOTIFY API CONFIG */}
        {activeTab === 'spotify' && (
          <SpotifyConfigView
            onConnectionChange={(connected) => setHasSpotifyConnected(connected)}
          />
        )}
      </main>

      {/* Clean quiet footer */}
      <footer className="border-t border-zinc-800/80 py-6 px-4 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300">BeatIQ</span>
            <span aria-hidden="true">·</span>
            <span>Spotify Multiple Choice Quiz &amp; Export Studio</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <span>28 Music Genres</span>
            <span aria-hidden="true">·</span>
            <span>All-Genre Round &amp; Tournament Generator</span>
            <span aria-hidden="true">·</span>
            <span>GitHub Ready JSON / TS / CSV</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
