import { Track, GenreId } from '../types/quiz';
import { CURATED_TRACKS } from '../data/curatedTracks';

const SPOTIFY_CLIENT_ID_KEY = 'beatiq_spotify_client_id';
const SPOTIFY_CLIENT_SECRET_KEY = 'beatiq_spotify_client_secret';
const SPOTIFY_TOKEN_CACHE_KEY = 'beatiq_spotify_token_cache';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

class SpotifyApiService {
  private clientId: string = '';
  private clientSecret: string = '';
  private cachedToken: CachedToken | null = null;
  private previewCache: Map<string, string> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.clientId = localStorage.getItem(SPOTIFY_CLIENT_ID_KEY) || '';
      this.clientSecret = localStorage.getItem(SPOTIFY_CLIENT_SECRET_KEY) || '';
      const cached = localStorage.getItem(SPOTIFY_TOKEN_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CachedToken;
          if (parsed.expiresAt > Date.now()) {
            this.cachedToken = parsed;
          }
        } catch {
          // ignore cache error
        }
      }
    }
  }

  public getCredentials() {
    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      hasCredentials: Boolean(this.clientId && this.clientSecret),
    };
  }

  public saveCredentials(clientId: string, clientSecret: string) {
    this.clientId = clientId.trim();
    this.clientSecret = clientSecret.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(SPOTIFY_CLIENT_ID_KEY, this.clientId);
      localStorage.setItem(SPOTIFY_CLIENT_SECRET_KEY, this.clientSecret);
      this.cachedToken = null;
      localStorage.removeItem(SPOTIFY_TOKEN_CACHE_KEY);
    }
  }

  public clearCredentials() {
    this.clientId = '';
    this.clientSecret = '';
    this.cachedToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SPOTIFY_CLIENT_ID_KEY);
      localStorage.removeItem(SPOTIFY_CLIENT_SECRET_KEY);
      localStorage.removeItem(SPOTIFY_TOKEN_CACHE_KEY);
    }
  }

  /**
   * Request or reuse Spotify client credentials bearer token
   */
  public async getAccessToken(): Promise<string | null> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      return this.cachedToken.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      return null;
    }

    try {
      const basicAuth = btoa(`${this.clientId}:${this.clientSecret}`);
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: 'grant_type=client_credentials',
      });

      if (!res.ok) {
        throw new Error(`Spotify Auth failed: ${res.statusText}`);
      }

      const data = await res.json();
      const expiresAt = Date.now() + data.expires_in * 1000;
      this.cachedToken = {
        accessToken: data.access_token,
        expiresAt,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(SPOTIFY_TOKEN_CACHE_KEY, JSON.stringify(this.cachedToken));
      }

      return data.access_token;
    } catch (err) {
      console.warn('Spotify Auth Error:', err);
      return null;
    }
  }

  /**
   * Test Spotify credentials
   */
  public async testConnection(clientId?: string, clientSecret?: string): Promise<{ success: boolean; message: string; pingMs: number }> {
    const cid = clientId ?? this.clientId;
    const csec = clientSecret ?? this.clientSecret;

    if (!cid || !csec) {
      return { success: false, message: 'Missing Client ID or Client Secret', pingMs: 0 };
    }

    const start = performance.now();
    try {
      const basicAuth = btoa(`${cid}:${csec}`);
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: 'grant_type=client_credentials',
      });

      const pingMs = Math.round(performance.now() - start);

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, message: `Invalid credentials: ${errorText}`, pingMs };
      }

      const data = await res.json();
      if (data.access_token) {
        return { success: true, message: 'Spotify Web API connected successfully! Token active.', pingMs };
      }

      return { success: false, message: 'Could not acquire access token', pingMs };
    } catch (err) {
      const pingMs = Math.round(performance.now() - start);
      return { success: false, message: (err as Error).message || 'Connection failed', pingMs };
    }
  }

  /**
   * Resolve a high-speed audio preview URL for any track title + artist.
   * Uses fast iTunes Audio Search fallback to guarantee audio preview works
   * even for tracks where Spotify API no longer returns preview_url.
   */
  public async resolveAudioPreview(trackTitle: string, artistName: string): Promise<string | undefined> {
    const key = `${trackTitle} - ${artistName}`.toLowerCase();
    if (this.previewCache.has(key)) {
      return this.previewCache.get(key);
    }

    try {
      // 1. First attempt: clean title + artist with limit=5
      const cleanTitle = trackTitle.replace(/\s*\(feat\..*?\)/i, '').replace(/\s*-.*$/, '').trim();
      const cleanArtist = artistName.split(',')[0].split('ft.')[0].trim();
      const query = encodeURIComponent(`${cleanTitle} ${cleanArtist}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const match = data.results?.find((r: { previewUrl?: string }) => r.previewUrl);
        if (match?.previewUrl) {
          this.previewCache.set(key, match.previewUrl);
          return match.previewUrl;
        }
      }

      // 2. Fallback attempt: clean title only
      const titleOnlyQuery = encodeURIComponent(cleanTitle);
      const res2 = await fetch(`https://itunes.apple.com/search?term=${titleOnlyQuery}&entity=song&limit=3`);
      if (res2.ok) {
        const data2 = await res2.json();
        const match2 = data2.results?.find((r: { previewUrl?: string }) => r.previewUrl);
        if (match2?.previewUrl) {
          this.previewCache.set(key, match2.previewUrl);
          return match2.previewUrl;
        }
      }
    } catch {
      // preview lookup graceful fallback
    }

    return undefined;
  }

  /**
   * Search tracks on Spotify Web API if token exists, or curated tracks
   */
  public async searchTracks(query: string, genre: GenreId = 'pop', limit: number = 20): Promise<Track[]> {
    const token = await this.getAccessToken();

    if (token) {
      try {
        const encoded = encodeURIComponent(query);
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encoded}&type=track&limit=${limit}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          const items = data.tracks?.items || [];
          const tracks: Track[] = await Promise.all(
            items.map(async (item: {
              id: string;
              name: string;
              artists: { name: string }[];
              album: { name: string; release_date?: string; images?: { url: string }[] };
              preview_url?: string;
              external_urls?: { spotify: string };
              popularity?: number;
            }) => {
              const artist = item.artists.map((a) => a.name).join(', ');
              const year = item.album.release_date ? parseInt(item.album.release_date.slice(0, 4), 10) : new Date().getFullYear();
              let previewUrl = item.preview_url;

              if (!previewUrl) {
                previewUrl = await this.resolveAudioPreview(item.name, artist);
              }

              return {
                id: `sp-${item.id}`,
                title: item.name,
                artist,
                album: item.album.name,
                year: isNaN(year) ? 2020 : year,
                genre,
                previewUrl: previewUrl || undefined,
                spotifyUrl: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
                albumArt: item.album.images?.[0]?.url,
                popularity: item.popularity || 80,
              };
            })
          );

          if (tracks.length > 0) {
            return tracks;
          }
        }
      } catch (err) {
        console.warn('Live Spotify search failed, using curated library:', err);
      }
    }

    // Filter curated library
    const qLower = query.toLowerCase();
    const curatedMatches = CURATED_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(qLower) ||
        t.artist.toLowerCase().includes(qLower) ||
        t.album.toLowerCase().includes(qLower)
    );

    if (curatedMatches.length > 0) {
      return curatedMatches.slice(0, limit);
    }

    return CURATED_TRACKS.slice(0, limit);
  }

  /**
   * Fetch tracks from a public Spotify playlist URL or ID
   */
  public async fetchPlaylistTracks(playlistInput: string, genre: GenreId = 'pop'): Promise<Track[]> {
    // Extract playlist ID from URL or URI
    // e.g. https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=... or spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
    let playlistId = playlistInput.trim();
    const urlMatch = playlistInput.match(/playlist\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      playlistId = urlMatch[1];
    } else if (playlistInput.startsWith('spotify:playlist:')) {
      playlistId = playlistInput.replace('spotify:playlist:', '');
    }

    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Spotify API Client ID & Secret are required to fetch custom playlist tracks. Please configure credentials in Settings.');
    }

    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch playlist (${res.status}): Make sure the playlist is public.`);
    }

    const data = await res.json();
    const items = data.items || [];

    const tracks: Track[] = await Promise.all(
      items
        .filter((item: { track?: { id: string; name: string } }) => item.track && item.track.id)
        .slice(0, 30)
        .map(async (item: {
          track: {
            id: string;
            name: string;
            artists: { name: string }[];
            album: { name: string; release_date?: string; images?: { url: string }[] };
            preview_url?: string;
            external_urls?: { spotify: string };
            popularity?: number;
          };
        }) => {
          const t = item.track;
          const artist = t.artists.map((a) => a.name).join(', ');
          const year = t.album.release_date ? parseInt(t.album.release_date.slice(0, 4), 10) : 2020;
          let previewUrl = t.preview_url;
          if (!previewUrl) {
            previewUrl = await this.resolveAudioPreview(t.name, artist);
          }

          return {
            id: `sp-${t.id}`,
            title: t.name,
            artist,
            album: t.album.name,
            year: isNaN(year) ? 2020 : year,
            genre,
            previewUrl: previewUrl || undefined,
            spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
            albumArt: t.album.images?.[0]?.url,
            popularity: t.popularity || 80,
          };
        })
    );

    return tracks;
  }
}

export const spotifyApi = new SpotifyApiService();
