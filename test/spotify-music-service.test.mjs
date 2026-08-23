// Intent: verify Spotify music integration behavior without contacting Spotify.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

import {
  createDefaultSpotifyMusicPanelState,
  createSpotifyPlaybackResumeState,
  createSpotifyMusicService,
  createSpotifyTokenFromResponse,
  createSpotifyTempoReference,
  isSpotifyMusicConnected,
  renderSpotifyDeveloperOptionsHTML,
  renderSpotifyMusicChromeHTML,
  renderSpotifyMusicPanelHTML,
  resolveSpotifyRedirectUri,
} from "../apps/editor/public/features/spotify-music/spotify-music-service.js";

export async function runSpotifyMusicServiceTest() {
  const now = () => 1_000_000;
  const token = createSpotifyTokenFromResponse({
    access_token: "token-1",
    refresh_token: "refresh-1",
    expires_in: 3600,
  }, { now });
  assert.equal(token.expiresAt, 4_600_000);
  assert.equal(isSpotifyMusicConnected({ token }, now()), true);
  assert.equal(isSpotifyMusicConnected({ token }, token.expiresAt), false);

  const calls = [];
  let tokenPostBody = "";
  const playbackPostBodies = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/api/token")) {
      tokenPostBody = String(options.body ?? "");
      return responseJson(200, {
        access_token: "token-2",
        refresh_token: "refresh-2",
        expires_in: 1800,
        token_type: "Bearer",
        scope: "streaming user-read-email user-read-private user-modify-playback-state playlist-read-private playlist-read-collaborative",
      });
    }

    if (String(url).includes("/search")) {
      assert.equal(options.headers.Authorization, "Bearer token-2");
      return responseJson(200, {
        tracks: {
          items: [{
            id: "track-1",
            uri: "spotify:track:track-1",
            name: "The Theme",
            duration_ms: 201000,
            artists: [{ name: "Score Author" }],
            album: {
              name: "Draft Sessions",
              images: [{ url: "https://i.scdn.co/image/cover", width: 128 }],
            },
            external_urls: {
              spotify: "https://open.spotify.com/track/track-1",
            },
          }],
        },
      });
    }

    if (String(url).endsWith("/v1/me")) {
      assert.equal(options.headers.Authorization, "Bearer token-2");
      return responseJson(200, {
        id: "user-1",
        display_name: "Author",
        images: [{ url: "https://i.scdn.co/image/profile", width: 128 }],
        external_urls: {
          spotify: "https://open.spotify.com/user/user-1",
        },
      });
    }

    if (String(url).includes("/me/playlists")) {
      assert.equal(options.headers.Authorization, "Bearer token-2");
      return responseJson(200, {
        total: 2,
        items: [{
          id: "playlist-1",
          uri: "spotify:playlist:playlist-1",
          name: "Draft Focus",
          collaborative: false,
          owner: {
            id: "user-1",
            display_name: "Author",
          },
          items: {
            total: 2,
          },
          images: [{ url: "https://i.scdn.co/image/playlist", width: 128 }],
          external_urls: {
            spotify: "https://open.spotify.com/playlist/playlist-1",
          },
        }, {
          id: "playlist-2",
          uri: "spotify:playlist:playlist-2",
          name: "Followed Score",
          collaborative: false,
          owner: {
            id: "other-user",
            display_name: "Other Curator",
          },
          items: {
            total: 12,
          },
          images: [{ url: "https://i.scdn.co/image/playlist-2", width: 128 }],
          external_urls: {
            spotify: "https://open.spotify.com/playlist/playlist-2",
          },
        }],
      });
    }

    if (String(url).includes("/playlists/playlist-2/items")) {
      assert.equal(options.headers.Authorization, "Bearer token-2");
      return responseJson(403, {
        error: {
          status: 0,
          message: "Forbidden",
        },
      });
    }

    if (String(url).includes("/playlists/playlist-1/items")) {
      assert.equal(options.headers.Authorization, "Bearer token-2");
      assert.match(String(url), /limit=50/);
      assert.match(String(url), /fields=/);
      return responseJson(200, {
        total: 2,
        items: [{
          item: {
            id: "track-1",
            type: "track",
            uri: "spotify:track:track-1",
            name: "The Theme",
            duration_ms: 201000,
            artists: [{ name: "Score Author" }],
            album: {
              name: "Draft Sessions",
              images: [{ url: "https://i.scdn.co/image/cover", width: 128 }],
            },
            external_urls: {
              spotify: "https://open.spotify.com/track/track-1",
            },
          },
        }, {
          item: {
            id: "track-2",
            type: "track",
            uri: "spotify:track:track-2",
            name: "Revision Pulse",
            duration_ms: 180000,
            artists: [{ name: "Tempo Desk" }],
            album: {
              name: "Draft Sessions",
              images: [{ url: "https://i.scdn.co/image/cover-2", width: 128 }],
            },
            external_urls: {
              spotify: "https://open.spotify.com/track/track-2",
            },
          },
        }],
      });
    }

    if (String(url).includes("/audio-features")) {
      assert.equal(options.headers.Authorization, "Bearer token-2");
      const ids = new URL(String(url)).searchParams.get("ids");
      if (ids.includes("blocked-tempo")) {
        return responseJson(403, {
          error: {
            status: 403,
            message: "",
          },
        });
      }
      return responseJson(200, {
        audio_features: [{
          id: "track-1",
          tempo: 192.8,
          time_signature: 4,
          energy: 0.42,
          danceability: 0.58,
        }, {
          id: "track-2",
          tempo: 89.4,
          time_signature: 4,
          energy: 0.38,
          danceability: 0.48,
        }],
      });
    }

    if (String(url).includes("/me/player/queue")) {
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer token-2");
      if (String(url).includes("spotify%3Atrack%3Ano-device")) {
        return responseJson(404, {
          error: {
            status: 404,
            message: "Player command failed: No active device found",
          },
        });
      }
      assert.match(String(url), /uri=spotify%3Atrack%3Atrack-1/);
      return {
        ok: true,
        status: 204,
      };
    }

    if (String(url).includes("/me/player/play")) {
      assert.equal(options.method, "PUT");
      assert.equal(options.headers.Authorization, "Bearer token-2");
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.match(String(url), /device_id=abe-device-1/);
      playbackPostBodies.push(String(options.body ?? ""));
      return {
        ok: true,
        status: 204,
      };
    }

    throw new Error(`Unexpected Spotify fetch: ${url}`);
  };

  const storage = createMemoryStorage();
  const service = createSpotifyMusicService({
    fetchFn,
    cryptoRef: webcrypto,
    authStorage: storage,
    playbackStateStorage: storage,
    tokenStorage: storage,
    now,
    logger: null,
  });
  assert.equal(
    resolveSpotifyRedirectUri("http://127.0.0.1:4310/?sandpit=manuscript-shell&ubi=session-1"),
    "http://127.0.0.1:4310/",
  );
  assert.equal(
    service.resolveRedirectUri("http://127.0.0.1:4310/?code=auth-code&state=state-1"),
    "http://127.0.0.1:4310/",
  );

  const auth = await service.beginAuthorization({
    clientId: "client-1",
    redirectUri: "http://127.0.0.1:4310/",
  });
  assert.equal(auth.ok, true);
  const authUrl = new URL(auth.authorizationUrl);
  assert.equal(authUrl.origin, "https://accounts.spotify.com");
  assert.match(authUrl.searchParams.get("scope"), /\bstreaming\b/);
  assert.match(authUrl.searchParams.get("scope"), /\buser-read-email\b/);
  assert.match(authUrl.searchParams.get("scope"), /\buser-read-private\b/);
  assert.match(authUrl.searchParams.get("scope"), /\buser-modify-playback-state\b/);
  assert.match(authUrl.searchParams.get("scope"), /\bplaylist-read-private\b/);
  assert.match(authUrl.searchParams.get("scope"), /\bplaylist-read-collaborative\b/);
  assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");

  const exchange = await service.exchangeAuthorizationCode({
    clientId: "client-1",
    redirectUri: "http://127.0.0.1:4310/",
    href: `http://127.0.0.1:4310/?code=auth-code&state=${authUrl.searchParams.get("state")}`,
  });
  assert.equal(exchange.ok, true);
  assert.equal(exchange.token.accessToken, "token-2");
  assert.match(tokenPostBody, /grant_type=authorization_code/);
  assert.match(tokenPostBody, /code_verifier=/);
  assert.equal(service.getStoredToken().accessToken, "token-2");
  assert.equal(service.hasPlaybackScope(exchange.token), true);
  assert.equal(service.hasPlaybackScope({
    accessToken: "old-token",
    scope: "user-modify-playback-state",
  }), false);
  assert.equal(service.hasPlaylistScope(exchange.token), true);
  assert.equal(service.hasPlaylistScope({
    accessToken: "old-token",
    scope: "streaming",
  }), false);

  const search = await service.searchTracks({
    accessToken: exchange.token.accessToken,
    query: "chapter theme",
  });
  assert.equal(search.ok, true);
  assert.equal(search.tracks[0].title, "The Theme");
  assert.deepEqual(search.tracks[0].artistNames, ["Score Author"]);
  assert.equal(search.tracks[0].albumName, "Draft Sessions");

  const profile = await service.loadCurrentUserProfile({
    accessToken: exchange.token.accessToken,
  });
  assert.equal(profile.ok, true);
  assert.equal(profile.userId, "user-1");
  assert.equal(profile.displayName, "Author");
  assert.equal(profile.imageUrl, "https://i.scdn.co/image/profile");

  const playlists = await service.loadPlaylists({
    accessToken: exchange.token.accessToken,
    currentUserId: profile.userId,
  });
  assert.equal(playlists.ok, true);
  assert.equal(playlists.playlists[0].title, "Draft Focus");
  assert.equal(playlists.playlists[0].trackTotal, 2);
  assert.equal(playlists.playlists[0].canReadTracks, true);
  assert.equal(playlists.playlists[1].title, "Followed Score");
  assert.equal(playlists.playlists[1].canReadTracks, false);

  const playlistTracks = await service.loadPlaylistTracks({
    accessToken: exchange.token.accessToken,
    playlistId: "playlist-1",
  });
  assert.equal(playlistTracks.ok, true);
  assert.equal(playlistTracks.tracks.length, 2);
  assert.equal(playlistTracks.tracks[1].title, "Revision Pulse");

  const tempo = await service.enrichTracksWithTempo({
    accessToken: exchange.token.accessToken,
    tracks: playlistTracks.tracks,
  });
  assert.equal(tempo.ok, true);
  assert.equal(tempo.tracks[0].rawTempoBpm, 192.8);
  assert.equal(tempo.tracks[0].tempoBpm, 96.4);
  assert.equal(tempo.tracks[0].tempoBucket, "steady");
  assert.equal(tempo.tempoReference.count, 2);
  assert.equal(createSpotifyTempoReference(tempo.tracks).bucket, "steady");

  const blockedTempo = await service.enrichTracksWithTempo({
    accessToken: exchange.token.accessToken,
    tracks: [{
      id: "blocked-tempo",
      uri: "spotify:track:blocked-tempo",
      title: "Blocked",
    }],
  });
  assert.equal(blockedTempo.ok, false);
  assert.match(blockedTempo.message, /unavailable/i);
  assert.equal(blockedTempo.tracks[0].uri, "spotify:track:blocked-tempo");

  const forbiddenPlaylist = await service.loadPlaylistTracks({
    accessToken: exchange.token.accessToken,
    playlistId: "playlist-2",
  });
  assert.equal(forbiddenPlaylist.ok, false);
  assert.match(forbiddenPlaylist.message, /Use Play/i);

  const queue = await service.queueTrack({
    accessToken: exchange.token.accessToken,
    trackUri: "spotify:track:track-1",
  });
  assert.equal(queue.ok, true);

  const playback = await service.startTrackPlayback({
    accessToken: exchange.token.accessToken,
    deviceId: "abe-device-1",
    positionMs: 42000,
    trackUri: "spotify:track:track-1",
  });
  assert.equal(playback.ok, true);
  const trackPlaybackBody = JSON.parse(playbackPostBodies[playbackPostBodies.length - 1]);
  assert.deepEqual(trackPlaybackBody.uris, ["spotify:track:track-1"]);
  assert.equal(trackPlaybackBody.position_ms, 42000);

  const playlistPlayback = await service.startPlaylistPlayback({
    accessToken: exchange.token.accessToken,
    deviceId: "abe-device-1",
    playlistUri: "spotify:playlist:playlist-2",
    positionMs: 64000,
    trackUri: "spotify:track:track-2",
  });
  assert.equal(playlistPlayback.ok, true);
  const playlistPlaybackBody = JSON.parse(playbackPostBodies[playbackPostBodies.length - 1]);
  assert.equal(playlistPlaybackBody.context_uri, "spotify:playlist:playlist-2");
  assert.deepEqual(playlistPlaybackBody.offset, { uri: "spotify:track:track-2" });
  assert.equal(playlistPlaybackBody.position_ms, 64000);

  const resumeState = service.savePlaybackState({
    playbackContextUri: "spotify:playlist:playlist-1",
    playbackCurrentPlaylist: playlists.playlists[0],
    playbackCurrentTrack: tempo.tracks[0],
    playbackDurationMs: tempo.tracks[0].durationMs,
    playbackPaused: false,
    playbackPositionMs: 90500,
    playbackStateUpdatedAt: 1_111_000,
  });
  assert.equal(resumeState.trackUri, "spotify:track:track-1");
  assert.equal(resumeState.contextUri, "spotify:playlist:playlist-1");
  assert.equal(resumeState.positionMs, 90500);
  assert.equal(service.getStoredPlaybackState().currentTrack.title, "The Theme");
  assert.equal(service.getStoredPlaybackState().savedAt, 1_111_000);
  assert.equal(createSpotifyPlaybackResumeState({
    currentTrack: tempo.tracks[0],
    positionMs: 999999,
    durationMs: 201000,
  }).positionMs, 201000);
  service.clearPlaybackState();
  assert.equal(service.getStoredPlaybackState(), null);

  const sdkWindow = {};
  const appendedScripts = [];
  const sdkEvents = [];
  class FakeSpotifyPlayer {
    constructor(options = {}) {
      this.options = options;
      this.listeners = new Map();
      FakeSpotifyPlayer.instance = this;
    }

    addListener(name, callback) {
      this.listeners.set(name, callback);
    }

    activateElement() {
      this.activated = true;
      return Promise.resolve();
    }

    connect() {
      queueMicrotask(() => {
        this.listeners.get("ready")?.({ device_id: "abe-sdk-device-1" });
      });
      return Promise.resolve(true);
    }

    disconnect() {
      this.disconnected = true;
    }

    togglePlay() {
      this.toggleCalled = true;
      return Promise.resolve();
    }

    nextTrack() {
      this.nextCalled = true;
      return Promise.resolve();
    }

    previousTrack() {
      this.previousCalled = true;
      return Promise.resolve();
    }

    seek(positionMs) {
      this.seekPositionMs = positionMs;
      return Promise.resolve();
    }
  }
  const sdkDocument = {
    head: {
      appendChild: (script) => {
        appendedScripts.push(script);
        sdkWindow.Spotify = { Player: FakeSpotifyPlayer };
        queueMicrotask(() => sdkWindow.onSpotifyWebPlaybackSDKReady());
      },
    },
    createElement: (tagName) => ({ tagName }),
    querySelector: () => null,
  };
  const sdkService = createSpotifyMusicService({
    fetchFn,
    cryptoRef: webcrypto,
    windowRef: sdkWindow,
    documentRef: sdkDocument,
    authStorage: storage,
    playbackStateStorage: storage,
    tokenStorage: storage,
    now,
    logger: null,
  });
  const sdkResult = await sdkService.connectWebPlayback({
    accessToken: exchange.token.accessToken,
    onEvent: (event) => sdkEvents.push(event),
  });
  assert.equal(sdkResult.ok, true);
  assert.equal(sdkResult.deviceId, "abe-sdk-device-1");
  assert.equal(appendedScripts[0].src, "https://sdk.scdn.co/spotify-player.js");
  assert.equal(FakeSpotifyPlayer.instance.activated, true);
  assert.equal(sdkEvents.some((event) => event.type === "ready" && event.deviceId === "abe-sdk-device-1"), true);
  assert.equal((await sdkService.togglePlayback()).ok, true);
  assert.equal((await sdkService.nextTrack()).ok, true);
  assert.equal((await sdkService.previousTrack()).ok, true);
  assert.equal((await sdkService.seekPlayback({ positionMs: 42000 })).ok, true);
  assert.equal(FakeSpotifyPlayer.instance.toggleCalled, true);
  assert.equal(FakeSpotifyPlayer.instance.nextCalled, true);
  assert.equal(FakeSpotifyPlayer.instance.previousCalled, true);
  assert.equal(FakeSpotifyPlayer.instance.seekPositionMs, 42000);
  assert.equal(sdkService.disconnectWebPlayback().ok, true);
  assert.equal(FakeSpotifyPlayer.instance.disconnected, true);

  const inactiveDeviceQueue = await service.queueTrack({
    accessToken: exchange.token.accessToken,
    trackUri: "spotify:track:no-device",
  });
  assert.equal(inactiveDeviceQueue.ok, false);
  assert.equal(
    inactiveDeviceQueue.message,
    "No active Spotify playback device found. Open Spotify, start playback on this account, then queue the track again.",
  );

  const panelMarkup = renderSpotifyMusicPanelHTML({
    state: createDefaultSpotifyMusicPanelState({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:4310/",
      token: { ...exchange.token, expiresAt: Date.now() + 3_600_000 },
      currentUserDisplayName: "Author",
      currentUserImageUrl: "https://i.scdn.co/image/profile",
      query: "chapter theme",
      searchResults: tempo.tracks,
      queueHistory: [search.tracks[0]],
      playbackReady: true,
      playbackDeviceId: "abe-device-1",
      playbackCurrentTrack: tempo.tracks[0],
      playbackDurationMs: tempo.tracks[0].durationMs,
      playbackPositionMs: 60000,
    }),
  });
  assert.match(panelMarkup, /Spotify/);
  assert.match(panelMarkup, /data-action="spotify-toggle-account-menu"/);
  assert.doesNotMatch(panelMarkup, /spotify-music-panel__signin/);
  assert.doesNotMatch(panelMarkup, /data-spotify-client-id/);
  assert.match(panelMarkup, /data-action="spotify-set-source"/);
  assert.match(panelMarkup, /data-spotify-search-query/);
  assert.doesNotMatch(panelMarkup, /spotify-player-card/);
  assert.match(panelMarkup, /data-action="spotify-analyze-tempo"/);
  assert.match(panelMarkup, /data-action="spotify-play-track"/);
  assert.match(panelMarkup, /data-action="spotify-queue-track"/);
  assert.match(panelMarkup, /Premium playback is required/);
  assert.match(panelMarkup, /Tempo reference/);
  assert.match(panelMarkup, /96\.4 BPM/);
  assert.match(panelMarkup, /Queued this session/);

  const accountMenuMarkup = renderSpotifyMusicPanelHTML({
    state: createDefaultSpotifyMusicPanelState({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:4310/",
      token: { ...exchange.token, expiresAt: Date.now() + 3_600_000 },
      currentUserDisplayName: "Author",
      currentUserImageUrl: "https://i.scdn.co/image/profile",
      accountMenuOpen: true,
    }),
  });
  assert.match(accountMenuMarkup, /Sign in with Spotify|Reconnect Spotify/);
  assert.match(accountMenuMarkup, /Disconnect/);

  const developerMarkup = renderSpotifyDeveloperOptionsHTML({
    state: createDefaultSpotifyMusicPanelState({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:4310/",
      clientIdSource: "manual",
    }),
  });
  assert.match(developerMarkup, /Spotify app setup/);
  assert.match(developerMarkup, /data-spotify-client-id/);
  assert.match(developerMarkup, /data-action="spotify-save-client-id"/);

  const playlistMarkup = renderSpotifyMusicPanelHTML({
    state: createDefaultSpotifyMusicPanelState({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:4310/",
      token: { ...exchange.token, expiresAt: Date.now() + 3_600_000 },
      sourceMode: "playlists",
      playlistResults: playlists.playlists,
      selectedPlaylistId: "playlist-1",
      selectedPlaylistName: "Draft Focus",
      playlistTrackResults: tempo.tracks,
    }),
  });
  assert.match(playlistMarkup, /data-action="spotify-load-playlists"/);
  assert.match(playlistMarkup, /data-action="spotify-play-playlist"/);
  assert.match(playlistMarkup, /aria-label="Play Draft Focus in ABE"/);
  assert.match(playlistMarkup, /Draft Focus/);
  assert.match(playlistMarkup, /Followed Score/);
  assert.match(playlistMarkup, /Tracks hidden/);
  assert.match(playlistMarkup, /Tempo reference/);

  const chromeMarkup = renderSpotifyMusicChromeHTML({
    open: true,
    state: createDefaultSpotifyMusicPanelState({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:4310/",
      token: { ...exchange.token, expiresAt: Date.now() + 3_600_000 },
      currentUserDisplayName: "Author",
      currentUserImageUrl: "https://i.scdn.co/image/profile",
      query: "chapter theme",
      searchResults: search.tracks,
      queueHistory: [search.tracks[0]],
      playbackReady: true,
      playbackDeviceId: "abe-device-1",
      playbackCurrentTrack: tempo.tracks[0],
      playbackDurationMs: tempo.tracks[0].durationMs,
      playbackPositionMs: 42000,
    }),
  });
  assert.match(chromeMarkup, /spotify-music-chrome/);
  assert.match(chromeMarkup, /data-action="toggle-spotify-music-panel"/);
  assert.match(chromeMarkup, /Signed in/);
  assert.match(chromeMarkup, /spotify-avatar has-image/);
  assert.match(chromeMarkup, /spotify-compact-player/);
  assert.match(chromeMarkup, /spotify-compact-player__art/);
  assert.match(chromeMarkup, /data-action="spotify-toggle-playback"/);
  assert.match(chromeMarkup, /data-action="spotify-previous-track"/);
  assert.match(chromeMarkup, /data-action="spotify-next-track"/);
  assert.match(chromeMarkup, /data-spotify-playback-seek/);
  assert.match(chromeMarkup, /data-spotify-playback-position-label/);
  assert.doesNotMatch(chromeMarkup, /spotify-music-chrome__summary/);
  assert.doesNotMatch(chromeMarkup, /spotify-music-chrome__queue/);
  assert.match(chromeMarkup, /spotify-music-popover/);
  assert.match(chromeMarkup, /data-action="close-spotify-music-panel"/);
}

function responseJson(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}
