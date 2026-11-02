import React, { useState, useMemo } from 'react';
import { QuizQuestion, ExportConfig, ExportFormat } from '../types/quiz';
import { formatQuizData, downloadFile, copyToClipboard } from '../services/exporter';
import { GENRES } from '../data/genres';
import {
  Code2,
  Download,
  Copy,
  Check,
  FileCode,
  FileSpreadsheet,
  FileText,
  Sliders,
  ExternalLink,
  Trash2,
  Plus,
  Play,
  Music,
  Sparkles,
  Trophy,
} from 'lucide-react';

interface ExportStudioProps {
  questions: QuizQuestion[];
  onRemoveQuestion: (id: string) => void;
  onClearQuestions: () => void;
  onPlayQuiz: () => void;
  onOpenGenerator: () => void;
  onAppendQuestions?: (count: number) => void;
  onAppendGenreRound?: (genreId: string, count: number) => void;
  onRegenerateFresh?: (count: number) => void;
}

export const ExportStudio: React.FC<ExportStudioProps> = ({
  questions,
  onRemoveQuestion,
  onClearQuestions,
  onPlayQuiz,
  onOpenGenerator,
  onAppendQuestions,
  onAppendGenreRound,
  onRegenerateFresh,
}) => {
  const [format, setFormat] = useState<ExportFormat>('json-abcd');
  const [includeAudioUrl, setIncludeAudioUrl] = useState<boolean>(true);
  const [includeSpotifyUrl, setIncludeSpotifyUrl] = useState<boolean>(true);
  const [includeExplanation, setIncludeExplanation] = useState<boolean>(true);
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true);
  const [prettyPrint, setPrettyPrint] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [autoGenToast, setAutoGenToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'table' | 'guide'>('code');
  const [selectedGenreRound, setSelectedGenreRound] = useState<string>('tv-themes');

  const config: ExportConfig = useMemo(
    () => ({
      format,
      includeAudioUrl,
      includeSpotifyUrl,
      includeExplanation,
      includeMetadata,
      prettyPrint,
    }),
    [format, includeAudioUrl, includeSpotifyUrl, includeExplanation, includeMetadata, prettyPrint]
  );

  const formattedContent = useMemo(() => {
    return formatQuizData(questions, config);
  }, [questions, config]);

  const fileExtension = useMemo(() => {
    switch (format) {
      case 'json-abcd':
      case 'json-array':
      case 'opentrivia':
        return 'json';
      case 'typescript':
        return 'ts';
      case 'csv':
        return 'csv';
      case 'markdown':
        return 'md';
      default:
        return 'json';
    }
  }, [format]);

  const filename = `beatiq-spotify-quiz.${fileExtension}`;
  const fileSizeKb = (new Blob([formattedContent]).size / 1024).toFixed(1);

  const handleCopy = async () => {
    const ok = await copyToClipboard(formattedContent);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    downloadFile(filename, formattedContent, format);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6 animate-fadeIn">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Code2 className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl md:text-2xl font-bold text-zinc-50 tracking-tight">
              GitHub App Export Studio
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            Export questions in multiple formats (A, B, C, D) directly ready to import into your GitHub quiz app.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onAppendQuestions && (
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="text-[11px] font-semibold text-zinc-400 pl-2 hidden sm:flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Auto-Add:</span>
              </span>
              <button
                onClick={() => {
                  onAppendQuestions(25);
                  setAutoGenToast('+25 fresh questions auto-generated & appended!');
                  setTimeout(() => setAutoGenToast(null), 3000);
                }}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium rounded-lg transition-colors"
                title="Auto-generate 25 new questions and append to this export bundle"
              >
                +25
              </button>
              <button
                onClick={() => {
                  onAppendQuestions(50);
                  setAutoGenToast('+50 fresh questions auto-generated & appended!');
                  setTimeout(() => setAutoGenToast(null), 3000);
                }}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium rounded-lg transition-colors"
                title="Auto-generate 50 new questions and append to this export bundle"
              >
                +50
              </button>
              <button
                onClick={() => {
                  onAppendQuestions(100);
                  setAutoGenToast('+100 fresh questions auto-generated & appended!');
                  setTimeout(() => setAutoGenToast(null), 3000);
                }}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold rounded-lg transition-colors"
                title="Auto-generate 100 new questions and append to this export bundle"
              >
                +100
              </button>

              {onAppendGenreRound && (
                <div className="flex items-center gap-1 pl-1 border-l border-zinc-800">
                  <select
                    value={selectedGenreRound}
                    onChange={(e) => setSelectedGenreRound(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 text-[11px] py-1 px-1.5 focus:outline-none max-w-[130px] truncate"
                  >
                    {GENRES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      onAppendGenreRound(selectedGenreRound, 25);
                      const gName = GENRES.find((g) => g.id === selectedGenreRound)?.name || selectedGenreRound;
                      setAutoGenToast(`+25 question round for "${gName}" added!`);
                      setTimeout(() => setAutoGenToast(null), 3500);
                    }}
                    className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap"
                    title="Append a 25-question round dedicated to this specific genre"
                  >
                    +Round
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onPlayQuiz}
            disabled={questions.length === 0}
            className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Test Play Dataset</span>
          </button>
          <button
            onClick={onOpenGenerator}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl border border-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Custom Generator</span>
          </button>
        </div>
      </div>

      {/* Auto-Generate Notification Toast */}
      {autoGenToast && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{autoGenToast}</span>
            <span className="text-emerald-400/80 hidden sm:inline">· Total Questions in Bundle: {questions.length}</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">Updated in File Preview</span>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Format & Export Settings */}
        <div className="lg:col-span-4 space-y-5">
          {/* Format Selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target File Format</span>
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => setFormat('json-abcd')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  format === 'json-abcd'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <FileCode className={`w-4 h-4 mt-0.5 shrink-0 ${format === 'json-abcd' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="text-xs font-bold">JSON (Object ABCD)</div>
                  <div className="text-[11px] text-zinc-500 leading-tight">
                    options: &#123; a, b, c, d &#125; with answer: &quot;a&quot;
                  </div>
                </div>
              </button>

              <button
                onClick={() => setFormat('typescript')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  format === 'typescript'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <Code2 className={`w-4 h-4 mt-0.5 shrink-0 ${format === 'typescript' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="text-xs font-bold">TypeScript (.ts)</div>
                  <div className="text-[11px] text-zinc-500 leading-tight">
                    Fully typed QuizQuestionItem[] ready for imports
                  </div>
                </div>
              </button>

              <button
                onClick={() => setFormat('json-array')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  format === 'json-array'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <FileCode className={`w-4 h-4 mt-0.5 shrink-0 ${format === 'json-array' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="text-xs font-bold">JSON (Array Format)</div>
                  <div className="text-[11px] text-zinc-500 leading-tight">
                    options: [&quot;A&quot;, &quot;B&quot;, &quot;C&quot;, &quot;D&quot;] with answerIndex: 0
                  </div>
                </div>
              </button>

              <button
                onClick={() => setFormat('opentrivia')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  format === 'opentrivia'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <FileCode className={`w-4 h-4 mt-0.5 shrink-0 ${format === 'opentrivia' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="text-xs font-bold">OpenTrivia / Kahoot Style</div>
                  <div className="text-[11px] text-zinc-500 leading-tight">
                    correct_answer with incorrect_answers array
                  </div>
                </div>
              </button>

              <button
                onClick={() => setFormat('csv')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  format === 'csv'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 mt-0.5 shrink-0 ${format === 'csv' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="text-xs font-bold">CSV Spreadsheet (.csv)</div>
                  <div className="text-[11px] text-zinc-500 leading-tight">
                    Clean row-per-question format for databases/Excel
                  </div>
                </div>
              </button>

              <button
                onClick={() => setFormat('markdown')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  format === 'markdown'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${format === 'markdown' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="text-xs font-bold">Markdown (.md)</div>
                  <div className="text-[11px] text-zinc-500 leading-tight">
                    Collapsible trivia cards for GitHub READMEs
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Schema Field Toggles */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Include Fields
            </h3>

            <div className="space-y-2.5 text-xs text-zinc-300">
              <label className="flex items-center gap-2.5 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeAudioUrl}
                  onChange={(e) => setIncludeAudioUrl(e.target.checked)}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-400/20 bg-zinc-950"
                />
                <span>Audio Preview URLs (30s streams)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeSpotifyUrl}
                  onChange={(e) => setIncludeSpotifyUrl(e.target.checked)}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-400/20 bg-zinc-950"
                />
                <span>Spotify Track Links</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeExplanation}
                  onChange={(e) => setIncludeExplanation(e.target.checked)}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-400/20 bg-zinc-950"
                />
                <span>Trivia Explanations</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-400/20 bg-zinc-950"
                />
                <span>Track Metadata (Genre, Year, Album, Art)</span>
              </label>

              {(format === 'json-abcd' || format === 'json-array') && (
                <label className="flex items-center gap-2.5 cursor-pointer hover:text-zinc-100 pt-1 border-t border-zinc-800">
                  <input
                    type="checkbox"
                    checked={prettyPrint}
                    onChange={(e) => setPrettyPrint(e.target.checked)}
                    className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-400/20 bg-zinc-950"
                  />
                  <span>Pretty Print (2-space indent)</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Code Preview & File Actions */}
        <div className="lg:col-span-8 space-y-4">
          {/* Top Bar for Code Box */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-lg">
              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'code'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                File Preview
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'table'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Question List ({questions.length})
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'guide'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                GitHub Setup Guide
              </button>
            </div>

            {/* Quick Actions: Download & Copy */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500 tabular-nums hidden sm:inline">
                {fileSizeKb} KB · {questions.length} items
              </span>

              <button
                onClick={handleCopy}
                disabled={questions.length === 0}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>

              <button
                onClick={handleDownload}
                disabled={questions.length === 0}
                className="px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {filename}</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Live Code Box */}
          {activeTab === 'code' && (
            <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden font-mono text-xs">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 text-[11px]">
                <span className="font-semibold text-zinc-300">{filename}</span>
                <span>UTF-8 · {fileExtension.toUpperCase()}</span>
              </div>
              <div className="p-4 max-h-[540px] overflow-auto leading-relaxed text-zinc-300 selection:bg-emerald-500/20">
                <pre className="whitespace-pre">{formattedContent}</pre>
              </div>
            </div>
          )}

          {/* Tab 2: Question List Table */}
          {activeTab === 'table' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-hidden space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-2">
                <span>Manage questions in this export bundle</span>
                <button
                  onClick={onClearQuestions}
                  className="text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="divide-y divide-zinc-800/80 max-h-[500px] overflow-auto">
                {questions.map((q, idx) => (
                  <div key={q.id} className="py-3 px-2 flex items-start justify-between gap-3 hover:bg-zinc-950/40 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          #{idx + 1}
                        </span>
                        {q.roundName && (
                          <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                            {q.roundName}
                          </span>
                        )}
                        <span className="text-xs text-zinc-400">{q.genreName}</span>
                        <span aria-hidden="true" className="text-zinc-700">·</span>
                        <span className="text-[11px] text-zinc-500 uppercase font-mono">
                          Answer: {q.answer} ({q.correctText})
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-200">
                        {q.prompt}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-1 font-mono">
                        <div>A: {q.options.a}</div>
                        <div>B: {q.options.b}</div>
                        <div>C: {q.options.c}</div>
                        <div>D: {q.options.d}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveQuestion(q.id)}
                      className="p-1 text-zinc-500 hover:text-rose-400 transition-colors rounded shrink-0"
                      title="Remove question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: GitHub App Integration Guide */}
          {activeTab === 'guide' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 text-sm text-zinc-300">
              <h3 className="text-base font-bold text-zinc-100">
                How to Load This Dataset Into Your GitHub Quiz App
              </h3>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-emerald-400">Option 1: Drop directly into your project</h4>
                  <p className="text-zinc-400">
                    Download <code className="text-emerald-300 font-mono">beatiq-spotify-quiz.json</code> and save it in your project&apos;s <code className="text-emerald-300 font-mono">src/data/questions.json</code>.
                  </p>
                  <pre className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-zinc-300 overflow-x-auto">
{`// In your React / Vue / Vanilla JS quiz app:
import questions from './data/questions.json';

function getNextQuestion(index) {
  return questions[index];
}

console.log(questions[0].options.a); // First option`}</pre>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-emerald-400">Option 2: Fetch directly from your GitHub repository</h4>
                  <p className="text-zinc-400">
                    Commit the file to your GitHub repo and fetch via raw GitHub user content URL:
                  </p>
                  <pre className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-zinc-300 overflow-x-auto">
{`// Live fetch in any web application:
const GITHUB_RAW_URL = 
  'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/quiz-data.json';

async function loadQuestions() {
  const response = await fetch(GITHUB_RAW_URL);
  const quizData = await response.json();
  return quizData;
}`}</pre>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-emerald-400">Option 3: TypeScript with full types</h4>
                  <p className="text-zinc-400">
                    Export as TypeScript (.ts) and copy into <code className="text-emerald-300 font-mono">src/data/quizQuestions.ts</code>:
                  </p>
                  <pre className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-zinc-300 overflow-x-auto">
{`import { QUIZ_QUESTIONS, QuizQuestionItem } from './data/quizQuestions';

const randomQuestion: QuizQuestionItem = 
  QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];`}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
