// Intent: own Spotify account connection, playlist/search browsing, tempo reference, playback, and queue commands for the optional music integration panel.
import { escapeHtml } from "../../shared/ui-utils.js";

export const SPOTIFY_MUSIC_PANEL_ID = "spotify";
export const SPOTIFY_MUSIC_CLIENT_ID_STORAGE_KEY = "abe-spotify-client-id-v1";
export const SPOTIFY_MUSIC_TOKEN_STORAGE_KEY = "abe-spotify-session-token-v1";
export const SPOTIFY_MUSIC_PLAYBACK_STATE_STORAGE_KEY = "abe-spotify-playback-state-v1";

const SPOTIFY_PKCE_VERIFIER_STORAGE_KEY = "abe-spotify-pkce-verifier-v1";
const SPOTIFY_PKCE_STATE_STORAGE_KEY = "abe-spotify-pkce-state-v1";
const SPOTIFY_AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_ROOT = "https://api.spotify.com/v1";
const SPOTIFY_WEB_PLAYBACK_SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const SPOTIFY_QUEUE_SCOPE = "user-modify-playback-state";
const SPOTIFY_PLAYLIST_REQUIRED_SCOPES = ["playlist-read-private"];
const SPOTIFY_PLAYLIST_SCOPES = [
  ...SPOTIFY_PLAYLIST_REQUIRED_SCOPES,
  "playlist-read-collaborative",
];
const SPOTIFY_PLAYBACK_REQUIRED_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  SPOTIFY_QUEUE_SCOPE,
];
const SPOTIFY_AUTHORIZATION_SCOPE = [
  ...SPOTIFY_PLAYBACK_REQUIRED_SCOPES,
  ...SPOTIFY_PLAYLIST_SCOPES,
].join(" ");
const SPOTIFY_WEB_PLAYER_NAME = "ABE Writing Soundtrack";
const TOKEN_REFRESH_SKEW_MS = 60_000;
const DEFAULT_TRACK_LIMIT = 8;
const DEFAULT_PLAYLIST_LIMIT = 20;
const DEFAULT_PLAYLIST_TRACK_LIMIT = 50;
const WEB_PLAYBACK_SDK_TIMEOUT_MS = 15_000;

export function createDefaultSpotifyMusicPanelState(candidate = {}) {
  const clientId = normalizeText(candidate.clientId);
  const clientIdSource = normalizeSpotifyClientIdSource(candidate.clientIdSource) || (clientId ? "manual" : "");
  return {
    clientId,
    clientIdDraft: normalizeText(candidate.clientIdDraft || clientId),
    clientIdSource,
    redirectUri: normalizeText(candidate.redirectUri),
    token: normalizeSpotifyToken(candidate.token),
    currentUserId: normalizeText(candidate.currentUserId),
    currentUserDisplayName: normalizeText(candidate.currentUserDisplayName),
    currentUserImageUrl: normalizeText(candidate.currentUserImageUrl),
    currentUserExternalUrl: normalizeText(candidate.currentUserExternalUrl),
    accountMenuOpen: candidate.accountMenuOpen === true,
    sourceMode: normalizeSpotifyMusicSourceMode(candidate.sourceMode),
    query: normalizeText(candidate.query),
    searchResults: normalizeSpotifyTracks(candidate.searchResults),
    playlistResults: normalizeSpotifyPlaylists(candidate.playlistResults),
    selectedPlaylistId: normalizeText(candidate.selectedPlaylistId),
    selectedPlaylistName: normalizeText(candidate.selectedPlaylistName),
    playlistTrackResults: normalizeSpotifyTracks(candidate.playlistTrackResults),
    queueHistory: normalizeSpotifyTracks(candidate.queueHistory).slice(0, 8),
    authStatus: normalizeText(candidate.authStatus),
    searchStatus: normalizeText(candidate.searchStatus),
    playlistStatus: normalizeText(candidate.playlistStatus),
    tempoStatus: normalizeText(candidate.tempoStatus),
    queueStatus: normalizeText(candidate.queueStatus),
    playbackStatus: normalizeText(candidate.playbackStatus),
    playbackDeviceId: normalizeText(candidate.playbackDeviceId),
    playbackDeviceName: normalizeText(candidate.playbackDeviceName) || SPOTIFY_WEB_PLAYER_NAME,
    playbackReady: candidate.playbackReady === true && Boolean(normalizeText(candidate.playbackDeviceId)),
    playbackConnecting: candidate.playbackConnecting === true,
    playbackBusyTrackUri: normalizeText(candidate.playbackBusyTrackUri),
    playbackBusyPlaylistUri: normalizeText(candidate.playbackBusyPlaylistUri),
    playbackCurrentTrack: normalizeSpotifyTrack(candidate.playbackCurrentTrack),
    playbackCurrentPlaylist: normalizeSpotifyPlaylist(candidate.playbackCurrentPlaylist),
    playbackContextUri: normalizeText(candidate.playbackContextUri ?? candidate.contextUri),
    playbackPaused: candidate.playbackPaused === true,
    playbackPositionMs: Math.max(0, Math.round(Number(candidate.playbackPositionMs ?? candidate.positionMs) || 0)),
    playbackDurationMs: Math.max(0, Math.round(Number(candidate.playbackDurationMs ?? candidate.durationMs) || 0)),
    playbackStateUpdatedAt: Math.max(0, Math.round(Number(candidate.playbackStateUpdatedAt) || 0)),
    playbackControlBusy: candidate.playbackControlBusy === true,
    authBusy: candidate.authBusy === true,
    searchBusy: candidate.searchBusy === true,
    playlistBusy: candidate.playlistBusy === true,
    playlistTracksBusy: candidate.playlistTracksBusy === true,
    tempoBusy: candidate.tempoBusy === true,
    queueBusyTrackUri: normalizeText(candidate.queueBusyTrackUri),
  };
}

export function isSpotifyMusicConnected(state = {}, now = Date.now()) {
  const token = normalizeSpotifyToken(state?.token);
  return Boolean(
    token?.accessToken &&
    (!Number.isFinite(token.expiresAt) || token.expiresAt - TOKEN_REFRESH_SKEW_MS > now)
  );
}

export function createSpotifyMusicService({
  fetchFn,
  cryptoRef = globalThis.crypto,
  windowRef = globalThis,
  documentRef = globalThis.document,
  authStorage = null,
  playbackStateStorage = null,
  tokenStorage = null,
  now = () => Date.now(),
  logger = console,
} = {}) {
  if (typeof fetchFn !== "function") {
    throw new TypeError("createSpotifyMusicService requires a fetch function.");
  }

  const webPlaybackRuntime = createSpotifyWebPlaybackRuntime();

  return {
    resolveRedirectUri: (href) => resolveSpotifyRedirectUri(href),
    hasAuthorizationResponse: (href) => hasSpotifyAuthorizationResponse(href),
    hasPlaybackScope: (token) => isSpotifyTokenAuthorizedForPlayback(token),
    hasPlaylistScope: (token) => isSpotifyTokenAuthorizedForPlaylists(token),
    getStoredToken: () => readStoredSpotifyToken(tokenStorage),
    saveToken: (token) => writeStoredSpotifyToken(tokenStorage, token),
    clearToken: () => removeStorageValue(tokenStorage, SPOTIFY_MUSIC_TOKEN_STORAGE_KEY),
    getStoredPlaybackState: () => readStoredSpotifyPlaybackState(playbackStateStorage),
    savePlaybackState: (playbackState) => writeStoredSpotifyPlaybackState(playbackStateStorage, playbackState, { now }),
    clearPlaybackState: () => removeStorageValue(playbackStateStorage, SPOTIFY_MUSIC_PLAYBACK_STATE_STORAGE_KEY),
    beginAuthorization: (input) => beginSpotifyAuthorization(input, {
      authStorage,
      cryptoRef,
      logger,
    }),
    exchangeAuthorizationCode: (input) => exchangeSpotifyAuthorizationCode(input, {
      authStorage,
      fetchFn,
      now,
      tokenStorage,
      logger,
    }),
    ensureFreshToken: (input) => ensureFreshSpotifyToken(input, {
      fetchFn,
      now,
      tokenStorage,
      logger,
    }),
    searchTracks: (input) => searchSpotifyTracks(input, {
      fetchFn,
      logger,
    }),
    loadCurrentUserProfile: (input) => loadSpotifyCurrentUserProfile(input, {
      fetchFn,
      logger,
    }),
    loadPlaylists: (input) => loadSpotifyPlaylists(input, {
      fetchFn,
      logger,
    }),
    loadPlaylistTracks: (input) => loadSpotifyPlaylistTracks(input, {
      fetchFn,
      logger,
    }),
    enrichTracksWithTempo: (input) => enrichSpotifyTracksWithTempo(input, {
      fetchFn,
      logger,
    }),
    queueTrack: (input) => queueSpotifyTrack(input, {
      fetchFn,
      logger,
    }),
    connectWebPlayback: (input) => connectSpotifyWebPlayback(input, {
      documentRef,
      logger,
      runtime: webPlaybackRuntime,
      windowRef,
    }),
    disconnectWebPlayback: () => disconnectSpotifyWebPlayback(webPlaybackRuntime, { logger }),
    startTrackPlayback: (input) => startSpotifyTrackPlayback(input, {
      fetchFn,
      logger,
    }),
    startPlaylistPlayback: (input) => startSpotifyPlaylistPlayback(input, {
      fetchFn,
      logger,
    }),
    togglePlayback: () => runSpotifyWebPlaybackCommand(webPlaybackRuntime, "togglePlay", {
      logger,
      successMessage: "Playback toggled.",
      failureMessage: "Spotify play/pause command failed.",
    }),
    nextTrack: () => runSpotifyWebPlaybackCommand(webPlaybackRuntime, "nextTrack", {
      logger,
      successMessage: "Skipped to next Spotify track.",
      failureMessage: "Spotify next-track command failed.",
    }),
    previousTrack: () => runSpotifyWebPlaybackCommand(webPlaybackRuntime, "previousTrack", {
      logger,
      successMessage: "Returned to previous Spotify track.",
      failureMessage: "Spotify previous-track command failed.",
    }),
    seekPlayback: (input) => seekSpotifyWebPlayback(input, {
      logger,
      runtime: webPlaybackRuntime,
    }),
  };
}

