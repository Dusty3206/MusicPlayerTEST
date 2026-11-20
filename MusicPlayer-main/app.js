const CONFIG = {
  musicManifestUrl: './Music/music.json',
  playlistFileUrl: './playlist.json'
};

const STORAGE = {
  playlists: 'sp_user_playlists_v1',
  liked: 'sp_liked_tracks_v1',
  volume: 'sp_volume_v1'
};

const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  heartFilled: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
  note: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  user: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>',
  disc: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
};

const state = {
  tracks: [],
  artists: new Map(),
  albums: new Map(),
  sharedPlaylists: [],
  userPlaylists: [],
  likedFiles: new Set(),

  libFilter: 'playlists',
  navHistory: [{ view: 'home', param: null }],
  navIndex: 0,
  searchQuery: '',

  currentTrackId: null,
  queue: [],
  originalQueue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  videoMode: false,
  muted: false,
  lastVolume: 0.8
};

const audio = document.getElementById('audio');
const video = document.getElementById('video');
const $ = (sel) => document.querySelector(sel);

let toastTimer = null;
let activePopover = null;

/* ---------- Utilities ---------- */

function escapeHTML(str = '') {
  return String(str).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[c]);
}

function safeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^(https?:\/\/|\.\/|\.\.\/|\/|data:image\/|blob:)/i.test(s)) return s;
  return '';
}

function encodeFilePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}

function mediaKey(file) {
  return String(file || '').split('/').pop().replace(/\.(mp3|mp4|m4v|webm|jpg|jpeg|png|webp)$/i, '').toLowerCase();
}

function slugify(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function notify(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

function sampleImageColor(src, fallback = '#2c2c2c') {
  return new Promise((resolve) => {
    if (!src) return resolve(fallback);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (!n) return resolve(fallback);
        r = Math.round((r / n) * 0.65);
        g = Math.round((g / n) * 0.65);
        b = Math.round((b / n) * 0.65);
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = src;
  });
}

/* ---------- Storage ---------- */

function loadLocalData() {
  try {
    const savedPlaylists = JSON.parse(localStorage.getItem(STORAGE.playlists) || '[]');
    if (Array.isArray(savedPlaylists)) {
      state.userPlaylists = savedPlaylists.map((p) => normalizePlaylist(p, true));
    }
  } catch {}

  try {
    const savedLiked = JSON.parse(localStorage.getItem(STORAGE.liked) || '[]');
    if (Array.isArray(savedLiked)) {
      state.likedFiles = new Set(savedLiked);
    }
  } catch {}

  try {
    const vol = parseFloat(localStorage.getItem(STORAGE.volume));
    if (Number.isFinite(vol) && vol >= 0 && vol <= 1) {
      state.lastVolume = vol;
      audio.volume = vol;
      video.volume = vol;
      $('#volumeBar').value = Math.round(vol * 100);
    }
  } catch {}
}

function saveUserPlaylists() {
  localStorage.setItem(STORAGE.playlists, JSON.stringify(state.userPlaylists));
}

function saveLiked() {
  localStorage.setItem(STORAGE.liked, JSON.stringify([...state.likedFiles]));
}

/* ---------- Data Loading ---------- */

function parseFilename(file, suppliedTitle, suppliedArtist, suppliedAlbum) {
  const partsPath = String(file || '').split('/').filter(Boolean);
  const filename = partsPath[partsPath.length - 1] || '';
  const clean = filename.replace(/\.(mp3|mp4|m4v|webm)$/i, '');
  const dashParts = clean.split(/\s+-\s+/);

  let folderArtist = '';
  let folderAlbum = '';
  if (partsPath.length >= 3 && !/^(mp3|mp4)$/i.test(partsPath[0])) {
    folderArtist = partsPath[0];
    folderAlbum = partsPath[1];
  } else if (partsPath.length === 2 && !/^(mp3|mp4)$/i.test(partsPath[0])) {
    folderAlbum = partsPath[0];
  }

  const title = suppliedTitle || dashParts[0] || 'Untitled';
  const artist = suppliedArtist || (dashParts.length > 1 ? dashParts.slice(1).join(' - ') : folderArtist) || 'Unknown Artist';
  const album = suppliedAlbum || folderAlbum || '';

  return { title, artist, album };
}

function githubRepoInfo() {
  const host = location.hostname.toLowerCase().split('.');
  if (host.length !== 3 || host[1] !== 'github' || host[2] !== 'io') return null;
  const owner = host[0];
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return { owner, repo: seg || `${owner}.github.io` };
}

async function fetchGitHubMusicTree() {
  const info = githubRepoInfo();
  if (!info) throw new Error('Not github.io');

  const cacheKey = `gh_tree_${info.owner}/${info.repo}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (cached && Date.now() - cached.ts < 15 * 60 * 1000) {
      return cached.tree;
    }
  } catch {}

  const url = `https://api.github.com/repos/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.repo)}/git/trees/HEAD?recursive=1`;
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('GitHub API limit or unreachable');
  const data = await res.json();
  const tree = Array.isArray(data.tree) ? data.tree : [];

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), tree }));
  } catch {}

  return tree;
}

