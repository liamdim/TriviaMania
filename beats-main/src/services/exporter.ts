import { QuizQuestion, ExportConfig, ExportFormat } from '../types/quiz';

/**
 * Transforms quiz questions into the selected output format
 */
export function formatQuizData(
  questions: QuizQuestion[],
  config: ExportConfig
): string {
  switch (config.format) {
    case 'json-abcd':
      return formatJsonAbcd(questions, config);
    case 'json-array':
      return formatJsonArray(questions, config);
    case 'opentrivia':
      return formatOpenTrivia(questions, config);
    case 'typescript':
      return formatTypeScript(questions, config);
    case 'csv':
      return formatCsv(questions, config);
    case 'markdown':
      return formatMarkdown(questions, config);
    default:
      return formatJsonAbcd(questions, config);
  }
}

function formatOpenTrivia(questions: QuizQuestion[], config: ExportConfig): string {
  const data = questions.map((q) => {
    const allOptions = [q.options.a, q.options.b, q.options.c, q.options.d];
    const incorrect = allOptions.filter((opt) => opt !== q.correctText);
    const item: Record<string, unknown> = {
      category: q.genreName,
      type: 'multiple',
      difficulty: q.difficulty,
      question: q.prompt,
      correct_answer: q.correctText,
      incorrect_answers: incorrect,
    };
    if (config.includeAudioUrl) item.audio_url = q.track.previewUrl || null;
    if (config.includeSpotifyUrl) item.spotify_url = q.track.spotifyUrl;
    if (config.includeExplanation) item.explanation = q.explanation;
    return item;
  });

  return config.prettyPrint
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
}

function formatJsonAbcd(questions: QuizQuestion[], config: ExportConfig): string {
  const data = questions.map((q, idx) => {
    const item: Record<string, unknown> = {
      id: idx + 1,
      question: q.prompt,
      options: {
        a: q.options.a,
        b: q.options.b,
        c: q.options.c,
        d: q.options.d,
      },
      answer: q.answer,
      correctText: q.correctText,
    };

    if (config.includeExplanation) {
      item.explanation = q.explanation;
    }
    if (config.includeAudioUrl) {
      item.audioPreviewUrl = q.track.previewUrl || null;
    }
    if (config.includeSpotifyUrl) {
      item.spotifyUrl = q.track.spotifyUrl;
    }
    if (config.includeMetadata) {
      if (q.roundName) item.roundName = q.roundName;
      if (q.roundNumber) item.roundNumber = q.roundNumber;
      item.genre = q.genre;
      item.genreName = q.genreName;
      item.artist = q.track.artist;
      item.album = q.track.album;
      item.year = q.track.year;
      item.difficulty = q.difficulty;
      item.albumArt = q.track.albumArt;
    }

    return item;
  });

  return config.prettyPrint
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
}

function formatJsonArray(questions: QuizQuestion[], config: ExportConfig): string {
  const data = questions.map((q, idx) => {
    const optionsArray = [q.options.a, q.options.b, q.options.c, q.options.d];
    const keyToIdx = { a: 0, b: 1, c: 2, d: 3 };
    const answerIndex = keyToIdx[q.answer];

    const item: Record<string, unknown> = {
      id: idx + 1,
      question: q.prompt,
      options: optionsArray,
      answerIndex,
      correctAnswer: q.correctText,
    };

    if (config.includeExplanation) {
      item.explanation = q.explanation;
    }
    if (config.includeAudioUrl) {
      item.audioPreviewUrl = q.track.previewUrl || null;
    }
    if (config.includeSpotifyUrl) {
      item.spotifyUrl = q.track.spotifyUrl;
    }
    if (config.includeMetadata) {
      if (q.roundName) item.roundName = q.roundName;
      if (q.roundNumber) item.roundNumber = q.roundNumber;
      item.genre = q.genre;
      item.genreName = q.genreName;
      item.artist = q.track.artist;
      item.album = q.track.album;
      item.year = q.track.year;
    }

    return item;
  });

  return config.prettyPrint
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
}