export function renderSpotifyMusicPanelHTML(options = {}) {
  const state = createDefaultSpotifyMusicPanelState(options.state ?? options);
  const connected = isSpotifyMusicConnected(state);
  const hasClientId = Boolean(state.clientId || state.clientIdDraft);
  const playlistAuthorized = isSpotifyTokenAuthorizedForPlaylists(state.token);
  const canSearch = connected && !state.searchBusy;
  const sourceMode = normalizeSpotifyMusicSourceMode(state.sourceMode);
  const visibleTracks = sourceMode === "playlists" ? state.playlistTrackResults : state.searchResults;
  const canConnect = hasClientId && !state.authBusy;
  const statusMessage = state.queueStatus
    || state.searchStatus
    || state.playlistStatus
    || state.tempoStatus
    || state.authStatus;
  return `
    <section class="spotify-music-panel" aria-label="Spotify music queue">
      <div class="panel-heading spotify-music-panel__heading">
        <p class="panel-kicker spotify-music-panel__kicker">Writing soundtrack</p>
        <div class="spotify-music-panel__title-row">
          <div class="spotify-music-panel__identity">
            <h2>Spotify</h2>
            <span class="spotify-music-panel__status ${connected ? "is-connected" : "is-disconnected"}">
              ${connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          ${renderSpotifyAccountMenuHTML(state, { connected, canConnect })}
        </div>
      </div>

      <section class="spotify-music-panel__section spotify-music-panel__library">
        <div class="spotify-music-panel__source-tabs" role="tablist" aria-label="Spotify source">
          <button
            class="spotify-music-panel__source-tab ${sourceMode === "search" ? "is-active" : ""}"
            type="button"
            data-action="spotify-set-source"
            data-spotify-source="search"
            aria-selected="${sourceMode === "search" ? "true" : "false"}"
          >Search</button>
          <button
            class="spotify-music-panel__source-tab ${sourceMode === "playlists" ? "is-active" : ""}"
            type="button"
            data-action="spotify-set-source"
            data-spotify-source="playlists"
            aria-selected="${sourceMode === "playlists" ? "true" : "false"}"
          >Playlists</button>
        </div>
        ${sourceMode === "playlists"
          ? renderSpotifyPlaylistBrowserHTML(state, { connected, playlistAuthorized })
          : renderSpotifySearchControlsHTML(state, { canSearch, connected })}
      </section>

      ${statusMessage ? `<p class="spotify-music-panel__message">${escapeHtml(statusMessage)}</p>` : ""}
      ${renderSpotifyTempoReferenceHTML(visibleTracks, {
        connected,
        tempoBusy: state.tempoBusy,
        tempoStatus: state.tempoStatus,
      })}
      ${renderSpotifyTrackResultsHTML(state, visibleTracks, {
        emptyLabel: sourceMode === "playlists"
          ? state.selectedPlaylistId ? "No tracks loaded from this playlist." : "Choose a playlist to inspect its tracks."
          : "No tracks loaded.",
        heading: sourceMode === "playlists"
          ? state.selectedPlaylistName || "Playlist tracks"
          : "Search results",
      })}
      ${renderSpotifyQueueHistoryHTML(state.queueHistory)}
    </section>
  `;
}

export function renderSpotifyMusicChromeHTML(options = {}) {
  const state = createDefaultSpotifyMusicPanelState(options.state ?? options.spotifyMusic ?? {});
  const open = options.open === true;
  const connected = isSpotifyMusicConnected(state);
  const hasClientId = Boolean(state.clientId || state.clientIdDraft);
  const playbackAuthorized = isSpotifyTokenAuthorizedForPlayback(state.token);
  const playbackReady = connected && playbackAuthorized && state.playbackReady;
  const canStartPlayer = connected && playbackAuthorized && !state.playbackConnecting;
  const canSearch = connected && !state.searchBusy;
  return `
    <div class="spotify-music-chrome ${open ? "is-open" : ""}" data-spotify-music-chrome>
      <div class="spotify-music-chrome__search">
        <input
          type="search"
          value="${escapeHtml(state.query)}"
          data-spotify-search-query
          aria-label="Search Spotify tracks"
          placeholder="Search writing soundtrack"
          ${connected ? "" : "disabled"}
        />
        <button
          class="spotify-music-chrome__search-button"
          type="button"
          data-action="spotify-search"
          ${canSearch ? "" : "disabled"}
        >Search</button>
      </div>
      ${renderSpotifyCompactPlayerHTML(state, {
        canStartPlayer,
        connected,
        hasClientId,
        open,
        playbackAuthorized,
        playbackReady,
      })}
      ${open ? `
        <div class="spotify-music-popover" role="dialog" aria-label="Spotify music integration panel">
          <button
            class="spotify-music-popover__close"
            type="button"
            data-action="close-spotify-music-panel"
            aria-label="Close Spotify music panel"
            title="Close"
          >x</button>
          ${renderSpotifyMusicPanelHTML({ state })}
        </div>
      ` : ""}
    </div>
  `;
}

function renderSpotifyCompactPlayerHTML(state = {}, {
  canStartPlayer = false,
  connected = false,
  hasClientId = false,
  open = false,
  playbackAuthorized = false,
  playbackReady = false,
} = {}) {
  const view = createSpotifyPlaybackPresentation(state, {
    connected,
    hasClientId,
    playbackAuthorized,
    playbackReady,
  });
  const startLabel = state.playbackConnecting ? "Starting" : "Start";
  return `
    <section class="spotify-compact-player" aria-label="Spotify writing soundtrack player">
      <button
        class="spotify-compact-player__account"
        type="button"
        data-action="toggle-spotify-music-panel"
        aria-expanded="${open ? "true" : "false"}"
        aria-haspopup="dialog"
        title="Open Spotify writing soundtrack"
      >
        ${renderSpotifyAvatarHTML(state, {
          className: "spotify-compact-player__avatar",
          connected,
        })}
        <span class="spotify-compact-player__account-copy">
          <span>Spotify</span>
          <strong>${escapeHtml(view.statusLabel)}</strong>
        </span>
      </button>
      <button
        class="spotify-compact-player__now"
        type="button"
        data-action="toggle-spotify-music-panel"
        aria-expanded="${open ? "true" : "false"}"
        aria-haspopup="dialog"
        title="Open Spotify search and queue"
      >
        ${view.artworkUrl ? `
          <img
            class="spotify-compact-player__art"
            src="${escapeHtml(view.artworkUrl)}"
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        ` : `<span class="spotify-compact-player__art is-placeholder" aria-hidden="true"></span>`}
        <span class="spotify-compact-player__track">
          <strong title="${escapeHtml(view.nowTitle)}">${escapeHtml(view.nowTitle)}</strong>
          <span title="${escapeHtml(view.nowDetail)}">${escapeHtml(view.nowDetail)}</span>
        </span>
      </button>
      <div class="spotify-compact-player__controls" role="group" aria-label="Spotify playback controls">
        ${playbackReady ? `
          <button
            class="spotify-player-card__control spotify-compact-player__control"
            type="button"
            data-action="spotify-previous-track"
            aria-label="Previous track"
            title="Previous track"
            ${view.canControlPlayback ? "" : "disabled"}
          ><span class="spotify-player-icon spotify-player-icon--previous" aria-hidden="true"></span></button>
          <button
            class="spotify-player-card__control spotify-player-card__control--primary spotify-compact-player__control spotify-compact-player__control--primary"
            type="button"
            data-action="spotify-toggle-playback"
            aria-label="${escapeHtml(view.playPauseLabel)}"
            title="${escapeHtml(view.playPauseLabel)}"
            ${view.canControlPlayback ? "" : "disabled"}
          ><span class="spotify-player-icon spotify-player-icon--${state.playbackPaused === true ? "play" : "pause"}" aria-hidden="true"></span></button>
          <button
            class="spotify-player-card__control spotify-compact-player__control"
            type="button"
            data-action="spotify-next-track"
            aria-label="Next track"
            title="Next track"
            ${view.canControlPlayback ? "" : "disabled"}
          ><span class="spotify-player-icon spotify-player-icon--next" aria-hidden="true"></span></button>
        ` : `
          <button
            class="spotify-compact-player__start"
            type="button"
            data-action="spotify-start-player"
            aria-label="Start ABE Spotify player"
            title="Start ABE Spotify player"
            ${canStartPlayer ? "" : "disabled"}
          >${escapeHtml(startLabel)}</button>
        `}
      </div>
      <label class="spotify-compact-player__progress">
        <span data-spotify-playback-position-label>${escapeHtml(formatSpotifyPlaybackTimeLabel(view.positionMs))}</span>
        <input
          type="range"
          min="0"
          max="${Math.max(view.durationMs, 1)}"
          step="1000"
          value="${view.positionMs}"
          data-spotify-playback-seek
          data-spotify-playback-surface="chrome"
          aria-label="Spotify playback position"
          ${view.canSeek ? "" : "disabled"}
        />
        <strong data-spotify-playback-duration-label>${escapeHtml(formatSpotifyPlaybackTimeLabel(view.durationMs))}</strong>
      </label>
    </section>
  `;
}

export function renderSpotifyDeveloperOptionsHTML(options = {}) {
  const state = createDefaultSpotifyMusicPanelState(options.state ?? options.spotifyMusic ?? options);
  const hasClientId = Boolean(state.clientId || state.clientIdDraft);
  const clientIdSourceLabel = state.clientIdSource === "desktop"
    ? "Spotify app configured by the desktop host."
    : state.clientIdSource === "manual"
      ? "Spotify app ID saved on this browser."
      : "This local build needs a Spotify app ID before the sign-in screen can open.";
  return `
    <div class="spotify-developer-options" data-spotify-developer-options>
      <span class="file-menu-label">Spotify app setup</span>
      <p class="spotify-music-panel__requirement">${escapeHtml(clientIdSourceLabel)}</p>
      <label class="spotify-music-panel__field">
        <span>Spotify app Client ID</span>
        <input
          type="text"
          value="${escapeHtml(state.clientIdDraft)}"
          data-spotify-client-id
          aria-label="Spotify app Client ID"
          spellcheck="false"
        />
      </label>
      <label class="spotify-music-panel__field">
        <span>Redirect URI</span>
        <input
          type="text"
          value="${escapeHtml(state.redirectUri)}"
          aria-label="Spotify redirect URI"
          spellcheck="false"
          readonly
        />
      </label>
      <button
        class="tag-button panel-action-button"
        type="button"
        data-action="spotify-save-client-id"
      >${hasClientId ? "Save app ID" : "Save app ID"}</button>
    </div>
  `;
}

export function normalizeSpotifyTracks(candidate = []) {
  return (Array.isArray(candidate) ? candidate : [])
    .map(normalizeSpotifyTrack)
    .filter((track) => track.uri);
}

export function normalizeSpotifyTrack(candidate = {}) {
  const rawArtists = Array.isArray(candidate?.artists)
    ? candidate.artists
    : Array.isArray(candidate?.artistNames)
      ? candidate.artistNames
      : [];
  const artistNames = rawArtists
    .map((artist) => normalizeText(typeof artist === "string" ? artist : artist?.name))
    .filter(Boolean);
  const tempo = normalizeSpotifyTrackTempo(candidate);
  return {
    id: normalizeText(candidate?.id),
    uri: normalizeText(candidate?.uri),
    title: normalizeText(candidate?.title || candidate?.name),
    artistNames,
    albumName: normalizeText(candidate?.albumName || candidate?.album?.name),
    durationMs: Math.max(0, Math.round(Number(candidate?.durationMs ?? candidate?.duration_ms) || 0)),
    imageUrl: normalizeText(candidate?.imageUrl || selectSpotifyImage(candidate?.album?.images)?.url),
    externalUrl: normalizeText(candidate?.externalUrl || candidate?.external_urls?.spotify),
    rawTempoBpm: tempo.rawTempoBpm,
    tempoBpm: tempo.tempoBpm,
    tempoBucket: tempo.tempoBucket,
    tempoSource: tempo.tempoSource,
    tempoConfidence: tempo.tempoConfidence,
    timeSignature: tempo.timeSignature,
    energy: tempo.energy,
    danceability: tempo.danceability,
  };
}