async function loadFolderListing(folder) {
  const folderUrl = new URL(`${folder ? `Music/${folder}` : 'Music'}/`, document.baseURI);
  const res = await fetch(folderUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('No listing');
  const html = await res.text();
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((m) => decodeURIComponent(m[1]))
    .filter((href) => !href.startsWith('?') && !href.startsWith('..'));
}

async function loadMusicLibrary() {
  let manifest = null;

  try {
    const res = await fetch(CONFIG.musicManifestUrl, { cache: 'no-store' });
    if (res.ok) manifest = await res.json();
  } catch {}

  let rawSongs = [];
  const rawVideos = new Map();
  const rawCovers = new Map();

  if (manifest) {
    rawSongs = Array.isArray(manifest) ? manifest : (manifest.songs || manifest.tracks || []);
  } else {
    try {
      const allLinks = [];
      for (const sub of ['', 'MP3', 'MP4', 'Covers']) {
        try {
          const items = await loadFolderListing(sub);
          items.forEach((f) => allLinks.push(sub ? `${sub}/${f.split('/').pop()}` : f.split('/').pop()));
        } catch {}
      }
      allLinks.forEach((rel) => {
        if (/\.mp3$/i.test(rel)) rawSongs.push({ file: rel });
        else if (/\.(mp4|m4v|webm)$/i.test(rel)) rawVideos.set(mediaKey(rel), `./Music/${encodeFilePath(rel)}`);
        else if (/\.(jpg|jpeg|png|webp)$/i.test(rel)) rawCovers.set(mediaKey(rel), `./Music/${encodeFilePath(rel)}`);
      });
    } catch {}

    if (!rawSongs.length) {
      try {
        const tree = await fetchGitHubMusicTree();
        tree.forEach((node) => {
          if (node.type !== 'blob' || !/^Music\//i.test(node.path)) return;
          const rel = node.path.replace(/^Music\//i, '');
          if (/\.mp3$/i.test(rel)) {
            rawSongs.push({ file: rel });
          } else if (/\.(mp4|m4v|webm)$/i.test(rel)) {
            rawVideos.set(mediaKey(rel), `./${encodeFilePath(node.path)}`);
          } else if (/\.(jpg|jpeg|png|webp)$/i.test(rel)) {
            const url = `./${encodeFilePath(node.path)}`;
            rawCovers.set(mediaKey(rel), url);
            const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
            if (dir && /^(cover|folder|front|artwork)\./i.test(rel.split('/').pop())) {
              rawCovers.set(`dir:${dir.toLowerCase()}`, url);
            }
          }
        });
      } catch {}
    }
  }

  const artistMeta = (manifest && manifest.artists) || {};
  const albumMeta = (manifest && manifest.albums) || {};

  state.tracks = rawSongs
    .map((item, idx) => {
      const src = typeof item === 'string' ? { file: item } : (item || {});
      const file = src.file || src.filename || '';
      if (!file || !/\.mp3$/i.test(file)) return null;

      const parsed = parseFilename(file, src.title, src.artist, src.album);
      const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')).toLowerCase() : '';
      const aMeta = albumMeta[parsed.album] || {};
      const cover = safeUrl(
        src.cover ||
        aMeta.cover ||
        rawCovers.get(mediaKey(file)) ||
        rawCovers.get(mediaKey(parsed.album)) ||
        (dir ? rawCovers.get(`dir:${dir}`) : '') ||
        ''
      );

      return {
        id: `track-${idx}`,
        file,
        title: parsed.title,
        artist: parsed.artist,
        album: parsed.album || 'Singles',
        hasExplicitAlbum: Boolean(parsed.album),
        cover,
        year: src.year || aMeta.year || '',
        duration: Number.isFinite(src.duration) ? src.duration : null,
        url: safeUrl(src.url) || `./Music/${encodeFilePath(file)}`,
        videoUrl: safeUrl(src.videoUrl) || rawVideos.get(mediaKey(file)) || ''
      };
    })
    .filter(Boolean);

  buildIndexes(artistMeta, albumMeta);
}

function buildIndexes(artistMeta = {}, albumMeta = {}) {
  state.artists.clear();
  state.albums.clear();

  Object.entries(artistMeta).forEach(([name, meta]) => {
    state.artists.set(name, {
      name,
      avatar: safeUrl(meta.avatar || ''),
      banner: safeUrl(meta.banner || ''),
      bio: meta.bio || '',
      genre: meta.genre || '',
      tracks: [],
      albumIds: new Set()
    });
  });

  state.tracks.forEach((t) => {
    if (!state.artists.has(t.artist)) {
      const meta = artistMeta[t.artist] || {};
      state.artists.set(t.artist, {
        name: t.artist,
        avatar: safeUrl(meta.avatar || ''),
        banner: safeUrl(meta.banner || ''),
        bio: meta.bio || '',
        genre: meta.genre || '',
        tracks: [],
        albumIds: new Set()
      });
    }
    const artistObj = state.artists.get(t.artist);
    artistObj.tracks.push(t);
    if (!artistObj.avatar && t.cover) artistObj.avatar = t.cover;

    if (t.hasExplicitAlbum || albumMeta[t.album]) {
      const albumKey = `${t.album}::${t.artist}`;
      if (!state.albums.has(albumKey)) {
        const meta = albumMeta[t.album] || {};
        state.albums.set(albumKey, {
          id: `alb-${slugify(t.album)}-${slugify(t.artist)}`,
          title: t.album,
          artist: meta.artist || t.artist,
          cover: safeUrl(meta.cover || t.cover || ''),
          year: meta.year || t.year || '',
          tracks: []
        });
      }
      const alb = state.albums.get(albumKey);
      alb.tracks.push(t);
      if (!alb.cover && t.cover) alb.cover = t.cover;
      artistObj.albumIds.add(alb.id);
    }
  });
}

function normalizePlaylist(item = {}, isUser = false) {
  const songs = Array.isArray(item.songs) ? item.songs : (Array.isArray(item.tracks) ? item.tracks : []);
  return {
    id: String(item.id || `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    name: String(item.name || 'Untitled Playlist'),
    description: String(item.description || ''),
    cover: safeUrl(item.cover || ''),
    pinValue: item.pinValue === '1' ? '1' : 'none',
    songs: songs.map((s) => (typeof s === 'string' ? s : s.file || '')).filter(Boolean),
    isUser
  };
}

async function loadSharedPlaylists() {
  try {
    const res = await fetch(CONFIG.playlistFileUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    const list = Array.isArray(json) ? json : (json.playlists || []);
    state.sharedPlaylists = list.map((p) => normalizePlaylist(p, false));
  } catch {
    state.sharedPlaylists = [];
  }
}

/* ---------- Helpers ---------- */

function getTrack(id) {
  return state.tracks.find((t) => t.id === id) || null;
}

function getAllPlaylists() {
  const liked = {
    id: 'liked-songs',
    name: 'Liked Songs',
    description: 'Tracks you have saved',
    cover: '',
    isLiked: true,
    isUser: false,
    songs: [...state.likedFiles]
  };
  return [liked, ...state.userPlaylists, ...state.sharedPlaylists];
}

function getPlaylist(id) {
  return getAllPlaylists().find((p) => p.id === id) || null;
}

function getPlaylistTracks(playlist) {
  if (!playlist) return [];
  if (playlist.pinValue === '1') return [...state.tracks];
  const byFile = new Map(state.tracks.map((t) => [t.file, t]));
  return playlist.songs.map((f) => byFile.get(f)).filter(Boolean);
}

function renderPlaylistArt(playlist, sizeClass = '') {
  if (playlist.isLiked) {
    return `<div class="${sizeClass} liked">${ICONS.heartFilled}</div>`;
  }
  if (playlist.cover) {
    return `<div class="${sizeClass}"><img src="${escapeHTML(playlist.cover)}" alt="" loading="lazy"></div>`;
  }
  const tracks = getPlaylistTracks(playlist);
  const covers = [...new Set(tracks.map((t) => t.cover).filter(Boolean))].slice(0, 4);
  if (covers.length >= 4) {
    return `<div class="${sizeClass}"><div class="mosaic">${covers.map((c) => `<img src="${escapeHTML(c)}" alt="" loading="lazy">`).join('')}</div></div>`;
  }
  if (covers.length >= 1) {
    return `<div class="${sizeClass}"><img src="${escapeHTML(covers[0])}" alt="" loading="lazy"></div>`;
  }
  return `<div class="${sizeClass}">${ICONS.note}</div>`;
}

function activeMedia() {
  const t = getTrack(state.currentTrackId);
  return state.videoMode && t?.videoUrl ? video : audio;
}

/* ---------- Navigation ---------- */

function currentRoute() {
  return state.navHistory[state.navIndex];
}

function navigate(view, param = null, replace = false) {
  const current = currentRoute();
  if (!replace && current && current.view === view && current.param === param) {
    renderMain();
    return;
  }
  if (replace) {
    state.navHistory[state.navIndex] = { view, param };
  } else {
    state.navHistory = state.navHistory.slice(0, state.navIndex + 1);
    state.navHistory.push({ view, param });
    state.navIndex = state.navHistory.length - 1;
  }
  renderNavButtons();
  renderMain();
  renderSidebar();
  const scroller = $('#mainScroll');
  if (scroller) scroller.scrollTop = 0;
}

function renderNavButtons() {
  $('#backBtn').disabled = state.navIndex <= 0;
  $('#fwdBtn').disabled = state.navIndex >= state.navHistory.length - 1;

  const { view } = currentRoute();
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === view);
  });
}

/* ---------- Playback Engine ---------- */

function shuffleArray(arr, keepFirstValue = null) {
  const copy = arr.filter((x) => x !== keepFirstValue);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return keepFirstValue !== null ? [keepFirstValue, ...copy] : copy;
}

async function playFromList(trackIds, startIndex = 0) {
  if (!trackIds.length) {
    notify('No playable tracks here', true);
    return;
  }
  const targetId = trackIds[Math.max(0, Math.min(startIndex, trackIds.length - 1))];
  state.originalQueue = [...trackIds];

  if (state.shuffle) {
    state.queue = shuffleArray(trackIds, targetId);
    state.queueIndex = 0;
  } else {
    state.queue = [...trackIds];
    state.queueIndex = state.queue.indexOf(targetId);
  }
  await loadAndPlayTrack(targetId);
}

async function loadAndPlayTrack(trackId) {
  const track = getTrack(trackId);
  if (!track) return;

  const media = state.videoMode && track.videoUrl ? video : audio;
  const other = media === audio ? video : audio;

  if (state.currentTrackId === trackId) {
    if (media.paused) await media.play().catch(() => {});
    else media.pause();
    return;
  }

  audio.pause();
  video.pause();
  other.removeAttribute('src');

  state.currentTrackId = trackId;
  if (!track.videoUrl && state.videoMode) {
    state.videoMode = false;
  }

  video.hidden = !(state.videoMode && track.videoUrl);
  media.src = state.videoMode && track.videoUrl ? track.videoUrl : track.url;

  updateNowPlayingUI();
  updatePlayingRowIndicators();

  try {
    await media.play();
  } catch {
    notify(`Could not play "${track.title}"`, true);
  }
}

function togglePlayPause() {
  if (!state.currentTrackId) {
    if (state.tracks.length) playFromList(state.tracks.map((t) => t.id), 0);
    return;
  }
  const media = activeMedia();
  if (media.paused) media.play().catch(() => {});
  else media.pause();
}

function playNext(auto = false) {
  if (!state.queue.length) return;
  if (auto && state.repeat === 'one') {
    const media = activeMedia();
    media.currentTime = 0;
    media.play().catch(() => {});
    return;
  }
  if (state.queueIndex < state.queue.length - 1) {
    state.queueIndex++;
    loadAndPlayTrack(state.queue[state.queueIndex]);
  } else if (state.repeat === 'all' || !auto) {
    state.queueIndex = 0;
    loadAndPlayTrack(state.queue[0]);
  }
}

function playPrev() {
  if (!state.queue.length) return;
  const media = activeMedia();
  if (media.currentTime > 3) {
    media.currentTime = 0;
    return;
  }
  if (state.queueIndex > 0) {
    state.queueIndex--;
  } else if (state.repeat === 'all') {
    state.queueIndex = state.queue.length - 1;
  } else {
    media.currentTime = 0;
    return;
  }
  loadAndPlayTrack(state.queue[state.queueIndex]);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  if (state.originalQueue.length) {
    const cur = state.currentTrackId;
    if (state.shuffle) {
      state.queue = shuffleArray(state.originalQueue, cur);
      state.queueIndex = 0;
    } else {
      state.queue = [...state.originalQueue];
      state.queueIndex = Math.max(0, state.queue.indexOf(cur));
    }
  }
  updateTransportButtons();
}

function cycleRepeat() {
  const order = ['off', 'all', 'one'];
  state.repeat = order[(order.indexOf(state.repeat) + 1) % order.length];
  updateTransportButtons();
}

function switchVideoMode() {
  const track = getTrack(state.currentTrackId);
  if (!track || !track.videoUrl) return;

  const oldMedia = activeMedia();
  const wasPlaying = !oldMedia.paused;
  const savedTime = oldMedia.currentTime || 0;
  oldMedia.pause();

  state.videoMode = !state.videoMode;
  const newMedia = activeMedia();
  video.hidden = !state.videoMode;

  newMedia.src = state.videoMode ? track.videoUrl : track.url;
  newMedia.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(newMedia.duration)) {
      newMedia.currentTime = Math.min(savedTime, newMedia.duration);
    }
    if (wasPlaying) newMedia.play().catch(() => {});
  }, { once: true });

  updateTransportButtons();
}

/* ---------- UI Updating ---------- */

function updateNowPlayingUI() {
  const track = getTrack(state.currentTrackId);
  if (!track) return;

  $('#npTitle').textContent = track.title;
  const artistBtn = $('#npArtistBtn');
  artistBtn.textContent = track.artist;
  artistBtn.disabled = false;
  artistBtn.dataset.openArtist = track.artist;

  const coverEl = $('#npCover');
  coverEl.innerHTML = track.cover
    ? `<img src="${escapeHTML(track.cover)}" alt="">`
    : ICONS.note;

  const liked = state.likedFiles.has(track.file);
  const likeBtn = $('#npLikeBtn');
  likeBtn.innerHTML = liked ? ICONS.heartFilled : ICONS.heart;
  likeBtn.classList.toggle('active', liked);

  $('#videoModeBtn').classList.toggle('hidden', !track.videoUrl);
  updateTransportButtons();

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.cover ? [{ src: track.cover }] : []
    });
  }
}

function updateTransportButtons() {
  const media = activeMedia();
  const isPlaying = Boolean(state.currentTrackId && !media.paused);
  $('#playPauseBtn').innerHTML = isPlaying ? ICONS.pause : ICONS.play;
  $('#shuffleBtn').classList.toggle('active', state.shuffle);

  const repBtn = $('#repeatBtn');
  repBtn.classList.toggle('active', state.repeat !== 'off');
  repBtn.title = state.repeat === 'one' ? 'Repeat one' : state.repeat === 'all' ? 'Repeat all' : 'Repeat off';
  repBtn.innerHTML = state.repeat === 'one'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor" stroke="none" font-weight="700">1</text></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;

  const vidBtn = $('#videoModeBtn');
  vidBtn.textContent = state.videoMode ? 'Audio' : 'Video';
  vidBtn.classList.toggle('secondary', !state.videoMode);
}

function updatePlayingRowIndicators() {
  const media = activeMedia();
  const playing = Boolean(state.currentTrackId && !media.paused);

  document.querySelectorAll('.track-row').forEach((row) => {
    const isCurrent = row.dataset.trackId === state.currentTrackId;
    row.classList.toggle('playing', isCurrent);
    const iconSlot = row.querySelector('.t-play-icon');
    if (iconSlot) {
      iconSlot.innerHTML = isCurrent && playing ? ICONS.pause : ICONS.play;
    }
  });

  const heroPlay = $('#heroPlayBtn');
  if (heroPlay && heroPlay.dataset.contextActive === '1') {
    heroPlay.innerHTML = playing ? ICONS.pause : ICONS.play;
  }
}

/* ---------- Rendering Views ---------- */

function renderSidebar() {
  const list = $('#libraryList');
  const { view, param } = currentRoute();
  $('#trackTotalBadge').textContent = `${state.tracks.length} ${state.tracks.length === 1 ? 'song' : 'songs'}`;

  document.querySelectorAll('[data-lib-filter]').forEach((b) => {
    b.classList.toggle('active', b.dataset.libFilter === state.libFilter);
  });

  if (state.libFilter === 'playlists') {
    const playlists = getAllPlaylists();
    list.innerHTML = playlists.map((pl) => {
      const active = view === 'playlist' && param === pl.id ? 'active' : '';
      const count = getPlaylistTracks(pl).length;
      return `
        <button class="lib-item ${active}" data-open-playlist="${escapeHTML(pl.id)}">
          ${renderPlaylistArt(pl, 'lib-thumb')}
          <div class="lib-meta">
            <div class="lib-name">${escapeHTML(pl.name)}</div>
            <div class="lib-sub">Playlist · ${count} ${count === 1 ? 'song' : 'songs'}</div>
          </div>
        </button>
      `;
    }).join('');
  } else if (state.libFilter === 'albums') {
    const albums = [...state.albums.values()];
    list.innerHTML = albums.length
      ? albums.map((alb) => `
          <button class="lib-item ${view === 'album' && param === alb.id ? 'active' : ''}" data-open-album="${escapeHTML(alb.id)}">
            <div class="lib-thumb">${alb.cover ? `<img src="${escapeHTML(alb.cover)}" alt="" loading="lazy">` : ICONS.disc}</div>
            <div class="lib-meta">
              <div class="lib-name">${escapeHTML(alb.title)}</div>
              <div class="lib-sub">Album · ${escapeHTML(alb.artist)}</div>
            </div>
          </button>
        `).join('')
      : `<div style="padding:16px;color:var(--text-muted);font-size:12px;">No albums found. Add album names in <code>Music/music.json</code>.</div>`;
  } else {
    const artists = [...state.artists.values()].sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = artists.length
      ? artists.map((art) => `
          <button class="lib-item ${view === 'artist' && param === art.name ? 'active' : ''}" data-open-artist="${escapeHTML(art.name)}">
            <div class="lib-thumb round">${art.avatar ? `<img src="${escapeHTML(art.avatar)}" alt="" loading="lazy">` : ICONS.user}</div>
            <div class="lib-meta">
              <div class="lib-name">${escapeHTML(art.name)}</div>
              <div class="lib-sub">Artist · ${art.tracks.length} ${art.tracks.length === 1 ? 'song' : 'songs'}</div>
            </div>
          </button>
        `).join('')
      : `<div style="padding:16px;color:var(--text-muted);font-size:12px;">No artists loaded yet.</div>`;
  }
}

function trackRowHTML(track, index, queueIds, options = {}) {
  const isCurrent = state.currentTrackId === track.id;
  const isPlaying = isCurrent && !activeMedia().paused;
  const liked = state.likedFiles.has(track.file);
  const albumObj = [...state.albums.values()].find((a) => a.title === track.album && a.artist === track.artist);

  return `
    <div class="track-row${isCurrent ? ' playing' : ''}" data-track-id="${escapeHTML(track.id)}">
      <button class="t-idx" data-play-index="${index}" data-queue='${escapeHTML(JSON.stringify(queueIds))}' aria-label="Play ${escapeHTML(track.title)}">
        <span class="t-num">${index + 1}</span>
        <span class="t-play-icon">${isPlaying ? ICONS.pause : ICONS.play}</span>
      </button>

      <div class="t-main">
        <div class="t-cover">${track.cover ? `<img src="${escapeHTML(track.cover)}" alt="" loading="lazy">` : ICONS.note}</div>
        <div class="t-info">
          <div class="t-name">${escapeHTML(track.title)}</div>
          <div class="t-artist"><button data-open-artist="${escapeHTML(track.artist)}">${escapeHTML(track.artist)}</button></div>
        </div>
      </div>

      <div class="t-album">
        ${albumObj
          ? `<button data-open-album="${escapeHTML(albumObj.id)}">${escapeHTML(track.album)}</button>`
          : escapeHTML(track.album)}
      </div>

      <div class="t-actions">
        <button class="t-btn${liked ? ' active' : ''}" data-toggle-like="${escapeHTML(track.file)}" title="Save to Liked Songs" aria-label="Like">
          ${liked ? ICONS.heartFilled : ICONS.heart}
        </button>
        ${options.removeFromPlaylist
          ? `<button class="t-btn" data-remove-from-playlist="${escapeHTML(options.removeFromPlaylist)}" data-file="${escapeHTML(track.file)}" title="Remove from playlist" aria-label="Remove">${ICONS.trash}</button>`
          : `<button class="t-btn" data-add-menu="${escapeHTML(track.file)}" title="Add to playlist" aria-label="Add to playlist">${ICONS.plus}</button>`}
      </div>

      <div class="t-dur" data-dur-for="${escapeHTML(track.id)}">${track.duration ? formatTime(track.duration) : '—'}</div>
    </div>
  `;
}

function renderTrackTable(tracks, options = {}) {
  if (!tracks.length) {
    return `<div class="empty-state">${escapeHTML(options.emptyMessage || 'No tracks found.')}</div>`;
  }
  const ids = tracks.map((t) => t.id);
  return `
    <div class="track-table-head">
      <div style="text-align:center;">#</div>
      <div>Title</div>
      <div>Album</div>
      <div></div>
      <div style="text-align:right;">Time</div>
    </div>
    <div>
      ${tracks.map((t, i) => trackRowHTML(t, i, ids, options)).join('')}
    </div>
  `;
}

function renderHomeView() {
  const playlists = getAllPlaylists();
  const albums = [...state.albums.values()];
  const artists = [...state.artists.values()];
  const quickItems = playlists.slice(0, 6);

  return `
    <div class="quick-grid">
      ${quickItems.map((pl) => `
        <div class="quick-card" data-open-playlist="${escapeHTML(pl.id)}" style="cursor:pointer;">
          ${renderPlaylistArt(pl, 'quick-cover')}
          <div class="quick-title">${escapeHTML(pl.name)}</div>
          <button class="card-play-fab" data-quick-play-playlist="${escapeHTML(pl.id)}" aria-label="Play ${escapeHTML(pl.name)}">${ICONS.play}</button>
        </div>
      `).join('')}
    </div>

    ${albums.length ? `
      <div class="section-head"><h2>Albums</h2></div>
      <div class="card-grid">
        ${albums.map((alb) => `
          <div class="media-card" data-open-album="${escapeHTML(alb.id)}">
            <div class="card-art">
              ${alb.cover ? `<img src="${escapeHTML(alb.cover)}" alt="" loading="lazy">` : ICONS.disc}
              <button class="card-play-fab" data-quick-play-album="${escapeHTML(alb.id)}" aria-label="Play ${escapeHTML(alb.title)}">${ICONS.play}</button>
            </div>
            <div class="card-title">${escapeHTML(alb.title)}</div>
            <div class="card-sub">${alb.year ? `${escapeHTML(alb.year)} · ` : ''}${escapeHTML(alb.artist)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${artists.length ? `
      <div class="section-head"><h2>Artists</h2></div>
      <div class="card-grid">
        ${artists.slice(0, 12).map((art) => `
          <div class="media-card" data-open-artist="${escapeHTML(art.name)}">
            <div class="card-art round">
              ${art.avatar ? `<img src="${escapeHTML(art.avatar)}" alt="" loading="lazy">` : ICONS.user}
              <button class="card-play-fab" data-quick-play-artist="${escapeHTML(art.name)}" aria-label="Play ${escapeHTML(art.name)}">${ICONS.play}</button>
            </div>
            <div class="card-title">${escapeHTML(art.name)}</div>
            <div class="card-sub">Artist</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="section-head">
      <h2>All Tracks</h2>
      <span style="color:var(--text-subdued);font-size:13px;">${state.tracks.length} songs</span>
    </div>
    ${renderTrackTable(state.tracks, {
      emptyMessage: 'No MP3s found. Add songs to your Music folder or Music/music.json.'
    })}
  `;
}

function renderSearchView() {
  const q = state.searchQuery.trim().toLowerCase();
  if (!q) {
    return `
      <div class="section-head"><h2>Browse all tracks</h2></div>
      ${renderTrackTable(state.tracks, { emptyMessage: 'No MP3s found in Music folder.' })}
    `;
  }

  const matchingTracks = state.tracks.filter((t) =>
    `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q)
  );
  const matchingArtists = [...state.artists.values()].filter((a) =>
    a.name.toLowerCase().includes(q)
  );
  const matchingAlbums = [...state.albums.values()].filter((a) =>
    `${a.title} ${a.artist}`.toLowerCase().includes(q)
  );
  const matchingPlaylists = getAllPlaylists().filter((p) =>
    `${p.name} ${p.description}`.toLowerCase().includes(q)
  );

  return `
    ${matchingArtists.length ? `
      <div class="section-head"><h2>Artists</h2></div>
      <div class="card-grid">
        ${matchingArtists.slice(0, 6).map((art) => `
          <div class="media-card" data-open-artist="${escapeHTML(art.name)}">
            <div class="card-art round">${art.avatar ? `<img src="${escapeHTML(art.avatar)}" alt="">` : ICONS.user}</div>
            <div class="card-title">${escapeHTML(art.name)}</div>
            <div class="card-sub">Artist</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${matchingAlbums.length ? `
      <div class="section-head"><h2>Albums</h2></div>
      <div class="card-grid">
        ${matchingAlbums.slice(0, 6).map((alb) => `
          <div class="media-card" data-open-album="${escapeHTML(alb.id)}">
            <div class="card-art">${alb.cover ? `<img src="${escapeHTML(alb.cover)}" alt="">` : ICONS.disc}</div>
            <div class="card-title">${escapeHTML(alb.title)}</div>
            <div class="card-sub">${escapeHTML(alb.artist)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${matchingPlaylists.length ? `
      <div class="section-head"><h2>Playlists</h2></div>
      <div class="card-grid">
        ${matchingPlaylists.slice(0, 6).map((pl) => `
          <div class="media-card" data-open-playlist="${escapeHTML(pl.id)}">
            ${renderPlaylistArt(pl, 'card-art')}
            <div class="card-title">${escapeHTML(pl.name)}</div>
            <div class="card-sub">Playlist</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="section-head"><h2>Songs</h2></div>
    ${renderTrackTable(matchingTracks, { emptyMessage: `No songs matching "${state.searchQuery}"` })}
  `;
}

function renderLibraryView() {
  const playlists = getAllPlaylists();
  return `
    <div class="section-head">
      <h2>Your Playlists</h2>
      <button id="libPageCreateBtn" class="btn-pill" style="padding:7px 14px;">+ New Playlist</button>
    </div>
    <div class="card-grid">
      ${playlists.map((pl) => `
        <div class="media-card" data-open-playlist="${escapeHTML(pl.id)}">
          ${renderPlaylistArt(pl, 'card-art')}
          <div class="card-title">${escapeHTML(pl.name)}</div>
          <div class="card-sub">${getPlaylistTracks(pl).length} songs</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderPlaylistView(id) {
  const pl = getPlaylist(id);
  if (!pl) return `<div class="empty-state">Playlist not found.</div>`;

  const tracks = getPlaylistTracks(pl);
  const ids = tracks.map((t) => t.id);
  const isPlayingThis = state.currentTrackId && ids.includes(state.currentTrackId) && !activeMedia().paused;
  const sampleSrc = pl.cover || tracks.find((t) => t.cover)?.cover || '';
  const tint = pl.isLiked ? '#4a2f8f' : await sampleImageColor(sampleSrc, '#2b2b2b');

  return `
    <div class="entity-hero" style="--hero-tint:${tint};">
      ${renderPlaylistArt(pl, 'hero-cover')}
      <div class="hero-meta">
        <div class="hero-type">Playlist</div>
        <h1 class="hero-title">${escapeHTML(pl.name)}</h1>
        ${pl.description ? `<p class="hero-desc">${escapeHTML(pl.description)}</p>` : ''}
        <div class="hero-stats">
          <strong>${pl.isLiked ? 'You' : (pl.isUser ? 'Personal' : 'Shared')}</strong>
          <span>·</span>
          <span>${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}</span>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn-play-large" id="heroPlayBtn" data-play-collection='${escapeHTML(JSON.stringify(ids))}' data-context-active="${ids.includes(state.currentTrackId) ? '1' : '0'}" aria-label="Play playlist">
        ${isPlayingThis ? ICONS.pause : ICONS.play}
      </button>
      <button class="action-icon ${state.shuffle ? 'active' : ''}" id="heroShuffleBtn" title="Shuffle" aria-label="Shuffle">${ICONS.shuffle}</button>
      ${pl.isUser ? `<button class="action-icon" data-edit-playlist="${escapeHTML(pl.id)}" title="Edit playlist details" aria-label="Edit playlist">${ICONS.edit}</button>` : ''}
    </div>

    ${renderTrackTable(tracks, {
      emptyMessage: pl.isUser ? 'This playlist is empty. Search below to add songs.' : 'No matching tracks found in Music folder.',
      removeFromPlaylist: pl.isUser ? pl.id : null
    })}

    ${pl.isUser ? `
      <div class="inline-finder">
        <h3>Let's find something for your playlist</h3>
        <label class="search-box" style="margin-bottom:14px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="inlineAddSearch" data-playlist-id="${escapeHTML(pl.id)}" placeholder="Search songs to add...">
        </label>
        <div id="inlineAddResults"></div>
      </div>
    ` : ''}
  `;
}

async function renderAlbumView(albumId) {
  const album = [...state.albums.values()].find((a) => a.id === albumId);
  if (!album) return `<div class="empty-state">Album not found.</div>`;

  const ids = album.tracks.map((t) => t.id);
  const isPlayingThis = state.currentTrackId && ids.includes(state.currentTrackId) && !activeMedia().paused;
  const tint = await sampleImageColor(album.cover, '#2c2c2c');

  return `
    <div class="entity-hero" style="--hero-tint:${tint};">
      <div class="hero-cover">${album.cover ? `<img src="${escapeHTML(album.cover)}" alt="">` : ICONS.disc}</div>
      <div class="hero-meta">
        <div class="hero-type">Album</div>
        <h1 class="hero-title">${escapeHTML(album.title)}</h1>
        <div class="hero-stats">
          <button data-open-artist="${escapeHTML(album.artist)}"><strong>${escapeHTML(album.artist)}</strong></button>
          ${album.year ? `<span>·</span><span>${escapeHTML(album.year)}</span>` : ''}
          <span>·</span>
          <span>${album.tracks.length} ${album.tracks.length === 1 ? 'song' : 'songs'}</span>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn-play-large" id="heroPlayBtn" data-play-collection='${escapeHTML(JSON.stringify(ids))}' data-context-active="${ids.includes(state.currentTrackId) ? '1' : '0'}" aria-label="Play album">
        ${isPlayingThis ? ICONS.pause : ICONS.play}
      </button>
      <button class="action-icon ${state.shuffle ? 'active' : ''}" id="heroShuffleBtn" title="Shuffle" aria-label="Shuffle">${ICONS.shuffle}</button>
    </div>

    ${renderTrackTable(album.tracks)}
  `;
}

async function renderArtistView(artistName) {
  const artist = state.artists.get(artistName);
  if (!artist) return `<div class="empty-state">Artist not found.</div>`;

  const ids = artist.tracks.map((t) => t.id);
  const isPlayingThis = state.currentTrackId && ids.includes(state.currentTrackId) && !activeMedia().paused;
  const artistAlbums = [...state.albums.values()].filter((a) => artist.albumIds.has(a.id));
  const tint = await sampleImageColor(artist.banner || artist.avatar, '#2c2c2c');
  const bannerStyle = artist.banner
    ? `background-image:url('${escapeHTML(artist.banner)}');--hero-tint:${tint};`
    : `--hero-tint:${tint};`;

  return `
    <div class="entity-hero ${artist.banner ? 'with-banner' : ''}" style="${bannerStyle}">
      ${artist.banner ? '' : `<div class="hero-cover round">${artist.avatar ? `<img src="${escapeHTML(artist.avatar)}" alt="">` : ICONS.user}</div>`}
      <div class="hero-meta">
        <div class="hero-type">${artist.genre ? escapeHTML(artist.genre) : 'Artist'}</div>
        <h1 class="hero-title">${escapeHTML(artist.name)}</h1>
        ${artist.bio ? `<p class="hero-desc">${escapeHTML(artist.bio)}</p>` : ''}
        <div class="hero-stats">
          <span>${artist.tracks.length} ${artist.tracks.length === 1 ? 'track' : 'tracks'}</span>
          ${artistAlbums.length ? `<span>·</span><span>${artistAlbums.length} ${artistAlbums.length === 1 ? 'album' : 'albums'}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn-play-large" id="heroPlayBtn" data-play-collection='${escapeHTML(JSON.stringify(ids))}' data-context-active="${ids.includes(state.currentTrackId) ? '1' : '0'}" aria-label="Play artist">
        ${isPlayingThis ? ICONS.pause : ICONS.play}
      </button>
      <button class="action-icon ${state.shuffle ? 'active' : ''}" id="heroShuffleBtn" title="Shuffle" aria-label="Shuffle">${ICONS.shuffle}</button>
    </div>

    <div class="section-head"><h2>Tracks</h2></div>
    ${renderTrackTable(artist.tracks)}

    ${artistAlbums.length ? `
      <div class="section-head"><h2>Discography</h2></div>
      <div class="card-grid">
        ${artistAlbums.map((alb) => `
          <div class="media-card" data-open-album="${escapeHTML(alb.id)}">
            <div class="card-art">
              ${alb.cover ? `<img src="${escapeHTML(alb.cover)}" alt="" loading="lazy">` : ICONS.disc}
              <button class="card-play-fab" data-quick-play-album="${escapeHTML(alb.id)}" aria-label="Play ${escapeHTML(alb.title)}">${ICONS.play}</button>
            </div>
            <div class="card-title">${escapeHTML(alb.title)}</div>
            <div class="card-sub">${alb.year ? `${escapeHTML(alb.year)} · ` : ''}Album</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

async function renderMain() {
  const container = $('#mainScroll');
  const { view, param } = currentRoute();
  let html = '';

  if (view === 'home') html = renderHomeView();
  else if (view === 'search') html = renderSearchView();
  else if (view === 'library') html = renderLibraryView();
  else if (view === 'playlist') html = await renderPlaylistView(param);
  else if (view === 'album') html = await renderAlbumView(param);
  else if (view === 'artist') html = await renderArtistView(param);

  container.innerHTML = html;

  if (view === 'playlist') {
    renderInlineAddResults(param, '');
  }
}

function renderInlineAddResults(playlistId, query) {
  const target = $('#inlineAddResults');
  if (!target) return;
  const pl = getPlaylist(playlistId);
  if (!pl) return;

  const q = query.trim().toLowerCase();
  const existing = new Set(pl.songs);
  const candidates = state.tracks
    .filter((t) => !existing.has(t.file))
    .filter((t) => !q || `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q))
    .slice(0, 15);

  if (!candidates.length) {
    target.innerHTML = `<div style="color:var(--text-subdued);padding:12px 0;">${q ? 'No matching songs left to add.' : 'All available songs are already in this playlist.'}</div>`;
    return;
  }

  target.innerHTML = candidates.map((t) => `
    <div class="track-row" style="grid-template-columns:minmax(0,1fr) auto;">
      <div class="t-main">
        <div class="t-cover">${t.cover ? `<img src="${escapeHTML(t.cover)}" alt="">` : ICONS.note}</div>
        <div class="t-info">
          <div class="t-name">${escapeHTML(t.title)}</div>
          <div class="t-artist">${escapeHTML(t.artist)}</div>
        </div>
      </div>
      <button class="btn-pill secondary" style="padding:6px 14px;" data-inline-add="${escapeHTML(t.file)}" data-playlist-id="${escapeHTML(pl.id)}">Add</button>
    </div>
  `).join('');
}

/* ---------- Playlist CRUD & Export ---------- */

function openPlaylistModal(playlistId = null) {
  const modal = $('#playlistModal');
  const form = $('#playlistForm');
  form.reset();

  if (playlistId) {
    const pl = state.userPlaylists.find((p) => p.id === playlistId);
    if (!pl) return;
    $('#playlistModalTitle').textContent = 'Edit playlist';
    $('#plEditId').value = pl.id;
    $('#plNameInput').value = pl.name;
    $('#plDescInput').value = pl.description;
    $('#plCoverInput').value = pl.cover;
    $('#deletePlaylistBtn').classList.remove('hidden');
  } else {
    $('#playlistModalTitle').textContent = 'Create playlist';
    $('#plEditId').value = '';
    $('#deletePlaylistBtn').classList.add('hidden');
  }
  modal.showModal();
  $('#plNameInput').focus();
}

function resizeImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 300;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addTrackToPlaylist(playlistId, file) {
  const pl = state.userPlaylists.find((p) => p.id === playlistId);
  if (!pl) return;
  if (pl.songs.includes(file)) {
    notify(`Already in "${pl.name}"`);
    return;
  }
  pl.songs.push(file);
  saveUserPlaylists();
  renderSidebar();
  if (currentRoute().view === 'playlist' && currentRoute().param === playlistId) {
    renderMain();
  }
  notify(`Added to "${pl.name}"`);
}

function toggleLike(file) {
  if (!file) return;
  if (state.likedFiles.has(file)) {
    state.likedFiles.delete(file);
    notify('Removed from Liked Songs');
  } else {
    state.likedFiles.add(file);
    notify('Added to Liked Songs');
  }
  saveLiked();
  renderSidebar();
  if (currentRoute().view === 'playlist' && currentRoute().param === 'liked-songs') {
    renderMain();
  } else {
    document.querySelectorAll('[data-toggle-like]').forEach((btn) => {
      if (btn.dataset.toggleLike === file) {
        const liked = state.likedFiles.has(file);
        btn.classList.toggle('active', liked);
        btn.innerHTML = liked ? ICONS.heartFilled : ICONS.heart;
      }
    });
  }
  const cur = getTrack(state.currentTrackId);
  if (cur && cur.file === file) updateNowPlayingUI();
}

function showAddToPlaylistPopover(anchorBtn, file) {
  closePopover();
  const pop = document.createElement('div');
  pop.className = 'menu-popover';

  const playlists = state.userPlaylists;
  pop.innerHTML = `
    <div class="menu-label">Add to playlist</div>
    ${playlists.length
      ? playlists.map((pl) => `
          <button class="menu-item" data-pick-playlist="${escapeHTML(pl.id)}" data-file="${escapeHTML(file)}">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(pl.name)}</span>
            <span style="color:var(--text-subdued);font-size:11px;">${pl.songs.includes(file) ? 'Added' : '+'}</span>
          </button>
        `).join('')
      : `<div style="padding:8px 10px;font-size:12px;color:var(--text-subdued);">No personal playlists yet.</div>`}
    <button class="menu-item" id="popoverNewPlaylist" data-file="${escapeHTML(file)}" style="border-top:1px solid var(--border);margin-top:4px;font-weight:700;">
      + Create new playlist
    </button>
  `;

  document.body.appendChild(pop);
  const rect = anchorBtn.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const left = Math.min(window.innerWidth - popRect.width - 12, Math.max(12, rect.right - popRect.width));
  const top = rect.bottom + popRect.height + 8 > window.innerHeight ? rect.top - popRect.height - 6 : rect.bottom + 6;
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  activePopover = pop;
}

function exportPlaylistsJSON() {
  const exported = state.userPlaylists.map(({ id, name, description, cover, songs }) => ({
    id, name, description, cover, pinValue: 'none', songs
  }));
  const blob = new Blob([JSON.stringify({ playlists: exported }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'playlist.json';
  a.click();
  URL.revokeObjectURL(url);
  notify('Downloaded playlist.json');
}

/* ---------- Event Listeners ---------- */

document.addEventListener('click', (e) => {
  if (activePopover && !e.target.closest('.menu-popover') && !e.target.closest('[data-add-menu]')) {
    closePopover();
  }

  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    navigate(navBtn.dataset.nav);
    if (navBtn.dataset.nav === 'search') {
      setTimeout(() => $('#globalSearch').focus(), 20);
    }
    return;
  }

  const libFilterBtn = e.target.closest('[data-lib-filter]');
  if (libFilterBtn) {
    state.libFilter = libFilterBtn.dataset.libFilter;
    renderSidebar();
    return;
  }

  const closeModalBtn = e.target.closest('[data-close-modal]');
  if (closeModalBtn) {
    document.getElementById(closeModalBtn.dataset.closeModal)?.close();
    return;
  }

  const qpPlaylist = e.target.closest('[data-quick-play-playlist]');
  if (qpPlaylist) {
    e.stopPropagation();
    const pl = getPlaylist(qpPlaylist.dataset.quickPlayPlaylist);
    playFromList(getPlaylistTracks(pl).map((t) => t.id), 0);
    return;
  }

  const qpAlbum = e.target.closest('[data-quick-play-album]');
  if (qpAlbum) {
    e.stopPropagation();
    const alb = [...state.albums.values()].find((a) => a.id === qpAlbum.dataset.quickPlayAlbum);
    if (alb) playFromList(alb.tracks.map((t) => t.id), 0);
    return;
  }

  const qpArtist = e.target.closest('[data-quick-play-artist]');
  if (qpArtist) {
    e.stopPropagation();
    const art = state.artists.get(qpArtist.dataset.quickPlayArtist);
    if (art) playFromList(art.tracks.map((t) => t.id), 0);
    return;
  }

  const openPl = e.target.closest('[data-open-playlist]');
  if (openPl) {
    navigate('playlist', openPl.dataset.openPlaylist);
    return;
  }

  const openAlb = e.target.closest('[data-open-album]');
  if (openAlb) {
    navigate('album', openAlb.dataset.openAlbum);
    return;
  }

  const openArt = e.target.closest('[data-open-artist]');
  if (openArt) {
    navigate('artist', openArt.dataset.openArtist);
    return;
  }

  const playIdxBtn = e.target.closest('[data-play-index]');
  if (playIdxBtn) {
    const idx = Number(playIdxBtn.dataset.playIndex);
    const queue = JSON.parse(playIdxBtn.dataset.queue || '[]');
    const targetId = queue[idx];
    if (state.currentTrackId === targetId) {
      togglePlayPause();
    } else {
      playFromList(queue, idx);
    }
    return;
  }

  const heroPlay = e.target.closest('#heroPlayBtn');
  if (heroPlay) {
    const ids = JSON.parse(heroPlay.dataset.playCollection || '[]');
    if (state.currentTrackId && ids.includes(state.currentTrackId)) {
      togglePlayPause();
    } else {
      playFromList(ids, 0);
    }
    return;
  }

  if (e.target.closest('#heroShuffleBtn')) {
    toggleShuffle();
    e.target.closest('#heroShuffleBtn').classList.toggle('active', state.shuffle);
    return;
  }

  const likeBtn = e.target.closest('[data-toggle-like]');
  if (likeBtn) {
    toggleLike(likeBtn.dataset.toggleLike);
    return;
  }

  const addMenuBtn = e.target.closest('[data-add-menu]');
  if (addMenuBtn) {
    showAddToPlaylistPopover(addMenuBtn, addMenuBtn.dataset.addMenu);
    return;
  }

  const pickPl = e.target.closest('[data-pick-playlist]');
  if (pickPl) {
    addTrackToPlaylist(pickPl.dataset.pickPlaylist, pickPl.dataset.file);
    closePopover();
    return;
  }

  const popNewPl = e.target.closest('#popoverNewPlaylist');
  if (popNewPl) {
    const file = popNewPl.dataset.file;
    closePopover();
    const pl = normalizePlaylist({ name: `Playlist #${state.userPlaylists.length + 1}`, songs: [file] }, true);
    state.userPlaylists.unshift(pl);
    saveUserPlaylists();
    renderSidebar();
    navigate('playlist', pl.id);
    notify(`Created "${pl.name}"`);
    return;
  }

  const inlineAdd = e.target.closest('[data-inline-add]');
  if (inlineAdd) {
    addTrackToPlaylist(inlineAdd.dataset.playlistId, inlineAdd.dataset.inlineAdd);
    return;
  }

  const remBtn = e.target.closest('[data-remove-from-playlist]');
  if (remBtn) {
    const pl = state.userPlaylists.find((p) => p.id === remBtn.dataset.removeFromPlaylist);
    if (pl) {
      pl.songs = pl.songs.filter((f) => f !== remBtn.dataset.file);
      saveUserPlaylists();
      renderSidebar();
      renderMain();
      notify('Removed from playlist');
    }
    return;
  }

  const editPlBtn = e.target.closest('[data-edit-playlist]');
  if (editPlBtn) {
    openPlaylistModal(editPlBtn.dataset.editPlaylist);
    return;
  }

  if (e.target.closest('#libPageCreateBtn')) {
    openPlaylistModal();
  }
});

document.addEventListener('dblclick', (e) => {
  const row = e.target.closest('.track-row');
  if (!row || e.target.closest('button')) return;
  const playBtn = row.querySelector('[data-play-index]');
  if (playBtn) playBtn.click();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'inlineAddSearch') {
    renderInlineAddResults(e.target.dataset.playlistId, e.target.value);
  }
});

$('#globalSearch').addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  if (currentRoute().view !== 'search') {
    navigate('search');
  } else {
    renderMain();
  }
});

$('#backBtn').addEventListener('click', () => {
  if (state.navIndex > 0) {
    state.navIndex--;
    renderNavButtons();
    renderMain();
    renderSidebar();
  }
});

$('#fwdBtn').addEventListener('click', () => {
  if (state.navIndex < state.navHistory.length - 1) {
    state.navIndex++;
    renderNavButtons();
    renderMain();
    renderSidebar();
  }
});

$('#newPlaylistBtn').addEventListener('click', () => openPlaylistModal());
$('#topCreatePlaylistBtn').addEventListener('click', () => openPlaylistModal());
$('#exportPlaylistsBtn').addEventListener('click', exportPlaylistsJSON);

$('#plCoverFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImageToDataUrl(file);
    $('#plCoverInput').value = dataUrl;
  } catch {
    notify('Could not read that image', true);
  }
});

$('#playlistForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const editId = $('#plEditId').value;
  const name = $('#plNameInput').value.trim();
  const description = $('#plDescInput').value.trim();
  const cover = safeUrl($('#plCoverInput').value);

  if (!name) return;

  if (editId) {
    const pl = state.userPlaylists.find((p) => p.id === editId);
    if (pl) {
      pl.name = name;
      pl.description = description;
      pl.cover = cover;
      saveUserPlaylists();
      renderSidebar();
      renderMain();
      notify('Playlist updated');
    }
  } else {
    const pl = normalizePlaylist({
      id: `pl-${slugify(name)}-${Date.now()}`,
      name,
      description,
      cover,
      songs: []
    }, true);
    state.userPlaylists.unshift(pl);
    saveUserPlaylists();
    state.libFilter = 'playlists';
    renderSidebar();
    navigate('playlist', pl.id);
    notify(`Created "${pl.name}"`);
  }
  $('#playlistModal').close();
});

$('#deletePlaylistBtn').addEventListener('click', () => {
  const editId = $('#plEditId').value;
  if (!editId) return;
  state.userPlaylists = state.userPlaylists.filter((p) => p.id !== editId);
  saveUserPlaylists();
  $('#playlistModal').close();
  renderSidebar();
  navigate('home', null, true);
  notify('Playlist deleted');
});

$('#playPauseBtn').addEventListener('click', togglePlayPause);
$('#nextBtn').addEventListener('click', () => playNext(false));
$('#prevBtn').addEventListener('click', playPrev);
$('#shuffleBtn').addEventListener('click', toggleShuffle);
$('#repeatBtn').addEventListener('click', cycleRepeat);
$('#videoModeBtn').addEventListener('click', switchVideoMode);
$('#npLikeBtn').addEventListener('click', () => {
  const cur = getTrack(state.currentTrackId);
  if (cur) toggleLike(cur.file);
});

$('#seekBar').addEventListener('input', (e) => {
  const media = activeMedia();
  if (Number.isFinite(media.duration)) {
    media.currentTime = (Number(e.target.value) / 1000) * media.duration;
  }
});

$('#volumeBar').addEventListener('input', (e) => {
  const v = Number(e.target.value) / 100;
  state.lastVolume = v;
  state.muted = v === 0;
  audio.volume = v;
  video.volume = v;
  localStorage.setItem(STORAGE.volume, String(v));
});

$('#muteBtn').addEventListener('click', () => {
  state.muted = !state.muted;
  const v = state.muted ? 0 : (state.lastVolume || 0.8);
  audio.volume = v;
  video.volume = v;
  $('#volumeBar').value = Math.round(v * 100);
});

[audio, video].forEach((media) => {
  media.addEventListener('play', () => {
    updateTransportButtons();
    updatePlayingRowIndicators();
  });

  media.addEventListener('pause', () => {
    updateTransportButtons();
    updatePlayingRowIndicators();
  });

  media.addEventListener('loadedmetadata', () => {
    if (media !== activeMedia()) return;
    $('#totalTime').textContent = formatTime(media.duration);
    const cur = getTrack(state.currentTrackId);
    if (cur && Number.isFinite(media.duration)) {
      cur.duration = media.duration;
      const durCell = document.querySelector(`[data-dur-for="${CSS.escape(cur.id)}"]`);
      if (durCell) durCell.textContent = formatTime(media.duration);
    }
  });

  media.addEventListener('timeupdate', () => {
    if (media !== activeMedia()) return;
    $('#elapsedTime').textContent = formatTime(media.currentTime);
    if (Number.isFinite(media.duration) && media.duration > 0) {
      $('#seekBar').value = Math.round((media.currentTime / media.duration) * 1000);
    }
  });

  media.addEventListener('ended', () => {
    if (media !== activeMedia()) return;
    playNext(true);
  });
});

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    togglePlayPause();
  } else if (e.code === 'ArrowRight' && e.shiftKey) {
    playNext(false);
  } else if (e.code === 'ArrowLeft' && e.shiftKey) {
    playPrev();
  }
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => activeMedia().play().catch(() => {}));
  navigator.mediaSession.setActionHandler('pause', () => activeMedia().pause());
  navigator.mediaSession.setActionHandler('previoustrack', playPrev);
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext(false));
}

(async function init() {
  loadLocalData();
  await Promise.all([loadMusicLibrary(), loadSharedPlaylists()]);
  renderNavButtons();
  renderSidebar();
  renderMain();
})();