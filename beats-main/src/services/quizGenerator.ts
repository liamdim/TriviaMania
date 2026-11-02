import {
  Track,
  QuizQuestion,
  QuestionType,
  OptionKey,
  QuizSettings,
  GenreId,
} from '../types/quiz';
import { CURATED_TRACKS, GENRE_DISTRACTORS } from '../data/curatedTracks';
import { GENRE_MAP } from '../data/genres';

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate 3 plausible, era-appropriate, genre-matching distractors
 */
function getPlausibleDistractors(
  targetTrack: Track,
  questionType: QuestionType,
  allTracks: Track[]
): string[] {
  const genreId = targetTrack.genre;
  const distractorData = GENRE_DISTRACTORS[genreId] || GENRE_DISTRACTORS.pop;

  // Same-genre track pool from current dataset
  const sameGenreTracks = allTracks.filter(
    (t) => t.genre === genreId && t.id !== targetTrack.id
  );

  switch (questionType) {
    case 'guess-artist': {
      const candidateArtists = new Set<string>();
      sameGenreTracks.forEach((t) => {
        if (t.artist !== targetTrack.artist) {
          candidateArtists.add(t.artist);
        }
      });
      distractorData.artists.forEach((a) => {
        if (a !== targetTrack.artist) {
          candidateArtists.add(a);
        }
      });

      const pool = Array.from(candidateArtists);
      return shuffle(pool).slice(0, 3);
    }

    case 'guess-title': {
      const candidateTitles = new Set<string>();
      sameGenreTracks.forEach((t) => {
        if (t.title !== targetTrack.title) {
          candidateTitles.add(t.title);
        }
      });
      distractorData.titles.forEach((t) => {
        if (t !== targetTrack.title) {
          candidateTitles.add(t);
        }
      });

      const pool = Array.from(candidateTitles);
      return shuffle(pool).slice(0, 3);
    }

    case 'blind-audio': {
      // Pairs of "Song Title — Artist" from same genre
      const candidateCombos = new Set<string>();
      sameGenreTracks.forEach((t) => {
        const combo = `${t.title} — ${t.artist}`;
        if (t.id !== targetTrack.id) {
          candidateCombos.add(combo);
        }
      });

      // Synthesize from genre distractors if needed
      for (let i = 0; i < distractorData.titles.length; i++) {
        const art = distractorData.artists[i % distractorData.artists.length];
        const tit = distractorData.titles[i];
        const combo = `${tit} — ${art}`;
        candidateCombos.add(combo);
      }

      const pool = Array.from(candidateCombos).filter(
        (c) => c !== `${targetTrack.title} — ${targetTrack.artist}`
      );
      return shuffle(pool).slice(0, 3);
    }

    case 'guess-album': {
      const candidateAlbums = new Set<string>();
      sameGenreTracks.forEach((t) => {
        if (t.album !== targetTrack.album) {
          candidateAlbums.add(t.album);
        }
      });
      distractorData.albums.forEach((alb) => {
        if (alb !== targetTrack.album) {
          candidateAlbums.add(alb);
        }
      });

      const pool = Array.from(candidateAlbums);
      return shuffle(pool).slice(0, 3);
    }

    case 'guess-year': {
      const y = targetTrack.year;
      // Realistic chronological offsets (±1 to ±5 years)
      const offsets = [-4, -3, -2, -1, 1, 2, 3, 4, 5];
      const shuffledOffsets = shuffle(offsets);
      const chosenYears: number[] = [];

      for (const offset of shuffledOffsets) {
        const candidateYear = y + offset;
        if (candidateYear > 1950 && candidateYear <= new Date().getFullYear()) {
          chosenYears.push(candidateYear);
        }
        if (chosenYears.length >= 3) break;
      }

      while (chosenYears.length < 3) {
        chosenYears.push(y + (chosenYears.length + 1) * 2);
      }

      return chosenYears.map(String);
    }

    default:
      return ['Option B', 'Option C', 'Option D'];
  }
}

/**
 * Build a multiple choice question with options A, B, C, D
 * GUARANTEED: The answer is NEVER in the question prompt!
 */