export function normalizeSpotifyPlaylists(candidate = []) {
  return (Array.isArray(candidate) ? candidate : [])
    .map(normalizeSpotifyPlaylist)
    .filter((playlist) => playlist.id);
}

export function normalizeSpotifyPlaylist(candidate = {}) {
  const ownerId = normalizeText(candidate?.ownerId || candidate?.owner?.id);
  const currentUserId = normalizeText(candidate?.currentUserId);
  const collaborative = candidate?.collaborative === true;
  // Intent: track-list visibility is separate from whether Spotify can play the playlist context.
  const canReadTracks = candidate?.canReadTracks === false
    ? false
    : currentUserId
      ? ownerId === currentUserId || collaborative
      : true;
  return {
    id: normalizeText(candidate?.id),
    uri: normalizeText(candidate?.uri),
    title: normalizeText(candidate?.title || candidate?.name),
    ownerId,
    ownerName: normalizeText(candidate?.ownerName || candidate?.owner?.display_name || candidate?.owner?.id),
    collaborative,
    canReadTracks,
    trackTotal: Math.max(0, Math.round(Number(
      candidate?.trackTotal
      ?? candidate?.items?.total
      ?? candidate?.tracks?.total
    ) || 0)),
    imageUrl: normalizeText(candidate?.imageUrl || selectSpotifyImage(candidate?.images)?.url),
    externalUrl: normalizeText(candidate?.externalUrl || candidate?.external_urls?.spotify),
  };
}

export function createSpotifyPlaybackResumeState(candidate = {}, {
  now = () => Date.now(),
} = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const currentTrack = normalizeSpotifyTrack(
    candidate.playbackCurrentTrack
    ?? candidate.currentTrack
    ?? candidate.track
  );
  if (!currentTrack.uri) {
    return null;
  }

  const currentPlaylist = normalizeSpotifyPlaylist(
    candidate.playbackCurrentPlaylist
    ?? candidate.currentPlaylist
    ?? candidate.playlist
  );
  const contextUri = normalizeText(
    candidate.playbackContextUri
    ?? candidate.contextUri
    ?? candidate.playlistUri
    ?? currentPlaylist.uri
  );
  const rawDurationMs = Math.max(0, Math.round(Number(
    candidate.playbackDurationMs
    ?? candidate.durationMs
    ?? currentTrack.durationMs
  ) || 0));
  const rawPositionMs = Math.max(0, Math.round(Number(
    candidate.playbackPositionMs
    ?? candidate.positionMs
  ) || 0));
  const positionMs = rawDurationMs > 0 ? Math.min(rawPositionMs, rawDurationMs) : rawPositionMs;
  const savedAt = Math.max(0, Math.round(Number(
    candidate.savedAt
    ?? candidate.playbackStateUpdatedAt
    ?? now()
  ) || 0));

  return {
    currentTrack,
    currentPlaylist: currentPlaylist.uri ? currentPlaylist : null,
    contextUri,
    trackUri: currentTrack.uri,
    playlistUri: currentPlaylist.uri || (contextUri.startsWith("spotify:playlist:") ? contextUri : ""),
    paused: candidate.paused === true || candidate.playbackPaused === true,
    positionMs,
    durationMs: rawDurationMs,
    savedAt,
  };
}

export function mapSpotifyApiTrack(apiTrack = {}) {
  return normalizeSpotifyTrack({
    id: apiTrack.id,
    uri: apiTrack.uri,
    title: apiTrack.name,
    artists: apiTrack.artists,
    albumName: apiTrack.album?.name,
    durationMs: apiTrack.duration_ms,
    imageUrl: selectSpotifyImage(apiTrack.album?.images)?.url,
    externalUrl: apiTrack.external_urls?.spotify,
  });
}

export function mapSpotifyApiPlaylist(apiPlaylist = {}, {
  currentUserId = "",
} = {}) {
  return normalizeSpotifyPlaylist({
    id: apiPlaylist.id,
    uri: apiPlaylist.uri,
    title: apiPlaylist.name,
    ownerId: apiPlaylist.owner?.id,
    ownerName: apiPlaylist.owner?.display_name || apiPlaylist.owner?.id,
    collaborative: apiPlaylist.collaborative === true,
    currentUserId,
    trackTotal: apiPlaylist.items?.total ?? apiPlaylist.tracks?.total,
    imageUrl: selectSpotifyImage(apiPlaylist.images)?.url,
    externalUrl: apiPlaylist.external_urls?.spotify,
  });
}

export function createSpotifyTempoReference(tracks = []) {
  const normalizedTracks = normalizeSpotifyTracks(tracks);
  const tempoTracks = normalizedTracks.filter((track) => track.tempoBpm > 0);
  if (!tempoTracks.length) {
    return {
      trackCount: normalizedTracks.length,
      count: 0,
      averageBpm: 0,
      medianBpm: 0,
      spreadBpm: 0,
      bucket: "",
      stability: "unavailable",
    };
  }

  const weightedTempoTotal = tempoTracks.reduce((total, track) => {
    const weight = Math.max(1, Number(track.durationMs) || 1);
    return total + track.tempoBpm * weight;
  }, 0);
  const weightTotal = tempoTracks.reduce((total, track) => total + Math.max(1, Number(track.durationMs) || 1), 0);
  const tempos = tempoTracks.map((track) => track.tempoBpm).sort((a, b) => a - b);
  const averageBpm = roundTempo(weightedTempoTotal / weightTotal);
  const medianBpm = roundTempo(tempos.length % 2
    ? tempos[Math.floor(tempos.length / 2)]
    : (tempos[tempos.length / 2 - 1] + tempos[tempos.length / 2]) / 2);
  const spreadBpm = roundTempo(Math.sqrt(
    tempoTracks.reduce((total, track) => total + (track.tempoBpm - averageBpm) ** 2, 0) / tempoTracks.length
  ));
  return {
    trackCount: normalizedTracks.length,
    count: tempoTracks.length,
    averageBpm,
    medianBpm,
    spreadBpm,
    bucket: describeTempoBucket(averageBpm),
    stability: describeTempoStability(tempoTracks.length, spreadBpm),
  };
}

export function createSpotifyTokenFromResponse(response = {}, {
  previousToken = null,
  now = Date.now,
} = {}) {
  const expiresInSeconds = Math.max(0, Math.round(Number(response.expires_in) || 0));
  const expiresAt = expiresInSeconds > 0
    ? now() + expiresInSeconds * 1000
    : null;
  return normalizeSpotifyToken({
    accessToken: response.access_token,
    refreshToken: response.refresh_token || previousToken?.refreshToken || "",
    tokenType: response.token_type || previousToken?.tokenType || "Bearer",
    scope: response.scope || previousToken?.scope || SPOTIFY_AUTHORIZATION_SCOPE,
    expiresAt,
  });
}

export function isSpotifyTokenAuthorizedForPlayback(token = null) {
  return spotifyTokenHasScopes(token, SPOTIFY_PLAYBACK_REQUIRED_SCOPES);
}

export function isSpotifyTokenAuthorizedForPlaylists(token = null) {
  return spotifyTokenHasScopes(token, SPOTIFY_PLAYLIST_REQUIRED_SCOPES);
}

export function resolveSpotifyRedirectUri(href = "") {
  const source = normalizeText(href) || globalThis.location?.href || "";
  try {
    const url = new URL(source);
    // Intent: keep local launch/session query params out of the Spotify dashboard allowlist.
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function cleanSpotifyAuthorizationParams(href = "") {
  try {
    const url = new URL(href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("error");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

export function hasSpotifyAuthorizationResponse(href = "") {
  try {
    const url = new URL(href || globalThis.location?.href || "");
    return url.searchParams.has("code") || url.searchParams.has("error");
  } catch {
    return false;
  }
}

async function beginSpotifyAuthorization({
  clientId = "",
  redirectUri = "",
  scope = SPOTIFY_AUTHORIZATION_SCOPE,
} = {}, {
  authStorage,
  cryptoRef,
  logger,
} = {}) {
  const normalizedClientId = normalizeText(clientId);
  const normalizedRedirectUri = normalizeText(redirectUri);
  if (!normalizedClientId) {
    return {
      ok: false,
      message: "Spotify client ID required.",
    };
  }
  if (!normalizedRedirectUri) {
    return {
      ok: false,
      message: "Spotify redirect URI unavailable.",
    };
  }

  try {
    const verifier = createPkceRandomString(64, cryptoRef);
    const state = createPkceRandomString(32, cryptoRef);
    const challenge = await createPkceChallenge(verifier, cryptoRef);
    writeStorageValue(authStorage, SPOTIFY_PKCE_VERIFIER_STORAGE_KEY, verifier);
    writeStorageValue(authStorage, SPOTIFY_PKCE_STATE_STORAGE_KEY, state);
    const authUrl = new URL(SPOTIFY_AUTHORIZE_ENDPOINT);
    authUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: normalizedClientId,
      scope,
      redirect_uri: normalizedRedirectUri,
      state,
      code_challenge_method: "S256",
      code_challenge: challenge,
    }).toString();
    return {
      ok: true,
      authorizationUrl: authUrl.toString(),
      state,
      scope,
    };
  } catch (error) {
    logger?.warn?.("Spotify authorization setup failed", error);
    return {
      ok: false,
      message: "Spotify authorization setup failed.",
    };
  }
}

async function exchangeSpotifyAuthorizationCode({
  clientId = "",
  redirectUri = "",
  href = "",
} = {}, {
  authStorage,
  fetchFn,
  now,
  tokenStorage,
  logger,
} = {}) {
  let url;
  try {
    url = new URL(href || globalThis.location?.href || "");
  } catch {
    return {
      handled: false,
      ok: false,
      message: "",
    };
  }

  if (!url.searchParams.has("code") && !url.searchParams.has("error")) {
    return {
      handled: false,
      ok: false,
      message: "",
    };
  }

  if (url.searchParams.has("error")) {
    clearSpotifyPkceStorage(authStorage);
    return {
      handled: true,
      ok: false,
      cleanUrl: cleanSpotifyAuthorizationParams(url.toString()),
      message: `Spotify authorization failed: ${url.searchParams.get("error") || "access_denied"}.`,
    };
  }

  const expectedState = readStorageValue(authStorage, SPOTIFY_PKCE_STATE_STORAGE_KEY);
  const returnedState = normalizeText(url.searchParams.get("state"));
  const codeVerifier = readStorageValue(authStorage, SPOTIFY_PKCE_VERIFIER_STORAGE_KEY);
  if (!expectedState || returnedState !== expectedState || !codeVerifier) {
    clearSpotifyPkceStorage(authStorage);
    return {
      handled: true,
      ok: false,
      cleanUrl: cleanSpotifyAuthorizationParams(url.toString()),
      message: "Spotify authorization state could not be verified.",
    };
  }

  try {
    const response = await fetchFn(SPOTIFY_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: normalizeText(clientId),
        grant_type: "authorization_code",
        code: normalizeText(url.searchParams.get("code")),
        redirect_uri: normalizeText(redirectUri),
        code_verifier: codeVerifier,
      }),
    });
    const body = await readResponseJson(response);
    if (!response?.ok) {
      clearSpotifyPkceStorage(authStorage);
      return {
        handled: true,
        ok: false,
        cleanUrl: cleanSpotifyAuthorizationParams(url.toString()),
        message: mapSpotifyErrorMessage(response?.status, body, "Spotify authorization failed."),
      };
    }

    const token = createSpotifyTokenFromResponse(body, { now });
    writeStoredSpotifyToken(tokenStorage, token);
    clearSpotifyPkceStorage(authStorage);
    return {
      handled: true,
      ok: true,
      token,
      cleanUrl: cleanSpotifyAuthorizationParams(url.toString()),
      message: "Spotify connected.",
    };
  } catch (error) {
    logger?.warn?.("Spotify token exchange failed", error);
    return {
      handled: true,
      ok: false,
      cleanUrl: cleanSpotifyAuthorizationParams(url.toString()),
      message: "Spotify authorization failed.",
    };
  }
}

