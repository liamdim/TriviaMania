export type GenreId =
  | 'pop'
  | 'classic-rock'
  | 'alt-indie'
  | 'grunge-90s'
  | 'hip-hop'
  | 'r-and-b'
  | 'electronic-edm'
  | 'synthpop-80s'
  | 'heavy-metal'
  | 'jazz-blues'
  | 'classical'
  | 'latin-reggaeton'
  | 'country'
  | 'k-pop'
  | 'pop-punk'
  | 'y2k-2000s'
  | 'tv-themes'
  | 'movie-themes'
  | 'disney-pixar'
  | 'cartoon-themes'
  | 'video-game'
  | 'anime-ost'
  | 'motown-soul'
  | 'disco-funk'
  | 'broadway-musicals'
  | 'dance-eurodance'
  | 'reggae-ska'
  | 'folk-acoustic';

export type GenreCategory =
  | 'screen-gaming'
  | 'rock-metal'
  | 'pop-dance'
  | 'urban-soul'
  | 'classics-roots';

export interface Genre {
  id: GenreId;
  name: string;
  description: string;
  iconName: string;
  era: string;
  color: string;
  category: GenreCategory;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  genre: GenreId;
  previewUrl?: string;
  spotifyUrl: string;
  albumArt?: string;
  popularity?: number;
}

export type QuestionType =
  | 'guess-artist'
  | 'guess-title'
  | 'guess-year'
  | 'guess-album'
  | 'blind-audio';

export type OptionKey = 'a' | 'b' | 'c' | 'd';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  answer: OptionKey;
  correctText: string;
  explanation: string;
  genre: GenreId;
  genreName: string;
  roundName?: string;
  roundNumber?: number;
  track: Track;
  difficulty: 'easy' | 'medium' | 'hard';
}

export type ExportFormat = 'json-abcd' | 'json-array' | 'opentrivia' | 'typescript' | 'csv' | 'markdown';

export interface ExportConfig {
  format: ExportFormat;
  includeAudioUrl: boolean;
  includeSpotifyUrl: boolean;
  includeExplanation: boolean;
  includeMetadata: boolean;
  prettyPrint: boolean;
}

export interface QuizSettings {
  selectedGenres: GenreId[];
  questionCount: number;
  questionTypes: QuestionType[];
  timeLimitSeconds: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'all';
  enableAudio: boolean;
  enableSoundEffects: boolean;
}

export interface UserAnswer {
  questionId: string;
  selectedOption: OptionKey | null;
  isCorrect: boolean;
  timeSpentMs: number;
}

export interface GameSummary {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  bestStreak: number;
  totalTimeSeconds: number;
  answers: UserAnswer[];
}
