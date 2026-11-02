import React, { useState, useMemo } from 'react';
import { GenreId, GenreCategory, QuestionType, QuizSettings, Track, QuizQuestion } from '../types/quiz';
import { GENRES, CATEGORY_LABELS } from '../data/genres';
import { CURATED_TRACKS } from '../data/curatedTracks';
import { generateQuiz, generateRoundForGenre, generateMultiRoundTournament } from '../services/quizGenerator';
import { spotifyApi } from '../services/spotifyApi';
import {
  Sparkles,
  Search,
  ListMusic,
  Check,
  Play,
  Code2,
  Sliders,
  Radio,
  HelpCircle,
  AlertCircle,
  Trophy,
  Layers,
  Filter,
} from 'lucide-react';

interface QuizGeneratorViewProps {
  onQuestionsGenerated: (questions: QuizQuestion[]) => void;
  onPlayQuestions: (questions: QuizQuestion[]) => void;
  onNavigateToExport: () => void;
  onAppendQuestions?: (questions: QuizQuestion[]) => void;
}

export const QuizGeneratorView: React.FC<QuizGeneratorViewProps> = ({
  onQuestionsGenerated,
  onPlayQuestions,
  onNavigateToExport,
  onAppendQuestions,
}) => {
  const [selectedGenres, setSelectedGenres] = useState<GenreId[]>([
    'pop',
    'classic-rock',
    'grunge-90s',
    'hip-hop',
    'electronic-edm',
    'synthpop-80s',
  ]);
  const [activeCategoryTab, setActiveCategoryTab] = useState<GenreCategory | 'all'>('all');
  const [genreSearch, setGenreSearch] = useState<string>('');
  const [selectedRoundGenre, setSelectedRoundGenre] = useState<GenreId>('video-game');
  const [roundQuestionCount, setRoundQuestionCount] = useState<number>(25);

  const [questionCount, setQuestionCount] = useState<number>(10);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([
    'guess-artist',
    'guess-title',
    'guess-year',
    'guess-album',
    'blind-audio',
  ]);
  const [timeLimit, setTimeLimit] = useState<number>(25);
  const [spotifySearchQuery, setSpotifySearchQuery] = useState<string>('');
  const [playlistUrl, setPlaylistUrl] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [customTracks, setCustomTracks] = useState<Track[]>([]);

  // Filter genres by category & search
  const filteredGenres = useMemo(() => {
    return GENRES.filter((g) => {
      const matchesCategory = activeCategoryTab === 'all' || g.category === activeCategoryTab;
      const matchesSearch = !genreSearch.trim() ||
        g.name.toLowerCase().includes(genreSearch.toLowerCase()) ||
        g.description.toLowerCase().includes(genreSearch.toLowerCase()) ||
        g.era.toLowerCase().includes(genreSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategoryTab, genreSearch]);

  // Toggle Genre
  const toggleGenre = (genreId: GenreId) => {
    if (selectedGenres.includes(genreId)) {
      if (selectedGenres.length > 1) {
        setSelectedGenres(selectedGenres.filter((g) => g !== genreId));
      }
    } else {
      setSelectedGenres([...selectedGenres, genreId]);
    }
  };

  const handleSelectAllGenres = () => {
    setSelectedGenres(GENRES.map((g) => g.id));
  };

  const handleSelectCategory = (category: GenreCategory) => {
    const ids = GENRES.filter((g) => g.category === category).map((g) => g.id);
    setSelectedGenres(ids);
  };

  // 1-Click Round Generator for any specific genre
  const handleGenerateRound = (genreId: GenreId, count: number, andPlay: boolean = false) => {
    const pool = customTracks.length > 0 ? [...customTracks, ...CURATED_TRACKS] : CURATED_TRACKS;
    const newQuestions = generateRoundForGenre(pool, genreId, count);
    onQuestionsGenerated(newQuestions);
    if (andPlay) {
      onPlayQuestions(newQuestions);
    } else {
      onNavigateToExport();
    }
  };

  // 1-Click Multi-Round Tournament Generator (5 or 10 Rounds across genres)
  const handleGenerateTournament = (numRounds: 5 | 10 | 28, andPlay: boolean = false) => {
    const pool = customTracks.length > 0 ? [...customTracks, ...CURATED_TRACKS] : CURATED_TRACKS;

    let roundsConfig: { genreId: GenreId; roundName: string; count: number }[] = [];

    if (numRounds === 5) {
      roundsConfig = [
        { genreId: 'movie-themes', roundName: 'Round 1: Blockbuster Movie Themes', count: 10 },
        { genreId: 'video-game', roundName: 'Round 2: Legendary Video Game Soundtracks', count: 10 },
        { genreId: 'classic-rock', roundName: 'Round 3: Classic Rock Anthems', count: 10 },
        { genreId: 'synthpop-80s', roundName: 'Round 4: 80s Synthpop & Retro Neon', count: 10 },
        { genreId: 'motown-soul', roundName: 'Round 5: Motown & Classic Soul', count: 10 },
      ];
    } else if (numRounds === 10) {
      roundsConfig = [
        { genreId: 'tv-themes', roundName: 'Round 1: Iconic TV Show Themes', count: 10 },
        { genreId: 'movie-themes', roundName: 'Round 2: Hollywood Film Scores', count: 10 },
        { genreId: 'disney-pixar', roundName: 'Round 3: Disney & Pixar Magic', count: 10 },
        { genreId: 'video-game', roundName: 'Round 4: Video Game OSTs', count: 10 },
        { genreId: 'anime-ost', roundName: 'Round 5: Anime Openings & OSTs', count: 10 },
        { genreId: 'broadway-musicals', roundName: 'Round 6: Broadway Showstoppers', count: 10 },
        { genreId: 'classic-rock', roundName: 'Round 7: Classic Rock & Riffs', count: 10 },
        { genreId: 'dance-eurodance', roundName: 'Round 8: 90s & 2000s Eurodance', count: 10 },
        { genreId: 'hip-hop', roundName: 'Round 9: Golden Age & Modern Hip-Hop', count: 10 },
        { genreId: 'disco-funk', roundName: 'Round 10: 70s & 80s Disco & Funk', count: 10 },
      ];
    } else {
      // 28 Genres Mega Pack (5 Qs each = 140 Questions)
      roundsConfig = GENRES.map((g, idx) => ({
        genreId: g.id,
        roundName: `Round ${idx + 1}: ${g.name}`,
        count: 5,
      }));
    }

    const newQuestions = generateMultiRoundTournament(pool, roundsConfig);
    onQuestionsGenerated(newQuestions);
    if (andPlay) {
      onPlayQuestions(newQuestions);
    } else {
      onNavigateToExport();
    }
  };

  // Toggle Question Type
  const toggleType = (type: QuestionType) => {
    if (questionTypes.includes(type)) {
      if (questionTypes.length > 1) {
        setQuestionTypes(questionTypes.filter((t) => t !== type));
      }
    } else {
      setQuestionTypes([...questionTypes, type]);
    }
  };

  // Run Generation
  const handleGenerate = (andPlay: boolean = false) => {
    const pool = customTracks.length > 0 ? [...customTracks, ...CURATED_TRACKS] : CURATED_TRACKS;
    const settings: QuizSettings = {
      selectedGenres,
      questionCount,
      questionTypes,
      timeLimitSeconds: timeLimit,
      difficulty: 'all',
      enableAudio: true,
      enableSoundEffects: true,
    };

    const newQuestions = generateQuiz(pool, settings);
    onQuestionsGenerated(newQuestions);

    if (andPlay) {
      onPlayQuestions(newQuestions);
    } else {
      onNavigateToExport();
    }
  };

  // Auto-Generate and Append without replacing existing questions
  const handleGenerateAndAppend = () => {
    const pool = customTracks.length > 0 ? [...customTracks, ...CURATED_TRACKS] : CURATED_TRACKS;
    const settings: QuizSettings = {
      selectedGenres,
      questionCount,
      questionTypes,
      timeLimitSeconds: timeLimit,
      difficulty: 'all',
      enableAudio: true,
      enableSoundEffects: true,
    };
    const newQuestions = generateQuiz(pool, settings);
    if (onAppendQuestions) {
      onAppendQuestions(newQuestions);
    } else {
      onQuestionsGenerated(newQuestions);
    }
    onNavigateToExport();
  };

  // Spotify Live Search
  const handleSpotifySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spotifySearchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      const results = await spotifyApi.searchTracks(spotifySearchQuery, selectedGenres[0] || 'pop', 15);
      if (results.length > 0) {
        setCustomTracks((prev) => [...results, ...prev]);
        setSearchSuccess(`Added ${results.length} tracks from query "${spotifySearchQuery}"`);
        setSpotifySearchQuery('');
      } else {
        setSearchError('No tracks found for that search query.');
      }
    } catch (err) {
      setSearchError((err as Error).message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Import Playlist
  const handleImportPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistUrl.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      const results = await spotifyApi.fetchPlaylistTracks(playlistUrl, selectedGenres[0] || 'pop');
      if (results.length > 0) {
        setCustomTracks((prev) => [...results, ...prev]);
        setSearchSuccess(`Imported ${results.length} tracks from playlist!`);
        setPlaylistUrl('');
      } else {
        setSearchError('Playlist appears empty or could not be loaded.');
      }
    } catch (err) {
      setSearchError((err as Error).message || 'Playlist import failed');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8 animate-fadeIn">
      {/* Top Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl md:text-2xl font-bold text-zinc-50 tracking-tight">
              Spotify Music Quiz &amp; Round Generator
            </h1>
          </div>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Generate balanced multiple choice questions with plausible ABCD options across 28 diverse genres.
            Includes 1-click round bundles for TV themes, movie scores, gaming OSTs, anime, soul, rock, and pub quiz tournaments.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleGenerate(false)}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs rounded-xl transition-colors flex items-center gap-2"
          >
            <Code2 className="w-4 h-4 text-emerald-400" />
            <span>Generate &amp; Export</span>
          </button>
          <button
            onClick={() => handleGenerate(true)}
            className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-xs rounded-xl transition-colors shadow-md shadow-emerald-500/20 flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Generate &amp; Play Now</span>
          </button>
        </div>
      </div>

      {/* ALL-GENRE ROUND & MULTI-ROUND TOURNAMENT STUDIO */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>1-Click Round &amp; Pub Quiz Tournament Generator</span>
                <span className="text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  All 28 Genres Supported
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Instantly generate dedicated standalone rounds or multi-round pub quiz competitions ready for GitHub export.
              </p>
            </div>
          </div>

          {/* Mega Tournament 1-Click Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleGenerateTournament(5, false)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              title="Generate a 5-Round Pub Quiz (50 Qs across 5 genres)"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>5 Themed Rounds (50 Qs)</span>
            </button>
            <button
              onClick={() => handleGenerateTournament(10, false)}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold rounded-xl transition-colors shadow-sm shadow-amber-400/20 flex items-center gap-1.5"
              title="Generate a full 10-Round Tournament (100 Qs across 10 genres)"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>10-Round Tournament (100 Qs)</span>
            </button>
          </div>
        </div>

        {/* Quick Genre Round Builder Bar */}
        <div className="p-4 bg-zinc-950/90 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-semibold">Generate Single-Genre Round:</span>
              <select
                value={selectedRoundGenre}
                onChange={(e) => setSelectedRoundGenre(e.target.value as GenreId)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
              >
                {GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.era})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-mono">Round Size:</span>
              {[10, 25, 50, 100].map((count) => (
                <button
                  key={count}
                  onClick={() => setRoundQuestionCount(count)}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md border transition-colors ${
                    roundQuestionCount === count
                      ? 'bg-emerald-400 text-zinc-950 border-emerald-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {count} Qs
                </button>
              ))}

              <button
                onClick={() => handleGenerateRound(selectedRoundGenre, roundQuestionCount, false)}
                className="px-3.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ml-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Build Round</span>
              </button>
            </div>
          </div>

          {/* Quick Round Launch Cards for Popular Themes & Genres */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
            {[
              { id: 'tv-themes' as GenreId, label: '📺 TV Themes', color: 'amber' },
              { id: 'movie-themes' as GenreId, label: '🎬 Movie Themes', color: 'rose' },
              { id: 'video-game' as GenreId, label: '🎮 Video Game OST', color: 'emerald' },
              { id: 'anime-ost' as GenreId, label: '🌸 Anime Openings', color: 'fuchsia' },
              { id: 'disney-pixar' as GenreId, label: '🏰 Disney & Pixar', color: 'sky' },
              { id: 'motown-soul' as GenreId, label: '🎷 Motown Soul', color: 'amber' },
              { id: 'broadway-musicals' as GenreId, label: '🎭 Broadway', color: 'rose' },
              { id: 'cartoon-themes' as GenreId, label: '⚡ Cartoon Classics', color: 'yellow' },
              { id: 'classic-rock' as GenreId, label: '🎸 Classic Rock', color: 'amber' },
              { id: 'synthpop-80s' as GenreId, label: '✨ 80s Synthpop', color: 'indigo' },
              { id: 'dance-eurodance' as GenreId, label: '🔊 Eurodance Club', color: 'teal' },
              { id: 'disco-funk' as GenreId, label: '🪩 Disco & Funk', color: 'yellow' },
              { id: 'hip-hop' as GenreId, label: '🎤 Hip-Hop & Rap', color: 'purple' },
              { id: 'folk-acoustic' as GenreId, label: '🪕 Folk & Acoustic', color: 'emerald' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleGenerateRound(item.id, 25, false)}
                className="p-2 bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-left rounded-lg transition-colors group"
                title={`Generate 25-question round for ${item.label}`}
              >
                <div className="text-xs font-semibold text-zinc-300 group-hover:text-emerald-300 truncate">
                  {item.label}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  1-Click Round (25 Qs)
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Genre Selection Grid (28 genres) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <span>Music Genre Selection</span>
                  <span className="text-xs font-mono font-normal text-zinc-400">
                    ({selectedGenres.length}/{GENRES.length} active)
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Multiple choice distractors are curated strictly from within each genre
                </p>
              </div>

              {/* Quick Select Presets */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={handleSelectAllGenres}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  All ({GENRES.length})
                </button>
                <button
                  onClick={() => handleSelectCategory('screen-gaming')}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  Screen &amp; OSTs
                </button>
                <button
                  onClick={() => handleSelectCategory('rock-metal')}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  Rock
                </button>
                <button
                  onClick={() => handleSelectCategory('urban-soul')}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Soul &amp; Groove
                </button>
              </div>
            </div>

            {/* Category Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-zinc-800/80">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs">
                <button
                  onClick={() => setActiveCategoryTab('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    activeCategoryTab === 'all'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All ({GENRES.length})
                </button>
                {(Object.keys(CATEGORY_LABELS) as GenreCategory[]).map((cat) => {
                  const count = GENRES.filter((g) => g.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategoryTab(cat)}
                      className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                        activeCategoryTab === cat
                          ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Genre Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter genres..."
                  value={genreSearch}
                  onChange={(e) => setGenreSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none w-full sm:w-44"
                />
              </div>
            </div>

            {/* Genre Pills Grid (28 Genres) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 max-h-[460px] overflow-y-auto pr-1">
              {filteredGenres.map((genre) => {
                const isSelected = selectedGenres.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    onClick={() => toggleGenre(genre.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-200 ring-1 ring-emerald-500/40'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-emerald-400 border-emerald-400 text-zinc-950'
                          : 'border-zinc-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {genre.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {genre.era}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Spotify Search & Playlist Import */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-bold text-zinc-100">
                Live Spotify Query &amp; Playlist Loader
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Query any artist or song on Spotify to inject tracks with real previews into the generator dataset.
            </p>

            <form onSubmit={handleSpotifySearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search artist or track (e.g. Queen, Daft Punk, Drake)..."
                  value={spotifySearchQuery}
                  onChange={(e) => setSpotifySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !spotifySearchQuery.trim()}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors shrink-0"
              >
                {isSearching ? 'Searching...' : 'Add Tracks'}
              </button>
            </form>

            <form onSubmit={handleImportPlaylist} className="flex gap-2 pt-1">
              <div className="relative flex-1">
                <ListMusic className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Paste public Spotify Playlist URL (e.g. https://open.spotify.com/playlist/...)"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !playlistUrl.trim()}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors shrink-0"
              >
                Import
              </button>
            </form>

            {searchSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
                ✓ {searchSuccess}
              </div>
            )}

            {searchError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quiz Rules & Format Settings */}
        <div className="lg:col-span-5 space-y-5">
          {/* Question Types */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Question Types</span>
            </h2>

            <div className="space-y-2.5">
              {[
                {
                  id: 'guess-artist' as QuestionType,
                  title: 'Guess the Artist / Composer',
                  desc: 'Who composed or recorded the song? (Plausible distractors from same genre)',
                },
                {
                  id: 'guess-title' as QuestionType,
                  title: 'Guess the Song / Theme Title',
                  desc: 'Identify the song title without the prompt giving it away',
                },
                {
                  id: 'guess-year' as QuestionType,
                  title: 'Guess the Release Year',
                  desc: 'In what year was the song or soundtrack released? (Plausible ±2-5 years)',
                },
                {
                  id: 'guess-album' as QuestionType,
                  title: 'Guess the Album / Franchise',
                  desc: 'Which album, franchise, or score features the track?',
                },
                {
                  id: 'blind-audio' as QuestionType,
                  title: 'Blind Audio Snippet Test',
                  desc: 'Audio plays with title hidden. Player identifies track & artist.',
                },
              ].map((item) => {
                const isSelected = questionTypes.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleType(item.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-zinc-950/80 border-emerald-500/60 text-zinc-200'
                        : 'bg-zinc-950/40 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-emerald-400 border-emerald-400 text-zinc-950'
                          : 'border-zinc-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-200 leading-snug">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 leading-tight mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Counts & Timers */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Quiz Parameters</span>
            </h2>

            {/* Question Count */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Number of Questions</span>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  {questionCount} questions
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {[10, 25, 50, 100, 200, 500].map((num) => (
                  <button
                    key={num}
                    onClick={() => setQuestionCount(num)}
                    className={`py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all ${
                      questionCount === num
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Limit */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Time Per Question</span>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  {timeLimit === 0 ? 'Untimed' : `${timeLimit} seconds`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Untimed', val: 0 },
                  { label: '15s', val: 15 },
                  { label: '25s', val: 25 },
                  { label: '40s', val: 40 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setTimeLimit(item.val)}
                    className={`py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all ${
                      timeLimit === item.val
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Big Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => handleGenerate(true)}
                className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Generate &amp; Launch Quiz ({questionCount} Qs)</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleGenerateAndAppend}
                  className="py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  title="Auto-generate and add to current export bundle without overwriting"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Append (+{questionCount})</span>
                </button>
                <button
                  onClick={() => handleGenerate(false)}
                  className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  title="Generate new question set and view in GitHub Export Studio"
                >
                  <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export ({questionCount} Qs)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