async function ensureFreshSpotifyToken({
  clientId = "",
  token = null,
} = {}, {
  fetchFn,
  now,
  tokenStorage,
  logger,
} = {}) {
  const normalizedToken = normalizeSpotifyToken(token);
  if (!normalizedToken?.accessToken) {
    return {
      ok: false,
      token: null,
      message: "Spotify connection required.",
    };
  }

  const expiresAt = Number(normalizedToken.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt - TOKEN_REFRESH_SKEW_MS > now()) {
    return {
      ok: true,
      token: normalizedToken,
      refreshed: false,
    };
  }

  if (!normalizedToken.refreshToken) {
    return {
      ok: false,
      token: null,
      message: "Spotify connection expired.",
    };
  }

  try {
    const response = await fetchFn(SPOTIFY_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: normalizeText(clientId),
        grant_type: "refresh_token",
        refresh_token: normalizedToken.refreshToken,
      }),
    });
    const body = await readResponseJson(response);
    if (!response?.ok) {
      return {
        ok: false,
        token: null,
        message: mapSpotifyErrorMessage(response?.status, body, "Spotify token refresh failed."),
      };
    }

    const tokenState = createSpotifyTokenFromResponse(body, {
      previousToken: normalizedToken,
      now,
    });
    writeStoredSpotifyToken(tokenStorage, tokenState);
    return {
      ok: true,
      token: tokenState,
      refreshed: true,
    };
  } catch (error) {
    logger?.warn?.("Spotify token refresh failed", error);
    return {
      ok: false,
      token: null,
      message: "Spotify token refresh failed.",
    };
  }
}

async function searchSpotifyTracks({
  accessToken = "",
  query = "",
  limit = DEFAULT_TRACK_LIMIT,
} = {}, {
  fetchFn,
  logger,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  const normalizedQuery = normalizeText(query);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      tracks: [],
      message: "Spotify connection required.",
    };
  }
  if (!normalizedQuery) {
    return {
      ok: false,
      tracks: [],
      message: "Search text required.",
    };
  }

  const searchUrl = new URL(`${SPOTIFY_API_ROOT}/search`);
  searchUrl.search = new URLSearchParams({
    q: normalizedQuery,
    type: "track",
    limit: String(clampTrackLimit(limit)),
  }).toString();

  try {
    const response = await fetchFn(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
      },
    });
    const body = await readResponseJson(response);
    if (!response?.ok) {
      return {
        ok: false,
        tracks: [],
        message: mapSpotifyErrorMessage(response?.status, body, "Spotify search failed."),
      };
    }

    const tracks = normalizeSpotifyTracks(body?.tracks?.items?.map(mapSpotifyApiTrack));
    return {
      ok: true,
      tracks,
      message: tracks.length ? `${tracks.length} tracks found.` : "No tracks found.",
    };
  } catch (error) {
    logger?.warn?.("Spotify search failed", error);
    return {
      ok: false,
      tracks: [],
      message: "Spotify search failed.",
    };
  }
}

async function loadSpotifyCurrentUserProfile({
  accessToken = "",
} = {}, {
  fetchFn,
  logger,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      userId: "",
      message: "Spotify connection required.",
    };
  }

  try {
    const response = await fetchFn(`${SPOTIFY_API_ROOT}/me`, {
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
      },
    });
    const body = await readResponseJson(response);
    if (!response?.ok) {
      return {
        ok: false,
        userId: "",
        message: mapSpotifyErrorMessage(response?.status, body, "Spotify profile unavailable."),
      };
    }

    const userId = normalizeText(body?.id);
    const profileImage = selectSpotifyImage(body?.images);
    return {
      ok: Boolean(userId),
      userId,
      displayName: normalizeText(body?.display_name),
      imageUrl: normalizeText(profileImage?.url),
      externalUrl: normalizeText(body?.external_urls?.spotify),
      message: userId ? "Spotify profile loaded." : "Spotify profile unavailable.",
    };
  } catch (error) {
    logger?.warn?.("Spotify profile load failed", error);
    return {
      ok: false,
      userId: "",
      message: "Spotify profile unavailable.",
    };
  }
}

async function loadSpotifyPlaylists({
  accessToken = "",
  currentUserId = "",
  limit = DEFAULT_PLAYLIST_LIMIT,
  offset = 0,
} = {}, {
  fetchFn,
  logger,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      playlists: [],
      message: "Spotify connection required.",
    };
  }

  const playlistsUrl = new URL(`${SPOTIFY_API_ROOT}/me/playlists`);
  playlistsUrl.searchParams.set("limit", String(clampSpotifyPageLimit(limit, 50, DEFAULT_PLAYLIST_LIMIT)));
  playlistsUrl.searchParams.set("offset", String(Math.max(0, Math.round(Number(offset) || 0))));
  try {
    const response = await fetchFn(playlistsUrl.toString(), {
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
      },
    });
    const body = await readResponseJson(response);
    if (!response?.ok) {
      return {
        ok: false,
        playlists: [],
        message: mapSpotifyErrorMessage(response?.status, body, "Spotify playlists unavailable."),
      };
    }

    const playlists = normalizeSpotifyPlaylists(
      body?.items?.map((playlist) => mapSpotifyApiPlaylist(playlist, { currentUserId }))
    );
    return {
      ok: true,
      playlists,
      total: Math.max(0, Math.round(Number(body?.total) || playlists.length)),
      message: playlists.length ? `${playlists.length} playlists loaded.` : "No playlists found.",
    };
  } catch (error) {
    logger?.warn?.("Spotify playlist load failed", error);
    return {
      ok: false,
      playlists: [],
      message: "Spotify playlists unavailable.",
    };
  }
}

async function loadSpotifyPlaylistTracks({
  accessToken = "",
  playlistId = "",
  limit = DEFAULT_PLAYLIST_TRACK_LIMIT,
  offset = 0,
} = {}, {
  fetchFn,
  logger,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  const normalizedPlaylistId = normalizeText(playlistId);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      tracks: [],
      message: "Spotify connection required.",
    };
  }
  if (!normalizedPlaylistId) {
    return {
      ok: false,
      tracks: [],
      message: "Spotify playlist required.",
    };
  }

  const playlistTracksUrl = new URL(`${SPOTIFY_API_ROOT}/playlists/${encodeURIComponent(normalizedPlaylistId)}/items`);
  playlistTracksUrl.searchParams.set("limit", String(clampSpotifyPageLimit(limit, 50, DEFAULT_PLAYLIST_TRACK_LIMIT)));
  playlistTracksUrl.searchParams.set("offset", String(Math.max(0, Math.round(Number(offset) || 0))));
  playlistTracksUrl.searchParams.set("additional_types", "track");
  playlistTracksUrl.searchParams.set(
    "fields",
    "items(item(id,uri,name,duration_ms,artists(name),album(name,images),external_urls,type)),total,limit,offset,next"
  );
  try {
    const response = await fetchFn(playlistTracksUrl.toString(), {
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
      },
    });
    const body = await readResponseJson(response);
    if (!response?.ok) {
      return {
        ok: false,
        tracks: [],
        message: mapSpotifyPlaylistErrorMessage(response?.status, body),
      };
    }

    const tracks = normalizeSpotifyTracks(
      body?.items?.map((item) => mapSpotifyApiTrack(item?.item ?? item?.track)).filter(Boolean)
    );
    return {
      ok: true,
      tracks,
      total: Math.max(0, Math.round(Number(body?.total) || tracks.length)),
      message: tracks.length ? `${tracks.length} playlist tracks loaded.` : "No playlist tracks found.",
    };
  } catch (error) {
    logger?.warn?.("Spotify playlist track load failed", error);
    return {
      ok: false,
      tracks: [],
      message: "Spotify playlist tracks unavailable.",
    };
  }
}

async function enrichSpotifyTracksWithTempo({
  accessToken = "",
  tracks = [],
} = {}, {
  fetchFn,
  logger,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  const normalizedTracks = normalizeSpotifyTracks(tracks);
  const trackIds = Array.from(new Set(normalizedTracks.map((track) => track.id).filter(Boolean))).slice(0, 100);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      tracks: normalizedTracks,
      tempoReference: createSpotifyTempoReference(normalizedTracks),
      message: "Spotify connection required for tempo.",
    };
  }
  if (!trackIds.length) {
    return {
      ok: true,
      tracks: normalizedTracks,
      tempoReference: createSpotifyTempoReference(normalizedTracks),
      message: "Tempo unavailable for these tracks.",
    };
  }

  const tempoUrl = new URL(`${SPOTIFY_API_ROOT}/audio-features`);
  tempoUrl.searchParams.set("ids", trackIds.join(","));
  try {
    const response = await fetchFn(tempoUrl.toString(), {
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
      },
    });
    const body = await readResponseJson(response);
    if (!response?.ok) {
      return {
        ok: false,
        tracks: normalizedTracks,
        tempoReference: createSpotifyTempoReference(normalizedTracks),
        message: mapSpotifyTempoErrorMessage(response?.status, body),
      };
    }

    const featureByTrackId = new Map(
      (Array.isArray(body?.audio_features) ? body.audio_features : [])
        .filter((feature) => feature?.id)
        .map((feature) => [normalizeText(feature.id), feature])
    );
    const enrichedTracks = normalizedTracks.map((track) => {
      const feature = featureByTrackId.get(track.id);
      if (!feature) {
        return track;
      }

      return normalizeSpotifyTrack({
        ...track,
        rawTempoBpm: feature.tempo,
        tempoBpm: normalizeTempoForWritingReference(feature.tempo),
        tempoSource: "spotify-audio-features",
        tempoConfidence: Number.isFinite(Number(feature.tempo_confidence)) ? Number(feature.tempo_confidence) : null,
        timeSignature: Number.isFinite(Number(feature.time_signature)) ? Number(feature.time_signature) : null,
        energy: Number.isFinite(Number(feature.energy)) ? Number(feature.energy) : null,
        danceability: Number.isFinite(Number(feature.danceability)) ? Number(feature.danceability) : null,
      });
    });
    const tempoReference = createSpotifyTempoReference(enrichedTracks);
    return {
      ok: true,
      tracks: enrichedTracks,
      tempoReference,
      message: tempoReference.count
        ? `Tempo reference ready for ${tempoReference.count} tracks.`
        : "Spotify did not return tempo for these tracks.",
    };
  } catch (error) {
    logger?.warn?.("Spotify tempo enrichment failed", error);
    return {
      ok: false,
      tracks: normalizedTracks,
      tempoReference: createSpotifyTempoReference(normalizedTracks),
      message: "Spotify tempo data unavailable.",
    };
  }
}