export function buildQuestion(
  track: Track,
  preferredType: QuestionType,
  allTracks: Track[],
  index: number
): QuizQuestion {
  let prompt = '';
  let correctValue = '';
  let explanation = '';

  const isTheme = ['tv-themes', 'movie-themes', 'disney-pixar', 'cartoon-themes'].includes(track.genre);

  switch (preferredType) {
    case 'guess-artist':
      if (track.genre === 'tv-themes') {
        prompt = `📺 Listen to this TV theme: Which composer or artist wrote/performed this theme music?`;
      } else if (track.genre === 'movie-themes') {
        prompt = `🎬 Listen to this film score: Which legendary composer wrote this soundtrack?`;
      } else if (track.genre === 'disney-pixar') {
        prompt = `🏰 Disney & Pixar Challenge: Which artist or vocalist sang this magical theme?`;
      } else if (track.genre === 'cartoon-themes') {
        prompt = `⚡ Cartoon Classics: Which artist or band performed this animated theme song?`;
      } else if (track.genre === 'video-game') {
        prompt = `🎮 Video Game OST: Which composer or game audio director created this game music?`;
      } else if (track.genre === 'anime-ost') {
        prompt = `🌸 Anime OST: Which artist, band, or composer performed this anime opening/theme?`;
      } else if (track.genre === 'broadway-musicals') {
        prompt = `🎭 Broadway & Theatre: Which Broadway performer or musical composer created this?`;
      } else if (track.genre === 'motown-soul') {
        prompt = `🎷 Motown & Soul: Which legendary soul singer or group recorded this classic?`;
      } else if (track.genre === 'disco-funk') {
        prompt = `✨ Disco & Funk: Which groovy disco band or funk pioneer performed this hit?`;
      } else if (track.genre === 'dance-eurodance') {
        prompt = `🔊 Eurodance Club: Which 90s/00s dance group or producer made this club anthem?`;
      } else if (track.genre === 'reggae-ska') {
        prompt = `🌴 Reggae & Ska: Which reggae legend or ska band performed this track?`;
      } else if (track.genre === 'folk-acoustic') {
        prompt = `🪕 Acoustic & Folk: Which singer-songwriter or acoustic artist recorded this?`;
      } else {
        prompt = `🎧 Listen to the snippet: Which artist or band performed this track?`;
      }
      correctValue = track.artist;
      explanation = `"${track.title}" was created by ${track.artist}, featured on "${track.album}" (${track.year}).`;
      break;

    case 'guess-title':
      if (track.genre === 'tv-themes') {
        prompt = `📺 Listen to this TV opening theme: Which famous television show is this from?`;
      } else if (track.genre === 'movie-themes') {
        prompt = `🎬 Listen to this soundtrack: What is the title of this movie theme?`;
      } else if (track.genre === 'disney-pixar') {
        prompt = `🏰 Disney & Pixar Challenge: What is the title of this iconic animated song?`;
      } else if (track.genre === 'cartoon-themes') {
        prompt = `⚡ Cartoon Classics: What is the title of this animated series theme song?`;
      } else if (track.genre === 'video-game') {
        prompt = `🎮 Video Game Challenge: What is the title of this video game soundtrack/theme?`;
      } else if (track.genre === 'anime-ost') {
        prompt = `🌸 Anime Music Trivia: What is the title of this famous anime opening?`;
      } else if (track.genre === 'broadway-musicals') {
        prompt = `🎭 Broadway Showstoppers: What is the title of this celebrated musical number?`;
      } else if (track.genre === 'motown-soul') {
        prompt = `🎷 Motown & Soul: What is the title of this timeless soul anthem?`;
      } else if (track.genre === 'disco-funk') {
        prompt = `✨ Disco & Funk: What is the title of this dancefloor classic?`;
      } else if (track.genre === 'dance-eurodance') {
        prompt = `🔊 Eurodance Club: What is the title of this eurodance party anthem?`;
      } else if (track.genre === 'reggae-ska') {
        prompt = `🌴 Reggae & Ska: What is the title of this reggae/ska song?`;
      } else if (track.genre === 'folk-acoustic') {
        prompt = `🪕 Acoustic & Folk: What is the title of this song by ${track.artist}?`;
      } else {
        prompt = `🎧 Listen to the snippet: What is the title of this song by ${track.artist}?`;
      }
      correctValue = track.title;
      explanation = `The title is "${track.title}" by ${track.artist}, from "${track.album}" (${track.year}).`;
      break;

    case 'guess-album':
      if (['tv-themes', 'movie-themes', 'disney-pixar', 'cartoon-themes', 'video-game', 'anime-ost', 'broadway-musicals'].includes(track.genre)) {
        prompt = `🎧 Which soundtrack, game or production features the track "${track.title}"?`;
      } else {
        prompt = `🎧 Which album by ${track.artist} features "${track.title}"?`;
      }
      correctValue = track.album;
      explanation = `"${track.title}" was featured on the landmark release "${track.album}" (${track.year}).`;
      break;

    case 'guess-year':
      if (track.genre === 'tv-themes') {
        prompt = `📺 In what year did the TV show featuring "${track.title}" officially premiere?`;
      } else if (track.genre === 'movie-themes' || track.genre === 'disney-pixar') {
        prompt = `🎬 In what year was the movie featuring "${track.title}" released in theaters?`;
      } else if (track.genre === 'video-game') {
        prompt = `🎮 In what year did the game featuring "${track.title}" launch?`;
      } else {
        prompt = `🎧 In what year was "${track.title}" by ${track.artist} released?`;
      }
      correctValue = String(track.year);
      explanation = `"${track.title}" was officially released in ${track.year}.`;
      break;

    case 'blind-audio':
      if (track.genre === 'tv-themes') {
        prompt = `📺 Blind TV Theme Test: Identify the theme song and TV show in this audio clip!`;
      } else if (track.genre === 'movie-themes') {
        prompt = `🎬 Blind Movie Test: Identify the soundtrack theme and film in this audio clip!`;
      } else if (track.genre === 'disney-pixar') {
        prompt = `🏰 Blind Disney/Pixar Test: Can you identify this song and animated movie?`;
      } else if (track.genre === 'cartoon-themes') {
        prompt = `⚡ Blind Cartoon Test: Can you identify this animated series theme song?`;
      } else if (track.genre === 'video-game') {
        prompt = `🎮 Blind Gaming Test: Can you identify this track and game franchise?`;
      } else if (track.genre === 'anime-ost') {
        prompt = `🌸 Blind Anime Test: Can you identify this anime theme and performer?`;
      } else if (track.genre === 'broadway-musicals') {
        prompt = `🎭 Blind Broadway Test: Name this musical showstopper and performer!`;
      } else if (track.genre === 'motown-soul') {
        prompt = `🎷 Blind Soul Test: Name this Motown/Soul classic and artist!`;
      } else if (track.genre === 'disco-funk') {
        prompt = `✨ Blind Disco Test: Name this disco/funk anthem and artist!`;
      } else if (track.genre === 'dance-eurodance') {
        prompt = `🔊 Blind Dance Test: Identify this eurodance classic and group!`;
      } else if (track.genre === 'reggae-ska') {
        prompt = `🌴 Blind Reggae Test: Identify this reggae/ska track and artist!`;
      } else {
        prompt = `🎧 Blind Audio Test: Can you identify both the song and the artist playing in this clip?`;
      }
      correctValue = `${track.title} — ${track.artist}`;
      explanation = `You were listening to "${track.title}" by ${track.artist} from "${track.album}" (${track.year}).`;
      break;
  }

  const distractors = getPlausibleDistractors(track, preferredType, allTracks);

  // Guarantee 3 unique distractors that don't match the correct answer
  const validDistractors = distractors
    .filter((d) => d.toLowerCase() !== correctValue.toLowerCase())
    .slice(0, 3);

  while (validDistractors.length < 3) {
    validDistractors.push(`Alternative ${validDistractors.length + 1}`);
  }

  // Shuffle answers into positions A, B, C, D
  const allAnswers = [
    { text: correctValue, isCorrect: true },
    { text: validDistractors[0], isCorrect: false },
    { text: validDistractors[1], isCorrect: false },
    { text: validDistractors[2], isCorrect: false },
  ];

  const shuffledAnswers = shuffle(allAnswers);
  const correctIdx = shuffledAnswers.findIndex((a) => a.isCorrect);
  const optionKeys: OptionKey[] = ['a', 'b', 'c', 'd'];
  const answerKey = optionKeys[correctIdx];

  const genreName = GENRE_MAP.get(track.genre)?.name || 'Music Trivia';

  return {
    id: `q-${track.id}-${index}-${Date.now()}`,
    type: preferredType,
    prompt,
    options: {
      a: shuffledAnswers[0].text,
      b: shuffledAnswers[1].text,
      c: shuffledAnswers[2].text,
      d: shuffledAnswers[3].text,
    },
    answer: answerKey,
    correctText: correctValue,
    explanation,
    genre: track.genre,
    genreName,
    track,
    difficulty: track.popularity && track.popularity > 88 ? 'easy' : track.popularity && track.popularity > 82 ? 'medium' : 'hard',
  };
}

