import React, { useState, useEffect } from 'react';
import { spotifyApi } from '../services/spotifyApi';
import {
  Radio,
  CheckCircle2,
  XCircle,
  ExternalLink,
  KeyRound,
  Zap,
  RotateCcw,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SpotifyConfigViewProps {
  onConnectionChange: (hasConnected: boolean) => void;
}

export const SpotifyConfigView: React.FC<SpotifyConfigViewProps> = ({
  onConnectionChange,
}) => {
  const [clientId, setClientId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    pingMs: number;
  }>({ tested: false, success: false, message: '', pingMs: 0 });

  useEffect(() => {
    const creds = spotifyApi.getCredentials();
    setClientId(creds.clientId);
    setClientSecret(creds.clientSecret);
    if (creds.hasCredentials) {
      // Auto test
      spotifyApi.testConnection().then((res) => {
        setTestResult({
          tested: true,
          success: res.success,
          message: res.message,
          pingMs: res.pingMs,
        });
        onConnectionChange(res.success);
      });
    }
  }, [onConnectionChange]);

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult({ tested: false, success: false, message: '', pingMs: 0 });

    spotifyApi.saveCredentials(clientId, clientSecret);
    const res = await spotifyApi.testConnection(clientId, clientSecret);

    setTestResult({
      tested: true,
      success: res.success,
      message: res.message,
      pingMs: res.pingMs,
    });
    onConnectionChange(res.success);
    setIsTesting(false);
  };

  const handleClear = () => {
    spotifyApi.clearCredentials();
    setClientId('');
    setClientSecret('');
    setTestResult({ tested: false, success: false, message: '', pingMs: 0 });
    onConnectionChange(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-zinc-50 tracking-tight">
              Spotify Web API Integration
            </h1>
            <p className="text-xs text-zinc-400">
              Seamlessly connect BeatIQ to Spotify Web API for live searches and public playlists.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Credentials Form */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>API Credentials</span>
            </h2>

            {testResult.tested && (
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {testResult.success ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active ({testResult.pingMs}ms)</span>
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Failed</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSaveAndTest} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">
                Spotify Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. 7f8a92b... (from Spotify Developer Dashboard)"
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 font-mono focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">
                  Spotify Client Secret
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                >
                  {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showSecret ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="e.g. 3a1b5c... (keep secret)"
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 font-mono focus:outline-none"
              />
            </div>

            {testResult.tested && (
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                }`}
              >
                <div className="font-semibold mb-0.5">
                  {testResult.success ? '✓ Connection Verified' : '✗ Connection Failed'}
                </div>
                <div>{testResult.message}</div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isTesting || !clientId.trim() || !clientSecret.trim()}
                className="flex-1 py-2.5 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{isTesting ? 'Verifying with Spotify...' : 'Test & Save Connection'}</span>
              </button>

              {(clientId || clientSecret) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 text-xs rounded-xl border border-zinc-700 transition-colors"
                  title="Clear credentials"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Credentials are securely stored strictly in your browser&apos;s localStorage.</span>
          </div>
        </div>

        {/* Quick Guide & Free Tier Info */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Quick 30-Second Setup</span>
            </h3>

            <ol className="space-y-3 text-xs text-zinc-300 list-decimal list-inside leading-relaxed">
              <li>
                Open the{' '}
                <a
                  href="https://developer.spotify.com/dashboard"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-emerald-400 underline hover:text-emerald-300 inline-flex items-center gap-0.5"
                >
                  <span>Spotify Developer Dashboard</span>
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                and log in with any free Spotify account.
              </li>
              <li>Click &quot;Create App&quot;, enter any name (e.g. &quot;My Quiz&quot;) and select &quot;Web API&quot;.</li>
              <li>Copy your <b>Client ID</b> and <b>Client Secret</b> from Settings into the form on the left!</li>
            </ol>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-zinc-100">
              Curated Offline Catalog Ready
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Don&apos;t have Spotify keys handy right now? No problem! BeatIQ already has 160+ verified tracks
              with real playable audio previews across 16 genres ready out of the box. You can play, generate,
              and export immediately!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