async function queueSpotifyTrack({
  accessToken = "",
  trackUri = "",
} = {}, {
  fetchFn,
  logger,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  const normalizedTrackUri = normalizeText(trackUri);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      message: "Spotify connection required.",
    };
  }
  if (!normalizedTrackUri) {
    return {
      ok: false,
      message: "Spotify track URI required.",
    };
  }

  const queueUrl = new URL(`${SPOTIFY_API_ROOT}/me/player/queue`);
  queueUrl.searchParams.set("uri", normalizedTrackUri);
  try {
    const response = await fetchFn(queueUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
      },
    });
    if (response?.status === 204) {
      return {
        ok: true,
        message: "Track queued in Spotify.",
      };
    }
    const body = await readResponseJson(response);
    return {
      ok: false,
      message: mapSpotifyErrorMessage(response?.status, body, "Spotify queue command failed."),
    };
  } catch (error) {
    logger?.warn?.("Spotify queue command failed", error);
    return {
      ok: false,
      message: "Spotify queue command failed.",
    };
  }
}

async function startSpotifyTrackPlayback({
  accessToken = "",
  deviceId = "",
  positionMs = 0,
  trackUri = "",
} = {}, {
  fetchFn,
  logger,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  const normalizedDeviceId = normalizeText(deviceId);
  const normalizedPositionMs = Math.max(0, Math.round(Number(positionMs) || 0));
  const normalizedTrackUri = normalizeText(trackUri);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      message: "Spotify connection required.",
    };
  }
  if (!normalizedDeviceId) {
    return {
      ok: false,
      message: "ABE Spotify player is not ready.",
    };
  }
  if (!normalizedTrackUri) {
    return {
      ok: false,
      message: "Spotify track URI required.",
    };
  }

  const playUrl = new URL(`${SPOTIFY_API_ROOT}/me/player/play`);
  playUrl.searchParams.set("device_id", normalizedDeviceId);
  try {
    const playbackBody = {
      uris: [normalizedTrackUri],
    };
    if (normalizedPositionMs > 0) {
      playbackBody.position_ms = normalizedPositionMs;
    }

    const response = await fetchFn(playUrl.toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(playbackBody),
    });
    if (response?.status === 204) {
      return {
        ok: true,
        message: "Track playing in ABE.",
      };
    }
    const body = await readResponseJson(response);
    return {
      ok: false,
      message: mapSpotifyErrorMessage(response?.status, body, "Spotify playback command failed."),
    };
  } catch (error) {
    logger?.warn?.("Spotify playback command failed", error);
    return {
      ok: false,
      message: "Spotify playback command failed.",
    };
  }
}

async function startSpotifyPlaylistPlayback({
  accessToken = "",
  deviceId = "",
  playlistUri = "",
  positionMs = 0,
  trackUri = "",
} = {}, {
  fetchFn,
  logger,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  const normalizedDeviceId = normalizeText(deviceId);
  const normalizedPlaylistUri = normalizeText(playlistUri);
  const normalizedPositionMs = Math.max(0, Math.round(Number(positionMs) || 0));
  const normalizedTrackUri = normalizeText(trackUri);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      message: "Spotify connection required.",
    };
  }
  if (!normalizedDeviceId) {
    return {
      ok: false,
      message: "ABE Spotify player is not ready.",
    };
  }
  if (!normalizedPlaylistUri) {
    return {
      ok: false,
      message: "Spotify playlist URI required.",
    };
  }

  const playUrl = new URL(`${SPOTIFY_API_ROOT}/me/player/play`);
  playUrl.searchParams.set("device_id", normalizedDeviceId);
  try {
    const playbackBody = {
      context_uri: normalizedPlaylistUri,
    };
    if (normalizedTrackUri) {
      playbackBody.offset = {
        uri: normalizedTrackUri,
      };
    }
    if (normalizedPositionMs > 0) {
      playbackBody.position_ms = normalizedPositionMs;
    }

    const response = await fetchFn(playUrl.toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(playbackBody),
    });
    if (response?.status === 204) {
      return {
        ok: true,
        message: "Playlist playing in ABE.",
      };
    }
    const body = await readResponseJson(response);
    return {
      ok: false,
      message: mapSpotifyErrorMessage(response?.status, body, "Spotify playlist playback failed."),
    };
  } catch (error) {
    logger?.warn?.("Spotify playlist playback failed", error);
    return {
      ok: false,
      message: "Spotify playlist playback failed.",
    };
  }
}

function createSpotifyWebPlaybackRuntime() {
  return {
    deviceId: "",
    player: null,
    readyPromise: null,
    sdkPromise: null,
    accessToken: "",
  };
}

async function connectSpotifyWebPlayback({
  accessToken = "",
  onEvent = null,
  playerName = SPOTIFY_WEB_PLAYER_NAME,
  volume = 0.5,
} = {}, {
  documentRef,
  logger,
  runtime,
  windowRef,
} = {}) {
  const normalizedAccessToken = normalizeText(accessToken);
  if (!normalizedAccessToken) {
    return {
      ok: false,
      message: "Spotify connection required.",
    };
  }

  if (runtime.player && runtime.accessToken && runtime.accessToken !== normalizedAccessToken) {
    disconnectSpotifyWebPlayback(runtime, { logger });
  }

  if (runtime.player && runtime.deviceId) {
    return {
      ok: true,
      deviceId: runtime.deviceId,
      message: "ABE player ready.",
    };
  }

  if (runtime.readyPromise) {
    return runtime.readyPromise;
  }

  const sdkResult = await loadSpotifyWebPlaybackSdk({
    documentRef,
    logger,
    runtime,
    windowRef,
  });
  if (!sdkResult.ok) {
    return sdkResult;
  }

  runtime.accessToken = normalizedAccessToken;
  runtime.readyPromise = new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    const emitEvent = (type, payload = {}) => {
      if (typeof onEvent === "function") {
        onEvent({
          type,
          ...payload,
        });
      }
    };
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (!result.ok) {
        runtime.readyPromise = null;
      }
      resolve(result);
    };

    try {
      const player = new windowRef.Spotify.Player({
        name: normalizeText(playerName) || SPOTIFY_WEB_PLAYER_NAME,
        getOAuthToken: (callback) => callback(runtime.accessToken),
        volume: clampSpotifyVolume(volume),
      });
      runtime.player = player;

      // Intent: report Spotify Connect device lifecycle changes back to the shell without storing them in projects.
      player.addListener("ready", ({ device_id: deviceId } = {}) => {
        runtime.deviceId = normalizeText(deviceId);
        emitEvent("ready", {
          deviceId: runtime.deviceId,
          deviceName: normalizeText(playerName) || SPOTIFY_WEB_PLAYER_NAME,
        });
        finish({
          ok: Boolean(runtime.deviceId),
          deviceId: runtime.deviceId,
          message: runtime.deviceId ? "ABE player ready." : "Spotify player did not provide a device ID.",
        });
      });
      player.addListener("not_ready", ({ device_id: deviceId } = {}) => {
        if (runtime.deviceId === normalizeText(deviceId)) {
          runtime.deviceId = "";
        }
        emitEvent("not_ready", {
          deviceId: normalizeText(deviceId),
          message: "ABE player went offline.",
        });
      });
      for (const eventName of ["initialization_error", "authentication_error", "account_error", "playback_error"]) {
        player.addListener(eventName, ({ message } = {}) => {
          const normalizedMessage = normalizeText(message) || "Spotify player error.";
          emitEvent("error", {
            errorType: eventName,
            message: normalizedMessage,
          });
          if (eventName !== "playback_error") {
            finish({
              ok: false,
              message: normalizedMessage,
            });
          }
        });
      }
      player.addListener("autoplay_failed", () => {
        emitEvent("autoplay_failed", {
          message: "Spotify autoplay was blocked. Press Play again.",
        });
      });
      player.addListener("player_state_changed", (playbackState) => {
        emitEvent("state_changed", mapSpotifyWebPlaybackState(playbackState));
      });

      timeoutId = setTimeout(() => {
        finish({
          ok: false,
          message: "Spotify player did not become ready.",
        });
      }, WEB_PLAYBACK_SDK_TIMEOUT_MS);

      Promise.resolve(player.activateElement?.()).catch((error) => {
        logger?.warn?.("Spotify player activation failed", error);
      });
      Promise.resolve(player.connect()).then((connected) => {
        if (!connected) {
          finish({
            ok: false,
            message: "Spotify player could not connect.",
          });
        }
      }).catch((error) => {
        logger?.warn?.("Spotify player connection failed", error);
        finish({
          ok: false,
          message: "Spotify player could not connect.",
        });
      });
    } catch (error) {
      logger?.warn?.("Spotify player initialization failed", error);
      finish({
        ok: false,
        message: "Spotify player could not start.",
      });
    }
  });

  return runtime.readyPromise;
}

function disconnectSpotifyWebPlayback(runtime, { logger } = {}) {
  if (!runtime?.player) {
    return {
      ok: true,
      message: "Spotify player disconnected.",
    };
  }

  try {
    runtime.player.disconnect?.();
  } catch (error) {
    logger?.warn?.("Spotify player disconnect failed", error);
  }

  runtime.deviceId = "";
  runtime.player = null;
  runtime.readyPromise = null;
  runtime.accessToken = "";
  return {
    ok: true,
    message: "Spotify player disconnected.",
  };
}

