import React, { useState, useEffect, useCallback } from 'react';
import {
  QuizQuestion,
  OptionKey,
  UserAnswer,
  GameSummary,
} from '../types/quiz';
import { AudioPlayer } from './AudioPlayer';
import { soundEffects } from '../services/soundEffects';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ArrowRight,
  Flame,
  Volume2,
  VolumeX,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface QuizPlayerProps {
  questions: QuizQuestion[];
  timeLimitSeconds?: number;
  onGameComplete: (summary: GameSummary) => void;
  onRestart: () => void;
  onOpenGenerator: () => void;
}

export const QuizPlayer: React.FC<QuizPlayerProps> = ({
  questions,
  timeLimitSeconds = 25,
  onGameComplete,
  onRestart,
  onOpenGenerator,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitSeconds);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [gameStartTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex >= questions.length - 1;

  // Sound toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEffects.setEnabled(next);
  };

  // Reset timer on new question
  useEffect(() => {
    setTimeLeft(timeLimitSeconds);
    setSelectedOption(null);
    setIsAnswered(false);
    setQuestionStartTime(Date.now());
  }, [currentIndex, timeLimitSeconds]);

  // Handle Answer Selection
  const handleSelectOption = useCallback(
    (key: OptionKey) => {
      if (isAnswered || !currentQuestion) return;

      const isCorrect = key === currentQuestion.answer;
      const timeSpent = Date.now() - questionStartTime;

      setSelectedOption(key);
      setIsAnswered(true);

      if (isCorrect) {
        soundEffects.playCorrect();
        const basePoints = 100;
        const timeBonus = Math.max(0, Math.round(timeLeft * 4));
        const streakBonus = streak * 25;
        const roundPoints = basePoints + timeBonus + streakBonus;

        setScore((prev) => prev + roundPoints);
        setStreak((prev) => {
          const next = prev + 1;
          if (next > bestStreak) setBestStreak(next);
          if (next > 1 && next % 3 === 0) {
            setTimeout(() => soundEffects.playStreak(), 200);
          }
          return next;
        });
      } else {
        soundEffects.playWrong();
        setStreak(0);
      }

      setAnswers((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          selectedOption: key,
          isCorrect,
          timeSpentMs: timeSpent,
        },
      ]);
    },
    [isAnswered, currentQuestion, questionStartTime, timeLeft, streak, bestStreak]
  );

  // Countdown Timer
  useEffect(() => {
    if (isAnswered || timeLeft <= 0 || timeLimitSeconds === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Time expired, mark as wrong
          if (!isAnswered && currentQuestion) {
            soundEffects.playWrong();
            setIsAnswered(true);
            setStreak(0);
            setAnswers((a) => [
              ...a,
              {
                questionId: currentQuestion.id,
                selectedOption: null,
                isCorrect: false,
                timeSpentMs: timeLimitSeconds * 1000,
              },
            ]);
          }
          return 0;
        }
        if (prev <= 5 && soundEnabled) {
          soundEffects.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAnswered, timeLeft, timeLimitSeconds, currentQuestion, soundEnabled]);

  // Next Question or Finish
  const handleNext = useCallback(() => {
    soundEffects.playClick();
    if (isLastQuestion) {
      const totalTimeSeconds = Math.round((Date.now() - gameStartTime) / 1000);
      const correctCount = answers.filter((a) => a.isCorrect).length + (selectedOption === currentQuestion.answer ? 1 : 0);
      const accuracy = Math.round((correctCount / questions.length) * 100);

      onGameComplete({
        score,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        accuracy,
        bestStreak,
        totalTimeSeconds,
        answers,
      });
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [
    isLastQuestion,
    gameStartTime,
    answers,
    selectedOption,
    currentQuestion,
    questions.length,
    score,
    bestStreak,
    onGameComplete,
  ]);

  // Keyboard Shortcuts (1-4 or A-D, Space/Enter for next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      if (!isAnswered) {
        if (key === '1' || key === 'a') handleSelectOption('a');
        else if (key === '2' || key === 'b') handleSelectOption('b');
        else if (key === '3' || key === 'c') handleSelectOption('c');
        else if (key === '4' || key === 'd') handleSelectOption('d');
      } else {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, handleSelectOption, handleNext]);

  if (!currentQuestion) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <p className="text-zinc-400">No questions generated yet.</p>
        <button
          onClick={onOpenGenerator}
          className="px-4 py-2 bg-emerald-500 text-zinc-950 font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
        >
          Generate Questions
        </button>
      </div>
    );
  }

  const optionKeys: OptionKey[] = ['a', 'b', 'c', 'd'];
  const timerPercent = timeLimitSeconds > 0 ? (timeLeft / timeLimitSeconds) * 100 : 100;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Top HUD Bar */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="font-mono text-zinc-200 font-semibold">
            Question {currentIndex + 1} / {questions.length}
          </span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          {currentQuestion.roundName && (
            <>
              <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                {currentQuestion.roundName}
              </span>
              <span aria-hidden="true" className="text-zinc-700">·</span>
            </>
          )}
          <span>{currentQuestion.genreName}</span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          <span className="capitalize">{currentQuestion.difficulty}</span>
        </div>

        <div className="flex items-center gap-5">
          {/* Streak indicator */}
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-amber-400 fill-amber-400 animate-bounce' : 'text-zinc-600'}`} />
            <span className={streak > 0 ? 'text-amber-300' : 'text-zinc-500'}>
              {streak}x
            </span>
          </div>

          {/* Current Score */}
          <div className="text-right">
            <span className="text-xs text-zinc-500 mr-1.5">Score</span>
            <span className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
              {score.toLocaleString()}
            </span>
          </div>

          {/* Sound & Controls */}
          <div className="flex items-center gap-1 border-l border-zinc-800 pl-3">
            <button
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors rounded-md"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-zinc-600" />}
            </button>
            <button
              onClick={onRestart}
              title="Restart Quiz"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors rounded-md"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Timer Bar */}
      {timeLimitSeconds > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Time Remaining</span>
            </span>
            <span className={`tabular-nums font-semibold ${timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-zinc-300'}`}>
              {timeLeft}s
            </span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                timeLeft <= 5
                  ? 'bg-rose-500'
                  : timeLeft <= 10
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Question Card */}
      <div className="bg-zinc-900 border border-zinc-800/90 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl shadow-black/40">
        {/* Question Prompt */}
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-zinc-50 leading-snug tracking-tight">
            {currentQuestion.prompt}
          </h2>
          <p className="text-xs text-zinc-400">
            Select one of the 4 options below or press keyboard keys [1, 2, 3, 4] / [A, B, C, D]
          </p>
        </div>

        {/* Audio Snippet Player with Answer Masking */}
        <AudioPlayer
          src={currentQuestion.track.previewUrl}
          title={currentQuestion.track.title}
          artist={currentQuestion.track.artist}
          albumArt={currentQuestion.track.albumArt}
          autoPlay={true}
          isRevealed={isAnswered}
          questionIndex={currentIndex + 1}
        />

        {/* Multiple Choice Options A, B, C, D */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
          {optionKeys.map((key) => {
            const optionText = currentQuestion.options[key];
            const isCorrectOption = key === currentQuestion.answer;
            const isUserSelection = key === selectedOption;

            let buttonStyle = 'bg-zinc-900/90 border-zinc-700/70 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/80';
            let badgeStyle = 'bg-zinc-800 text-zinc-400 border-zinc-700';

            if (isAnswered) {
              if (isCorrectOption) {
                buttonStyle = 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/50';
                badgeStyle = 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold';
              } else if (isUserSelection && !isCorrectOption) {
                buttonStyle = 'bg-rose-950/60 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/50';
                badgeStyle = 'bg-rose-500 text-zinc-950 border-rose-400 font-bold';
              } else {
                buttonStyle = 'opacity-40 bg-zinc-900/40 border-zinc-800 text-zinc-500 cursor-not-allowed';
              }
            }

            return (
              <button
                key={key}
                disabled={isAnswered}
                onClick={() => handleSelectOption(key)}
                className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all ${buttonStyle}`}
              >
                {/* Option Key Badge: A, B, C, D */}
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono uppercase shrink-0 border transition-colors ${badgeStyle}`}
                >
                  {key}
                </span>

                {/* Option Content Text */}
                <span className="flex-1 text-sm md:text-base font-medium leading-snug">
                  {optionText}
                </span>

                {/* Feedback Icon */}
                {isAnswered && isCorrectOption && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                {isAnswered && isUserSelection && !isCorrectOption && (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Answer Reveal & Explanation Panel */}
        {isAnswered && (
          <div className="mt-6 pt-5 border-t border-zinc-800/80 space-y-4 animate-fadeIn">
            <div className="flex items-start justify-between gap-4 bg-zinc-950/70 border border-zinc-800 rounded-xl p-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      selectedOption === currentQuestion.answer
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {selectedOption === currentQuestion.answer
                      ? '✓ Correct Answer'
                      : selectedOption === null
                      ? '⌛ Time Expired'
                      : '✗ Incorrect'}
                  </span>
                  <span className="text-xs text-zinc-500">·</span>
                  <span className="text-xs text-zinc-400">
                    Option {currentQuestion.answer.toUpperCase()}: {currentQuestion.correctText}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                  {currentQuestion.explanation}
                </p>
              </div>

              {/* Spotify Link */}
              <a
                href={currentQuestion.track.spotifyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="shrink-0 p-2 text-zinc-400 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
                title="Open in Spotify"
              >
                <span>Spotify</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Next Question CTA */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <span className="text-xs text-zinc-500 hidden sm:inline">
                Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 font-mono text-[10px]">Space</kbd> or <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 font-mono text-[10px]">Enter</kbd> to continue
              </span>
              <button
                onClick={handleNext}
                className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
              >
                <span>{isLastQuestion ? 'View Final Results' : 'Next Question'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