/**
 * Generate full quiz according to settings
 */
export function generateQuiz(
  tracks: Track[],
  settings: QuizSettings
): QuizQuestion[] {
  let filteredTracks = tracks;
  if (settings.selectedGenres.length > 0) {
    filteredTracks = tracks.filter((t) => settings.selectedGenres.includes(t.genre));
  }

  if (filteredTracks.length < settings.questionCount) {
    filteredTracks = [...filteredTracks, ...CURATED_TRACKS];
  }

  const defaultTypes: QuestionType[] = ['guess-artist', 'guess-title', 'guess-year', 'guess-album', 'blind-audio'];
  const selectedTypes: QuestionType[] = settings.questionTypes.length > 0
    ? settings.questionTypes
    : defaultTypes;

  // Generate unique (track, questionType) pairs to allow generating 100s of questions
  const pairs: { track: Track; type: QuestionType }[] = [];
  selectedTypes.forEach((type) => {
    filteredTracks.forEach((track) => {
      pairs.push({ track, type });
    });
  });

  const shuffledPairs = shuffle(pairs);
  const targetCount = settings.questionCount;
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < targetCount; i++) {
    const pair = shuffledPairs[i % shuffledPairs.length];
    const question = buildQuestion(pair.track, pair.type, filteredTracks, i + 1);
    questions.push(question);
  }

  return questions;
}