async function runSpotifyWebPlaybackCommand(runtime, commandName, {
  failureMessage = "Spotify playback command failed.",
  logger,
  successMessage = "Spotify playback command sent.",
} = {}) {
  const player = runtime?.player;
  const command = player?.[commandName];
  if (typeof command !== "function") {
    return {
      ok: false,
      message: "ABE Spotify player is not ready.",
    };
  }

  try {
    await Promise.resolve(command.call(player));
    return {
      ok: true,
      message: successMessage,
    };
  } catch (error) {
    logger?.warn?.(failureMessage, error);
    return {
      ok: false,
      message: failureMessage,
    };
  }
}

async function seekSpotifyWebPlayback({
  positionMs = 0,
} = {}, {
  logger,
  runtime,
} = {}) {
  const player = runtime?.player;
  if (!player || typeof player.seek !== "function") {
    return {
      ok: false,
      message: "ABE Spotify player is not ready.",
    };
  }

  const normalizedPositionMs = Math.max(0, Math.round(Number(positionMs) || 0));
  try {
    await Promise.resolve(player.seek(normalizedPositionMs));
    return {
      ok: true,
      message: "Spotify playback position updated.",
      positionMs: normalizedPositionMs,
    };
  } catch (error) {
    logger?.warn?.("Spotify seek command failed", error);
    return {
      ok: false,
      message: "Spotify seek command failed.",
    };
  }
}

async function loadSpotifyWebPlaybackSdk({
  documentRef,
  logger,
  runtime,
  windowRef,
} = {}) {
  if (windowRef?.Spotify?.Player) {
    return {
      ok: true,
      message: "Spotify Web Playback SDK loaded.",
    };
  }

  if (runtime.sdkPromise) {
    return runtime.sdkPromise;
  }

  if (!windowRef || !documentRef?.createElement) {
    return {
      ok: false,
      message: "Spotify Web Playback SDK is unavailable in this browser.",
    };
  }

  runtime.sdkPromise = new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (!result.ok) {
        runtime.sdkPromise = null;
      }
      resolve(result);
    };
    const previousReadyHandler = windowRef.onSpotifyWebPlaybackSDKReady;
    windowRef.onSpotifyWebPlaybackSDKReady = () => {
      if (typeof previousReadyHandler === "function") {
        previousReadyHandler();
      }
      finish({
        ok: true,
        message: "Spotify Web Playback SDK loaded.",
      });
    };

    try {
      const existingScript = typeof documentRef.querySelector === "function"
        ? documentRef.querySelector(`script[src="${SPOTIFY_WEB_PLAYBACK_SDK_URL}"]`)
        : null;
      if (!existingScript) {
        const script = documentRef.createElement("script");
        script.async = true;
        script.src = SPOTIFY_WEB_PLAYBACK_SDK_URL;
        script.onerror = () => {
          finish({
            ok: false,
            message: "Spotify Web Playback SDK failed to load.",
          });
        };
        (documentRef.head || documentRef.body || documentRef.documentElement)?.appendChild(script);
      }
      timeoutId = setTimeout(() => {
        finish({
          ok: false,
          message: "Spotify Web Playback SDK did not load.",
        });
      }, WEB_PLAYBACK_SDK_TIMEOUT_MS);
    } catch (error) {
      logger?.warn?.("Spotify Web Playback SDK load failed", error);
      finish({
        ok: false,
        message: "Spotify Web Playback SDK failed to load.",
      });
    }
  });

  return runtime.sdkPromise;
}

function mapSpotifyWebPlaybackState(playbackState) {
  if (!playbackState || typeof playbackState !== "object") {
    return {
      currentTrack: null,
      paused: true,
    };
  }

  const currentTrack = playbackState.track_window?.current_track
    ? mapSpotifyApiTrack(playbackState.track_window.current_track)
    : null;
  return {
    contextUri: normalizeText(playbackState.context?.uri),
    currentTrack,
    paused: playbackState.paused === true,
    positionMs: Math.max(0, Math.round(Number(playbackState.position) || 0)),
    durationMs: Math.max(0, Math.round(Number(playbackState.duration) || 0)),
  };
}

function renderSpotifyAccountMenuHTML(state = {}, {
  connected = false,
  canConnect = false,
} = {}) {
  const open = state.accountMenuOpen === true;
  const accountLabel = state.currentUserDisplayName
    || state.currentUserId
    || (connected ? "Spotify account" : "Spotify sign in");
  return `
    <div class="spotify-account-menu ${open ? "is-open" : ""}">
      <button
        class="spotify-account-menu__button"
        type="button"
        data-action="spotify-toggle-account-menu"
        aria-expanded="${open ? "true" : "false"}"
        aria-haspopup="menu"
        aria-label="${escapeHtml(accountLabel)}"
        title="${escapeHtml(accountLabel)}"
      >
        ${renderSpotifyAvatarHTML(state, {
          className: "spotify-account-menu__avatar",
          connected,
        })}
      </button>
      ${open ? `
        <div class="spotify-account-menu__panel" role="menu" aria-label="Spotify account options">
          <span class="spotify-account-menu__name">${escapeHtml(accountLabel)}</span>
          <button
            class="tag-button panel-action-button ${connected ? "" : "is-primary"}"
            type="button"
            data-action="spotify-connect"
            ${canConnect ? "" : "disabled"}
          >${connected ? "Reconnect Spotify" : "Sign in with Spotify"}</button>
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="spotify-disconnect"
            ${connected ? "" : "disabled"}
          >Disconnect</button>
        </div>
      ` : ""}
    </div>
  `;
}

function createSpotifyPlaybackPresentation(state = {}, {
  connected = false,
  hasClientId = false,
  playbackAuthorized = false,
  playbackReady = false,
} = {}) {
  const currentTrack = normalizeSpotifyTrack(state.playbackCurrentTrack);
  const currentPlaylist = normalizeSpotifyPlaylist(state.playbackCurrentPlaylist);
  const hasTrack = Boolean(currentTrack.uri);
  const hasPlaylist = Boolean(currentPlaylist.uri);
  const artworkUrl = currentTrack.imageUrl || currentPlaylist.imageUrl;
  const nowTitle = currentTrack.title || currentPlaylist.title || (connected ? "Writing soundtrack" : "Spotify");
  const nowDetail = hasTrack
    ? currentTrack.artistNames.length ? currentTrack.artistNames.join(", ") : currentTrack.albumName || "Spotify track"
    : hasPlaylist
      ? currentPlaylist.ownerName || "Spotify playlist"
      : playbackReady
        ? "Choose a track or playlist"
        : connected
          ? playbackAuthorized ? "Start ABE player" : "Reconnect for playback"
          : hasClientId ? "Sign in with Spotify" : "App setup needed";
  const durationMs = Math.max(0, Number(state.playbackDurationMs) || currentTrack.durationMs || 0);
  const positionMs = Math.min(Math.max(0, Number(state.playbackPositionMs) || 0), Math.max(durationMs, 0));
  const canControlPlayback = connected && playbackAuthorized && playbackReady && !state.playbackControlBusy;
  const canSeek = canControlPlayback && durationMs > 0;
  const playPauseLabel = state.playbackPaused === true ? "Play" : "Pause";
  const statusLabel = connected ? "Signed in" : hasClientId ? "Sign in" : "Setup";
  return {
    artworkUrl,
    canControlPlayback,
    canSeek,
    durationMs,
    nowDetail,
    nowTitle,
    playPauseLabel,
    positionMs,
    statusLabel,
  };
}

function renderSpotifyPlaybackCardHTML(state = {}, {
  canStartPlayer = false,
  connected = false,
  playbackAuthorized = false,
  playbackReady = false,
  playbackStatus = "",
} = {}) {
  const view = createSpotifyPlaybackPresentation(state, {
    connected,
    hasClientId: Boolean(state.clientId || state.clientIdDraft),
    playbackAuthorized,
    playbackReady,
  });
  const statusLabel = playbackReady ? "Ready" : state.playbackConnecting ? "Starting" : "Idle";
  return `
    <section class="spotify-music-panel__section spotify-music-panel__playback">
      <div class="spotify-player-card">
        <div class="spotify-player-card__now">
          ${view.artworkUrl ? `
            <img
              class="spotify-player-card__art"
              src="${escapeHtml(view.artworkUrl)}"
              alt=""
              aria-hidden="true"
              draggable="false"
            />
          ` : `<span class="spotify-player-card__art is-placeholder" aria-hidden="true"></span>`}
          <strong title="${escapeHtml(view.nowTitle)}">${escapeHtml(view.nowTitle)}</strong>
          <span title="${escapeHtml(view.nowDetail)}">${escapeHtml(view.nowDetail)}</span>
        </div>
        <div class="spotify-player-card__deck">
          <div class="spotify-music-panel__playback-row">
            <span class="spotify-music-panel__label">In-app player</span>
            <span class="spotify-music-panel__status ${playbackReady ? "is-connected" : "is-disconnected"}">
              ${escapeHtml(statusLabel)}
            </span>
          </div>
          <p class="spotify-music-panel__requirement">${escapeHtml(playbackStatus)}</p>
          <div class="spotify-player-card__controls" role="group" aria-label="Spotify playback controls">
            <button
              class="spotify-player-card__control"
              type="button"
              data-action="spotify-previous-track"
              aria-label="Previous track"
              title="Previous track"
              ${view.canControlPlayback ? "" : "disabled"}
            ><span class="spotify-player-icon spotify-player-icon--previous" aria-hidden="true"></span></button>
            <button
              class="spotify-player-card__control spotify-player-card__control--primary"
              type="button"
              data-action="spotify-toggle-playback"
              aria-label="${escapeHtml(view.playPauseLabel)}"
              title="${escapeHtml(view.playPauseLabel)}"
              ${view.canControlPlayback ? "" : "disabled"}
            ><span class="spotify-player-icon spotify-player-icon--${state.playbackPaused === true ? "play" : "pause"}" aria-hidden="true"></span></button>
            <button
              class="spotify-player-card__control"
              type="button"
              data-action="spotify-next-track"
              aria-label="Next track"
              title="Next track"
              ${view.canControlPlayback ? "" : "disabled"}
            ><span class="spotify-player-icon spotify-player-icon--next" aria-hidden="true"></span></button>
          </div>
          <label class="spotify-player-card__progress">
            <span data-spotify-playback-position-label>${escapeHtml(formatSpotifyPlaybackTimeLabel(view.positionMs))}</span>
            <input
              type="range"
              min="0"
              max="${Math.max(view.durationMs, 1)}"
              step="1000"
              value="${view.positionMs}"
              data-spotify-playback-seek
              aria-label="Spotify playback position"
              ${view.canSeek ? "" : "disabled"}
            />
            <strong data-spotify-playback-duration-label>${escapeHtml(formatSpotifyPlaybackTimeLabel(view.durationMs))}</strong>
          </label>
          ${playbackReady ? "" : `
            <button
              class="tag-button panel-action-button spotify-player-card__start"
              type="button"
              data-action="spotify-start-player"
              ${canStartPlayer ? "" : "disabled"}
            >${state.playbackConnecting ? "Starting player..." : "Start ABE player"}</button>
          `}
        </div>
      </div>
    </section>
  `;
}