function formatTypeScript(questions: QuizQuestion[], config: ExportConfig): string {
  const jsonContent = formatJsonAbcd(questions, { ...config, prettyPrint: true });

  return `/**
 * BeatIQ Music Quiz Dataset
 * Generated from Spotify Track Metadata
 * Total Questions: ${questions.length}
 * Generated: ${new Date().toISOString()}
 */

export interface QuizOptionSet {
  a: string;
  b: string;
  c: string;
  d: string;
}

export interface QuizQuestionItem {
  id: number;
  question: string;
  options: QuizOptionSet;
  answer: 'a' | 'b' | 'c' | 'd';
  correctText: string;
  explanation?: string;
  audioPreviewUrl?: string | null;
  spotifyUrl?: string;
  roundName?: string;
  roundNumber?: number;
  genre?: string;
  genreName?: string;
  artist?: string;
  album?: string;
  year?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  albumArt?: string;
}

export const QUIZ_QUESTIONS: QuizQuestionItem[] = ${jsonContent};

export default QUIZ_QUESTIONS;
`;
}

function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  return `"${str.replace(/"/g, '""')}"`;
}

function formatCsv(questions: QuizQuestion[], config: ExportConfig): string {
  const headers = [
    'id',
    'question',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'answer',
    'correct_text',
  ];

  if (config.includeExplanation) headers.push('explanation');
  if (config.includeAudioUrl) headers.push('audio_preview_url');
  if (config.includeSpotifyUrl) headers.push('spotify_url');
  if (config.includeMetadata) {
    headers.push('genre', 'artist', 'album', 'year');
  }

  const rows = questions.map((q, idx) => {
    const row = [
      escapeCsvField(idx + 1),
      escapeCsvField(q.prompt),
      escapeCsvField(q.options.a),
      escapeCsvField(q.options.b),
      escapeCsvField(q.options.c),
      escapeCsvField(q.options.d),
      escapeCsvField(q.answer),
      escapeCsvField(q.correctText),
    ];

    if (config.includeExplanation) row.push(escapeCsvField(q.explanation));
    if (config.includeAudioUrl) row.push(escapeCsvField(q.track.previewUrl || ''));
    if (config.includeSpotifyUrl) row.push(escapeCsvField(q.track.spotifyUrl));
    if (config.includeMetadata) {
      row.push(
        escapeCsvField(q.genre),
        escapeCsvField(q.track.artist),
        escapeCsvField(q.track.album),
        escapeCsvField(q.track.year)
      );
    }

    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function formatMarkdown(questions: QuizQuestion[], config: ExportConfig): string {
  const header = `# Spotify Music Quiz Questions\n\nGenerated for GitHub Quiz App · ${questions.length} Multiple Choice Questions (A, B, C, D)\n\n---\n\n`;

  const body = questions
    .map((q, idx) => {
      let md = `### ${idx + 1}. ${q.prompt}\n\n`;
      md += `- **A)** ${q.options.a}\n`;
      md += `- **B)** ${q.options.b}\n`;
      md += `- **C)** ${q.options.c}\n`;
      md += `- **D)** ${q.options.d}\n\n`;

      md += `<details>\n<summary><b>Reveal Answer</b></summary>\n\n`;
      md += `> **Correct Option:** \`${q.answer.toUpperCase()}\` — **${q.correctText}**\n>\n`;
      if (config.includeExplanation) {
        md += `> ${q.explanation}\n>\n`;
      }
      if (config.includeSpotifyUrl) {
        md += `> [Listen on Spotify](${q.track.spotifyUrl})\n`;
      }
      md += `</details>\n\n---\n`;
      return md;
    })
    .join('\n');

  return header + body;
}

/**
 * Trigger file download in browser
 */
export function downloadFile(filename: string, content: string, format: ExportFormat) {
  let mimeType = 'application/json';
  if (format === 'typescript') mimeType = 'text/typescript';
  else if (format === 'csv') mimeType = 'text/csv';
  else if (format === 'markdown') mimeType = 'text/markdown';

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to user clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error('Copy failed:', err);
    return false;
  }
}