/**
 * Generate a specialized quiz round dedicated to a single genre
 */
export function generateRoundForGenre(
  tracks: Track[],
  genreId: GenreId,
  count: number = 25,
  roundNumber?: number,
  roundName?: string
): QuizQuestion[] {
  const genreMeta = GENRE_MAP.get(genreId);
  const displayName = roundName || (genreMeta ? `${genreMeta.name} Round` : `Round ${roundNumber || 1}`);

  const questions = generateQuiz(tracks, {
    selectedGenres: [genreId],
    questionCount: count,
    questionTypes: ['guess-title', 'guess-artist', 'guess-album', 'guess-year', 'blind-audio'],
    timeLimitSeconds: 25,
    difficulty: 'all',
    enableAudio: true,
    enableSoundEffects: true,
  });

  return questions.map((q, idx) => ({
    ...q,
    roundName: displayName,
    roundNumber: roundNumber ?? 1,
    id: `round-${roundNumber ?? 1}-${genreId}-${idx + 1}-${Date.now()}`,
  }));
}

/**
 * Generate a complete multi-round tournament / pub quiz with distinct themed rounds
 */
export function generateMultiRoundTournament(
  tracks: Track[],
  roundsConfig: { genreId: GenreId; roundName?: string; count: number }[]
): QuizQuestion[] {
  const allQuestions: QuizQuestion[] = [];

  roundsConfig.forEach((round, index) => {
    const roundNumber = index + 1;
    const genreMeta = GENRE_MAP.get(round.genreId);
    const roundName = round.roundName || `Round ${roundNumber}: ${genreMeta?.name || 'Mystery Genre'}`;
    const roundQuestions = generateRoundForGenre(tracks, round.genreId, round.count, roundNumber, roundName);
    allQuestions.push(...roundQuestions);
  });

  return allQuestions;
}