function renderSpotifyAvatarHTML(state = {}, {
  className = "spotify-avatar",
  connected = false,
} = {}) {
  const imageUrl = connected ? normalizeText(state.currentUserImageUrl) : "";
  const fallbackLabel = createSpotifyAvatarFallbackLabel(state, { connected });
  if (imageUrl) {
    return `
      <span class="${escapeHtml(className)} spotify-avatar has-image" aria-hidden="true">
        <img src="${escapeHtml(imageUrl)}" alt="" draggable="false" />
      </span>
    `;
  }

  return `
    <span class="${escapeHtml(className)} spotify-avatar" aria-hidden="true">
      ${escapeHtml(fallbackLabel)}
    </span>
  `;
}

function createSpotifyAvatarFallbackLabel(state = {}, {
  connected = false,
} = {}) {
  const name = normalizeText(state.currentUserDisplayName || state.currentUserId);
  if (connected && name) {
    const initials = name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("");
    return initials.toUpperCase() || "S";
  }
  return "S";
}

function renderSpotifySearchControlsHTML(state = {}, {
  canSearch = false,
  connected = false,
} = {}) {
  return `
    <div class="spotify-music-panel__search-row">
      <input
        type="search"
        value="${escapeHtml(state.query)}"
        data-spotify-search-query
        aria-label="Search Spotify tracks"
        placeholder="Track, artist, playlist mood"
        ${connected ? "" : "disabled"}
      />
      <button
        class="tag-button panel-action-button"
        type="button"
        data-action="spotify-search"
        ${canSearch ? "" : "disabled"}
      >${state.searchBusy ? "Searching..." : "Search"}</button>
    </div>
    <p class="spotify-music-panel__requirement">Premium playback is required for Play and queue commands.</p>
  `;
}

function renderSpotifyPlaylistBrowserHTML(state = {}, {
  connected = false,
  playlistAuthorized = false,
} = {}) {
  const playlists = normalizeSpotifyPlaylists(state.playlistResults);
  const canLoadPlaylists = connected && playlistAuthorized && !state.playlistBusy;
  const playlistStatus = connected && !playlistAuthorized
    ? "Reconnect Spotify to grant playlist browsing."
    : state.playlistStatus;
  return `
    <div class="spotify-music-panel__playlist-toolbar">
      <span class="spotify-music-panel__label">Playlists</span>
      <button
        class="tag-button panel-action-button"
        type="button"
        data-action="spotify-load-playlists"
        ${canLoadPlaylists ? "" : "disabled"}
      >${state.playlistBusy ? "Loading..." : playlists.length ? "Refresh" : "Load playlists"}</button>
    </div>
    ${playlistStatus ? `<p class="spotify-music-panel__requirement">${escapeHtml(playlistStatus)}</p>` : ""}
    ${playlists.length ? `
      <div class="spotify-playlist-list">
        ${playlists.map((playlist) => renderSpotifyPlaylistCardHTML(playlist, {
          playbackBusyPlaylistUri: state.playbackBusyPlaylistUri,
          selectedPlaylistId: state.selectedPlaylistId,
          tracksBusy: state.playlistTracksBusy,
        })).join("")}
      </div>
    ` : `
      <div class="spotify-music-panel__empty">
        <strong>No playlists loaded.</strong>
      </div>
    `}
  `;
}

function renderSpotifyPlaylistCardHTML(playlist = {}, {
  playbackBusyPlaylistUri = "",
  selectedPlaylistId = "",
  tracksBusy = false,
} = {}) {
  const selected = playlist.id && playlist.id === selectedPlaylistId;
  const trackLabel = playlist.canReadTracks === false ? "Tracks hidden" : `${playlist.trackTotal || 0} tracks`;
  const accessTitle = playlist.canReadTracks === false
    ? "Play this playlist in ABE. Spotify hides the track list for playlists you do not own or collaborate on."
    : `Play ${playlist.title || "playlist"} in ABE`;
  const playlistUri = normalizeText(playlist.uri);
  const playbackBusy = Boolean(playlistUri && playlistUri === playbackBusyPlaylistUri);
  return `
    <article
      class="spotify-playlist-card ${selected ? "is-selected" : ""}"
      title="${escapeHtml(accessTitle)}"
    >
      <button
        class="spotify-playlist-card__inspect"
        type="button"
        data-action="spotify-play-playlist"
        data-spotify-playlist-id="${escapeHtml(playlist.id)}"
        data-spotify-playlist-uri="${escapeHtml(playlistUri)}"
        aria-label="${escapeHtml(`Play ${playlist.title || "playlist"} in ABE`)}"
        aria-pressed="${selected ? "true" : "false"}"
        ${playlistUri ? "" : "disabled"}
      >
        ${playlist.imageUrl ? `
          <img
            class="spotify-playlist-card__art"
            src="${escapeHtml(playlist.imageUrl)}"
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        ` : `<span class="spotify-playlist-card__art is-placeholder" aria-hidden="true"></span>`}
        <span class="spotify-playlist-card__body">
          <strong>${escapeHtml(playlist.title || "Untitled playlist")}</strong>
          <span>${escapeHtml(playlist.ownerName || "Spotify playlist")}</span>
        </span>
        <span class="spotify-playlist-card__count">
          ${playbackBusy ? "Playing" : selected && tracksBusy ? "Loading" : escapeHtml(trackLabel)}
        </span>
      </button>
    </article>
  `;
}

function renderSpotifyTempoReferenceHTML(tracks = [], {
  connected = false,
  tempoBusy = false,
  tempoStatus = "",
} = {}) {
  const normalizedTracks = normalizeSpotifyTracks(tracks);
  if (!normalizedTracks.length) {
    return "";
  }

  const tempoReference = createSpotifyTempoReference(normalizedTracks);
  const canAnalyzeTempo = connected && !tempoBusy && normalizedTracks.some((track) => track.id);
  const tempoHeadline = tempoReference.count
    ? `${formatTempoLabel(tempoReference.averageBpm)} average`
    : "Tempo unavailable";
  const tempoDetail = tempoReference.count
    ? `${tempoReference.bucket} · median ${formatTempoLabel(tempoReference.medianBpm)} · spread ${formatTempoLabel(tempoReference.spreadBpm)} · ${tempoReference.stability}`
    : tempoStatus || "Spotify did not provide tempo data for these tracks.";
  return `
    <section class="spotify-tempo-reference" aria-label="Tempo reference">
      <div class="spotify-tempo-reference__summary">
        <span class="spotify-music-panel__label">Tempo reference</span>
        <strong>${escapeHtml(tempoHeadline)}</strong>
        <small>${escapeHtml(tempoDetail)}</small>
      </div>
      <button
        class="tag-button panel-action-button spotify-tempo-reference__refresh"
        type="button"
        data-action="spotify-analyze-tempo"
        ${canAnalyzeTempo ? "" : "disabled"}
      >${tempoBusy ? "Analyzing..." : tempoReference.count ? "Refresh tempo" : "Analyze tempo"}</button>
    </section>
  `;
}

function renderSpotifyTrackResultsHTML(state = {}, tracksCandidate = null, {
  emptyLabel = "No tracks loaded.",
  heading = "Tracks",
} = {}) {
  const tracks = normalizeSpotifyTracks(tracksCandidate ?? state.searchResults);
  if (!tracks.length) {
    return `
      <div class="spotify-music-panel__empty">
        <strong>${escapeHtml(emptyLabel)}</strong>
      </div>
    `;
  }

  const canPlay = isSpotifyMusicConnected(state) && isSpotifyTokenAuthorizedForPlayback(state.token);
  return `
    <div class="spotify-track-list-heading">
      <span class="spotify-music-panel__label">${escapeHtml(heading)}</span>
      <small>${tracks.length} visible</small>
    </div>
    <div class="spotify-track-list">
      ${tracks.map((track) => renderSpotifyTrackHTML(track, {
        playbackBusyTrackUri: state.playbackBusyTrackUri,
        busyTrackUri: state.queueBusyTrackUri,
        canPlay,
      })).join("")}
    </div>
  `;
}

function renderSpotifyTrackHTML(track = {}, {
  busyTrackUri = "",
  canPlay = false,
  playbackBusyTrackUri = "",
} = {}) {
  const artistLabel = track.artistNames.length ? track.artistNames.join(", ") : "Unknown artist";
  const detailLabel = [
    track.albumName,
    formatDurationLabel(track.durationMs),
  ].filter(Boolean).join(" · ");
  const tempoLabel = formatSpotifyTrackTempoLabel(track);
  const isBusy = busyTrackUri && busyTrackUri === track.uri;
  const isPlaybackBusy = playbackBusyTrackUri && playbackBusyTrackUri === track.uri;
  return `
    <article class="spotify-track-card">
      ${track.imageUrl ? `
        <img
          class="spotify-track-card__art"
          src="${escapeHtml(track.imageUrl)}"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      ` : `<span class="spotify-track-card__art is-placeholder" aria-hidden="true"></span>`}
      <div class="spotify-track-card__body">
        <strong>${escapeHtml(track.title || "Untitled track")}</strong>
        <span>${escapeHtml(artistLabel)}</span>
        ${detailLabel ? `<small>${escapeHtml(detailLabel)}</small>` : ""}
        ${tempoLabel ? `<small class="spotify-track-card__tempo">${escapeHtml(tempoLabel)}</small>` : ""}
      </div>
      <div class="spotify-track-card__actions">
        <button
          class="tag-button spotify-track-card__play"
          type="button"
          data-action="spotify-play-track"
          data-spotify-track-uri="${escapeHtml(track.uri)}"
          aria-label="Play ${escapeHtml(track.title || "track")} in ABE"
          title="Play in ABE"
          ${canPlay && !isPlaybackBusy ? "" : "disabled"}
        >${isPlaybackBusy ? "..." : "Play"}</button>
        <button
          class="tag-button spotify-track-card__queue"
          type="button"
          data-action="spotify-queue-track"
          data-spotify-track-uri="${escapeHtml(track.uri)}"
          aria-label="Queue ${escapeHtml(track.title || "track")} in Spotify"
          title="Queue track"
          ${isBusy ? "disabled" : ""}
        >${isBusy ? "..." : "+"}</button>
      </div>
    </article>
  `;
}

function renderSpotifyQueueHistoryHTML(queueHistory = []) {
  const tracks = normalizeSpotifyTracks(queueHistory);
  if (!tracks.length) {
    return "";
  }

  return `
    <section class="spotify-music-panel__section spotify-music-panel__history">
      <span class="spotify-music-panel__label">Queued this session</span>
      <div class="spotify-music-panel__history-list">
        ${tracks.map((track) => `
          <span class="spotify-music-panel__history-item">
            ${escapeHtml(track.title || "Track")}
          </span>
        `).join("")}
      </div>
    </section>
  `;
}

