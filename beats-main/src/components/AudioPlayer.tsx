import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, AlertCircle, Disc3, Sparkles } from 'lucide-react';
import { spotifyApi } from '../services/spotifyApi';

interface AudioPlayerProps {
  src?: string;
  title: string;
  artist: string;
  albumArt?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  isRevealed?: boolean; // When false, hides title, artist, and album art!
  questionIndex?: number;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  title,
  artist,
  albumArt,
  autoPlay = true,
  onEnded,
  isRevealed = false,
  questionIndex = 1,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeSrc, setActiveSrc] = useState<string | undefined>(src);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<boolean>(false);
  const [needsUserGesture, setNeedsUserGesture] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);

  // Play audio safely handling browser autoplay restrictions
  const playAudio = useCallback(() => {
    if (!audioRef.current) return;
    setAudioError(false);
    setNeedsUserGesture(false);

    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setNeedsUserGesture(false);
        })
        .catch((err: Error) => {
          console.log('Audio autoplay prevented or error:', err.name, err.message);
          if (err.name === 'NotAllowedError') {
            // Browser autoplay restricted; requires direct user click
            setNeedsUserGesture(true);
          } else {
            setAudioError(true);
          }
          setIsPlaying(false);
        });
    }
  }, []);

  // When song or src changes:
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setImageError(false);
    setAudioError(false);
    setNeedsUserGesture(false);

    let currentStream = src;
    setActiveSrc(src);

    const loadAndPlay = async () => {
      // If no src or src is invalid, resolve dynamically via iTunes API
      if (!currentStream) {
        setIsLoadingAudio(true);
        try {
          const fresh = await spotifyApi.resolveAudioPreview(title, artist);
          if (fresh) {
            currentStream = fresh;
            setActiveSrc(fresh);
          }
        } catch {
          // ignore error
        } finally {
          setIsLoadingAudio(false);
        }
      }

      if (audioRef.current && currentStream) {
        audioRef.current.src = currentStream;
        audioRef.current.load();
        if (autoPlay) {
          playAudio();
        }
      }
    };

    loadAndPlay();
  }, [src, title, artist, autoPlay, playAudio]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      playAudio();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // If audio playback errors out, attempt live dynamic resolution
  const handleAudioError = async () => {
    console.warn('Audio stream failed, attempting dynamic resolution for:', title, artist);
    setIsLoadingAudio(true);
    try {
      const freshUrl = await spotifyApi.resolveAudioPreview(title, artist);
      if (freshUrl && freshUrl !== activeSrc) {
        setActiveSrc(freshUrl);
        if (audioRef.current) {
          audioRef.current.src = freshUrl;
          audioRef.current.load();
          playAudio();
        }
        setIsLoadingAudio(false);
        return;
      }
    } catch {
      // fallback
    }
    setIsLoadingAudio(false);
    setAudioError(true);
    setIsPlaying(false);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 transition-all shadow-inner shadow-black/40">
      <audio
        ref={audioRef}
        src={activeSrc}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        onError={handleAudioError}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Album Artwork or Mystery Disc */}
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 flex items-center justify-center shadow-md">
          {isRevealed && albumArt && !imageError ? (
            <img
              src={albumArt}
              alt={title}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover animate-fadeIn"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/40 flex flex-col items-center justify-center text-emerald-400 p-2">
              <Disc3
                className={`w-7 h-7 ${
                  isPlaying ? 'animate-spin text-emerald-400' : 'text-zinc-500'
                }`}
                style={{ animationDuration: '3s' }}
              />
              <span className="text-[9px] font-mono tracking-wider mt-0.5 text-zinc-500 uppercase">
                {isPlaying ? 'PLAYING' : 'READY'}
              </span>
            </div>
          )}
        </div>

        {/* Track Info (MASKED if !isRevealed to prevent answers leaking!) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <h4 className="text-sm md:text-base font-bold text-zinc-100 truncate flex items-center gap-2">
                {isRevealed ? (
                  <span>{title}</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Music className="w-4 h-4" />
                    <span>Audio Snippet #{questionIndex}</span>
                  </span>
                )}
              </h4>
              <p className="text-xs text-zinc-400 truncate">
                {isRevealed
                  ? `by ${artist}`
                  : isPlaying
                  ? '🎵 Playing clip... Listen closely to identify the answer!'
                  : 'Press Play or tap spacebar to listen to this snippet'}
              </p>
            </div>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              disabled={isLoadingAudio}
              aria-label={isPlaying ? 'Pause snippet' : 'Play snippet'}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
                isPlaying
                  ? 'bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/25 scale-102'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-400 hover:text-zinc-950'
              }`}
            >
              {isLoadingAudio ? (
                <span>Loading...</span>
              ) : isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Clip</span>
                </>
              )}
            </button>
          </div>

          {/* Waveform Visualizer & Progress */}
          <div className="space-y-2">
            {/* Animated Waveform Bars */}
            <div className="flex items-center gap-1 h-5 px-0.5">
              {[35, 70, 50, 95, 30, 85, 60, 100, 45, 90, 55, 75, 40, 95, 50, 80, 60, 90, 40, 70].map((height, idx) => {
                const isPassed = (idx / 20) * 100 <= progressPercent;
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-full transition-all duration-150 ${
                      isPassed
                        ? 'bg-emerald-400'
                        : 'bg-zinc-800'
                    }`}
                    style={{
                      height: isPlaying
                        ? `${Math.max(25, (height * (0.35 + Math.sin(currentTime * 5 + idx) * 0.65)))}%`
                        : `${height * 0.3}%`,
                    }}
                  />
                );
              })}
            </div>

            {/* Scrubber and Times */}
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono tabular-nums text-zinc-500 w-8">
                0:{Math.floor(currentTime).toString().padStart(2, '0')}
              </span>
              <input
                type="range"
                min="0"
                max={duration || 30}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <span className="text-[11px] font-mono tabular-nums text-zinc-500 w-8 text-right">
                0:{Math.floor(duration).toString().padStart(2, '0')}
              </span>
              <button
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="text-zinc-400 hover:text-zinc-200 p-1 transition-colors"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Autoplay prompt banner if browser blocks autoplay */}
      {needsUserGesture && (
        <div className="mt-3 p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-200 animate-pulse">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Browser autoplay paused. Click below to start audio:</span>
          </div>
          <button
            onClick={playAudio}
            className="px-3 py-1 bg-emerald-400 text-zinc-950 font-bold rounded-lg hover:bg-emerald-300 transition-colors shrink-0"
          >
            ▶ Play Now
          </button>
        </div>
      )}

      {audioError && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between text-xs text-amber-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Preview audio stream unreachable on this network.</span>
          </div>
          <button
            onClick={() => handleAudioError()}
            className="text-xs text-emerald-400 underline hover:text-emerald-300"
          >
            Retry Stream
          </button>
        </div>
      )}
    </div>
  );
};
