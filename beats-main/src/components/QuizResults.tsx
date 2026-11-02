import React from 'react';
import { GameSummary, QuizQuestion } from '../types/quiz';
import { Trophy, Flame, CheckCircle2, XCircle, RotateCcw, Code2, PlusCircle, ExternalLink } from 'lucide-react';

interface QuizResultsProps {
  summary: GameSummary;
  questions: QuizQuestion[];
  onPlayAgain: () => void;
  onOpenExport: () => void;
  onOpenGenerator: () => void;
}

export const QuizResults: React.FC<QuizResultsProps> = ({
  summary,
  questions,
  onPlayAgain,
  onOpenExport,
  onOpenGenerator,
}) => {
  let grade = 'C';
  let gradeColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  let tagline = 'Good effort! Practice makes perfect.';

  if (summary.accuracy === 100) {
    grade = 'S+';
    gradeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    tagline = 'Flawless Ear! True Music Savant!';
  } else if (summary.accuracy >= 80) {
    grade = 'A';
    gradeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    tagline = 'Sensational knowledge! Top-tier music brain.';
  } else if (summary.accuracy >= 60) {
    grade = 'B';
    gradeColor = 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10';
    tagline = 'Solid performance across the board!';
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-fadeIn">
      {/* Hero Score Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center font-extrabold ${gradeColor}`}>
            <span className="text-3xl font-mono">{grade}</span>
            <span className="text-[10px] font-mono uppercase tracking-wider">Rank</span>
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-50 tracking-tight">
            Quiz Completed!
          </h2>
          <p className="text-sm text-zinc-400">{tagline}</p>
        </div>

        {/* 4-Stat Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-xs text-zinc-500 block mb-1">Final Score</span>
            <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
              {summary.score.toLocaleString()}
            </span>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-xs text-zinc-500 block mb-1">Accuracy</span>
            <span className="text-xl font-bold font-mono text-zinc-100 tabular-nums">
              {summary.accuracy}%
            </span>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-xs text-zinc-500 block mb-1">Best Streak</span>
            <span className="text-xl font-bold font-mono text-amber-400 tabular-nums flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 fill-current" />
              {summary.bestStreak}
            </span>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-xs text-zinc-500 block mb-1">Total Time</span>
            <span className="text-xl font-bold font-mono text-zinc-100 tabular-nums">
              {summary.totalTimeSeconds}s
            </span>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            onClick={onPlayAgain}
            className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <button
            onClick={onOpenExport}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold text-sm rounded-xl transition-all flex items-center gap-2"
          >
            <Code2 className="w-4 h-4 text-emerald-400" />
            <span>Export Quiz Dataset for GitHub</span>
          </button>

          <button
            onClick={onOpenGenerator}
            className="px-4 py-2.5 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Customize Question Pool</span>
          </button>
        </div>
      </div>

      {/* Question Review Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-100">
            Question Breakdown ({summary.correctAnswers}/{summary.totalQuestions} Correct)
          </h3>
          <span className="text-xs text-zinc-500">
            {summary.answers.length} answered
          </span>
        </div>

        <div className="divide-y divide-zinc-800/80">
          {questions.map((q, idx) => {
            const userAnswer = summary.answers.find((a) => a.questionId === q.id);
            const isCorrect = userAnswer?.isCorrect ?? false;
            const pickedOption = userAnswer?.selectedOption;

            return (
              <div key={q.id} className="py-3.5 space-y-2 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">
                        {idx + 1}. {q.prompt}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                        <span>Correct: <b className="text-emerald-400 uppercase font-mono">{q.answer}</b> ({q.correctText})</span>
                        {pickedOption && !isCorrect && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-rose-400">You picked: <b className="uppercase font-mono">{pickedOption}</b> ({q.options[pickedOption]})</span>
                          </>
                        )}
                        {!pickedOption && !isCorrect && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-400">Timed out</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <a
                    href={q.track.spotifyUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-zinc-500 hover:text-emerald-400 flex items-center gap-1 shrink-0 p-1"
                  >
                    <span>Spotify</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