function normalizeSpotifyToken(candidate = null) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const accessToken = normalizeText(candidate.accessToken ?? candidate.access_token);
  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken: normalizeText(candidate.refreshToken ?? candidate.refresh_token),
    tokenType: normalizeText(candidate.tokenType ?? candidate.token_type) || "Bearer",
    scope: normalizeText(candidate.scope),
    expiresAt: Number.isFinite(Number(candidate.expiresAt))
      ? Number(candidate.expiresAt)
      : null,
  };
}

function normalizeSpotifyClientIdSource(value) {
  return value === "desktop" || value === "manual" ? value : "";
}

function normalizeSpotifyMusicSourceMode(value) {
  return value === "playlists" ? "playlists" : "search";
}

function normalizeSpotifyTrackTempo(candidate = {}) {
  const rawTempo = firstFiniteNumber(
    candidate?.rawTempoBpm,
    candidate?.tempo,
    candidate?.audioFeatures?.tempo,
    candidate?.audio_features?.tempo
  );
  const tempoBpm = firstFiniteNumber(candidate?.tempoBpm);
  const normalizedTempo = tempoBpm > 0
    ? roundTempo(tempoBpm)
    : rawTempo > 0
      ? normalizeTempoForWritingReference(rawTempo)
      : 0;
  const normalizedRawTempo = rawTempo > 0 ? roundTempo(rawTempo) : normalizedTempo;
  return {
    rawTempoBpm: normalizedRawTempo > 0 ? normalizedRawTempo : 0,
    tempoBpm: normalizedTempo > 0 ? normalizedTempo : 0,
    tempoBucket: normalizedTempo > 0
      ? normalizeText(candidate?.tempoBucket) || describeTempoBucket(normalizedTempo)
      : "",
    tempoSource: normalizeText(candidate?.tempoSource),
    tempoConfidence: nullableFiniteNumber(candidate?.tempoConfidence ?? candidate?.tempo_confidence),
    timeSignature: nullableFiniteNumber(candidate?.timeSignature ?? candidate?.time_signature),
    energy: nullableFiniteNumber(candidate?.energy),
    danceability: nullableFiniteNumber(candidate?.danceability),
  };
}

function readStoredSpotifyToken(storage) {
  try {
    return normalizeSpotifyToken(JSON.parse(readStorageValue(storage, SPOTIFY_MUSIC_TOKEN_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function writeStoredSpotifyToken(storage, token) {
  const normalizedToken = normalizeSpotifyToken(token);
  if (!normalizedToken) {
    removeStorageValue(storage, SPOTIFY_MUSIC_TOKEN_STORAGE_KEY);
    return null;
  }

  writeStorageValue(storage, SPOTIFY_MUSIC_TOKEN_STORAGE_KEY, JSON.stringify(normalizedToken));
  return normalizedToken;
}

function readStoredSpotifyPlaybackState(storage) {
  try {
    return createSpotifyPlaybackResumeState(
      JSON.parse(readStorageValue(storage, SPOTIFY_MUSIC_PLAYBACK_STATE_STORAGE_KEY) || "null")
    );
  } catch {
    return null;
  }
}

function writeStoredSpotifyPlaybackState(storage, playbackState, {
  now = () => Date.now(),
} = {}) {
  const normalizedPlaybackState = createSpotifyPlaybackResumeState(playbackState, { now });
  if (!normalizedPlaybackState) {
    removeStorageValue(storage, SPOTIFY_MUSIC_PLAYBACK_STATE_STORAGE_KEY);
    return null;
  }

  writeStorageValue(storage, SPOTIFY_MUSIC_PLAYBACK_STATE_STORAGE_KEY, JSON.stringify(normalizedPlaybackState));
  return normalizedPlaybackState;
}

function clearSpotifyPkceStorage(storage) {
  removeStorageValue(storage, SPOTIFY_PKCE_VERIFIER_STORAGE_KEY);
  removeStorageValue(storage, SPOTIFY_PKCE_STATE_STORAGE_KEY);
}

function readStorageValue(storage, key) {
  if (!storage || typeof storage.getItem !== "function") {
    return "";
  }

  try {
    return normalizeText(storage.getItem(key));
  } catch {
    return "";
  }
}

function writeStorageValue(storage, key, value) {
  if (!storage || typeof storage.setItem !== "function") {
    return false;
  }

  try {
    storage.setItem(key, String(value ?? ""));
    return true;
  } catch {
    return false;
  }
}

function removeStorageValue(storage, key) {
  if (!storage || typeof storage.removeItem !== "function") {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function selectSpotifyImage(images = []) {
  const candidates = Array.isArray(images) ? images : [];
  return candidates.find((image) => Number(image?.width) >= 64 && Number(image?.width) <= 300)
    ?? candidates[0]
    ?? null;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function clampTrackLimit(limit) {
  const numericLimit = Math.round(Number(limit) || DEFAULT_TRACK_LIMIT);
  return Math.min(Math.max(numericLimit, 1), 20);
}

function clampSpotifyPageLimit(limit, max, fallback) {
  const numericLimit = Math.round(Number(limit) || fallback);
  return Math.min(Math.max(numericLimit, 1), Math.max(1, Number(max) || 50));
}

function clampSpotifyVolume(volume) {
  const numericVolume = Number(volume);
  if (!Number.isFinite(numericVolume)) {
    return 0.5;
  }
  return Math.min(Math.max(numericVolume, 0), 1);
}

function formatDurationLabel(durationMs = 0) {
  const totalSeconds = Math.floor(Math.max(0, Number(durationMs) || 0) / 1000);
  if (totalSeconds <= 0) {
    return "";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatSpotifyPlaybackTimeLabel(durationMs = 0) {
  const label = formatDurationLabel(durationMs);
  return label || "0:00";
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return 0;
}

function nullableFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function roundTempo(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }
  return Math.round(numericValue * 10) / 10;
}

function normalizeTempoForWritingReference(value) {
  let tempo = Number(value);
  if (!Number.isFinite(tempo) || tempo <= 0) {
    return 0;
  }

  // Intent: normalize Spotify's beat estimate into the tempo band an author can actually use as a pacing reference.
  while (tempo < 60) {
    tempo *= 2;
  }
  while (tempo > 180) {
    tempo /= 2;
  }
  return roundTempo(tempo);
}

function describeTempoBucket(tempoBpm = 0) {
  const tempo = Number(tempoBpm);
  if (!Number.isFinite(tempo) || tempo <= 0) {
    return "";
  }
  if (tempo < 84) {
    return "slow";
  }
  if (tempo < 104) {
    return "steady";
  }
  if (tempo < 128) {
    return "medium";
  }
  if (tempo < 150) {
    return "driving";
  }
  return "fast";
}

function describeTempoStability(count = 0, spreadBpm = 0) {
  if (count < 3) {
    return "thin sample";
  }
  if (spreadBpm <= 8) {
    return "tight reference";
  }
  if (spreadBpm <= 18) {
    return "mixed reference";
  }
  return "wide tempo range";
}

function formatTempoLabel(tempoBpm = 0) {
  const tempo = roundTempo(tempoBpm);
  return tempo > 0 ? `${tempo} BPM` : "";
}

function formatSpotifyTrackTempoLabel(track = {}) {
  const tempo = roundTempo(track.tempoBpm);
  if (tempo <= 0) {
    return "";
  }
  const rawTempo = roundTempo(track.rawTempoBpm);
  const rawSuffix = rawTempo > 0 && Math.abs(rawTempo - tempo) >= 1
    ? ` · raw ${formatTempoLabel(rawTempo)}`
    : "";
  return `${formatTempoLabel(tempo)} · ${track.tempoBucket || describeTempoBucket(tempo)}${rawSuffix}`;
}

async function readResponseJson(response) {
  if (!response || typeof response.json !== "function") {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function mapSpotifyTempoErrorMessage(status, body) {
  const message = normalizeText(body?.error?.message || body?.error_description || body?.message);
  if (message) {
    return message;
  }
  if (status === 403) {
    return "Spotify tempo data is unavailable for this app.";
  }
  if (status === 401) {
    return "Spotify connection expired before tempo analysis.";
  }
  if (status === 429) {
    return "Spotify tempo rate limit reached.";
  }
  return "Spotify tempo data unavailable.";
}

function mapSpotifyPlaylistErrorMessage(status, body) {
  const message = normalizeText(body?.error?.message || body?.error_description || body?.message);
  if (status === 403 || /^forbidden$/i.test(message)) {
    if (/scope|permission/i.test(message)) {
      return "Reconnect Spotify to grant playlist browsing.";
    }
    return "Spotify hides track lists for playlists you do not own or collaborate on. Use Play to start the playlist.";
  }
  if (message) {
    return message;
  }
  if (status === 401) {
    return "Spotify connection expired before playlist loading.";
  }
  if (status === 429) {
    return "Spotify playlist rate limit reached.";
  }
  return "Spotify playlist tracks unavailable.";
}

function mapSpotifyErrorMessage(status, body, fallback) {
  const message = normalizeText(body?.error?.message || body?.error_description || body?.message);
  if (isSpotifyNoActiveDeviceError(status, message)) {
    return "No active Spotify playback device found. Open Spotify, start playback on this account, then queue the track again.";
  }
  if (message) {
    return message;
  }
  if (status === 401) {
    return "Spotify connection expired.";
  }
  if (status === 403) {
    return /queue|playback|player/i.test(normalizeText(fallback))
      ? "Spotify refused the playback command. Premium playback may be required."
      : fallback;
  }
  if (status === 429) {
    return "Spotify rate limit reached.";
  }
  return fallback;
}

function isSpotifyNoActiveDeviceError(status, message) {
  return Number(status) === 404 && /no active device/i.test(normalizeText(message));
}

function spotifyTokenHasScopes(token = null, requiredScopes = []) {
  const normalizedToken = normalizeSpotifyToken(token);
  if (!normalizedToken?.accessToken) {
    return false;
  }

  const grantedScopes = new Set(
    normalizeText(normalizedToken.scope)
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
  );
  return requiredScopes.every((scope) => grantedScopes.has(scope));
}

function createPkceRandomString(length, cryptoRef) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const size = Math.max(32, Math.round(Number(length) || 64));
  const bytes = new Uint8Array(size);
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== "function") {
    throw new Error("Secure browser crypto is required for Spotify PKCE.");
  }
  cryptoRef.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

async function createPkceChallenge(verifier, cryptoRef) {
  if (!cryptoRef?.subtle || typeof cryptoRef.subtle.digest !== "function") {
    throw new Error("Browser crypto digest is required for Spotify PKCE.");
  }

  const data = new TextEncoder().encode(verifier);
  const digest = await cryptoRef.subtle.digest("SHA-256", data);
  return encodeBase64Url(new Uint8Array(digest));
}

function encodeBase64Url(bytes) {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const bufferCtor = globalThis.Buffer;
  const base64 = bufferCtor && typeof bufferCtor.from === "function"
    ? bufferCtor.from(byteArray).toString("base64")
    : browserBase64Encode(byteArray);
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function browserBase64Encode(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}
