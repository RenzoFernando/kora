const data = window.KORA_DATA;
const storageKey = data.storageKey;
const allProfiles = [...data.teamMembers, ...data.demoRoles];

const defaults = {
  device: 'phone',
  view: 'discover',
  loggedIn: false,
  profileId: data.teamMembers[0].id,
  selectedArtistId: data.artists[0].id,
  activeEventId: data.events[0].id,
  savedArtistIds: ['los-pleneros'],
  likedArtistIds: [],
  checkedEventIds: [],
  sharedTargets: [],
  playlistArtistIds: data.playlists[0].tracks.slice(),
  playlistContributions: 0,
  completedMissionIds: [],
  artistFeedback: {},
  settings: {
    autoLogin: true,
    publicProfile: false,
    preview30: true,
    autoplay: false,
    audioMode: 'Demo HQ',
    eventAlerts: true,
    missionAlerts: true,
    highContrast: false,
    captions: true,
    themeMode: 'dark'
  }
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueArray(values, fallback = []) {
  if (!Array.isArray(values)) return clone(fallback);
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeVoiceNote(voiceNote) {
  if (!voiceNote || typeof voiceNote !== 'object' || !voiceNote.dataUrl) return null;
  return {
    dataUrl: String(voiceNote.dataUrl),
    duration: Math.max(0, Number(voiceNote.duration || 0))
  };
}

function normalizeReview(review, fallbackProfileId = defaults.profileId) {
  if (!review || typeof review !== 'object') return null;
  const rating = Math.max(0, Math.min(5, Number(review.rating || 0)));
  const comment = typeof review.comment === 'string' ? review.comment.trim().slice(0, 220) : '';
  const voiceNote = normalizeVoiceNote(review.voiceNote);
  if (!rating && !comment && !voiceNote) return null;
  return {
    id: review.id || `review-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    profileId: review.profileId || fallbackProfileId,
    rating,
    comment,
    voiceNote,
    createdAt: review.createdAt || new Date().toISOString()
  };
}

function normalizeArtistFeedback(feedback) {
  const next = {};
  if (!feedback || typeof feedback !== 'object') return next;
  Object.entries(feedback).forEach(([artistId, reviews]) => {
    next[artistId] = Array.isArray(reviews)
      ? reviews.map((review) => normalizeReview(review)).filter(Boolean)
      : [];
  });
  return next;
}

function mergeState(parsed) {
  const state = clone(defaults);
  Object.assign(state, parsed || {});
  state.settings = Object.assign({}, defaults.settings, parsed?.settings || {});
  state.savedArtistIds = uniqueArray(parsed?.savedArtistIds, defaults.savedArtistIds);
  state.likedArtistIds = uniqueArray(parsed?.likedArtistIds, []);
  state.checkedEventIds = uniqueArray(parsed?.checkedEventIds, []);
  state.sharedTargets = uniqueArray(parsed?.sharedTargets, []);
  state.playlistArtistIds = uniqueArray(parsed?.playlistArtistIds, defaults.playlistArtistIds);
  state.completedMissionIds = uniqueArray(parsed?.completedMissionIds, []);
  state.artistFeedback = normalizeArtistFeedback(parsed?.artistFeedback);
  return state;
}

function getState() {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return mergeState(parsed);
  } catch (error) {
    return clone(defaults);
  }
}

function setState(nextState) {
  const merged = mergeState(nextState);
  localStorage.setItem(storageKey, JSON.stringify(merged));
  return merged;
}

function clearStoredState() {
  localStorage.removeItem(storageKey);
}

function createFreshState(overrides = {}) {
  return mergeState(overrides);
}

function profileFor(profileId) {
  return allProfiles.find((item) => item.id === profileId) || allProfiles[0];
}

function artistFor(artistId) {
  return data.artists.find((item) => item.id === artistId) || data.artists[0];
}

function eventFor(eventId) {
  return data.events.find((item) => item.id === eventId) || data.events[0];
}

function selectedArtist(state) {
  return artistFor(state.selectedArtistId);
}

function playlistTracks(state) {
  return state.playlistArtistIds.map(artistFor);
}

function getArtistReviews(state, artistId) {
  return Array.isArray(state.artistFeedback?.[artistId]) ? state.artistFeedback[artistId].slice() : [];
}

function getArtistReviewMetrics(state, artistId) {
  const reviews = getArtistReviews(state, artistId);
  const rated = reviews.filter((review) => review.rating > 0);
  const voiceCount = reviews.filter((review) => review.voiceNote).length;
  const averageRating = rated.length
    ? rated.reduce((sum, review) => sum + review.rating, 0) / rated.length
    : 0;
  return {
    total: reviews.length,
    voiceCount,
    ratedCount: rated.length,
    averageRating
  };
}

function getProfileReviewStats(state, profileId) {
  return Object.values(state.artistFeedback || {}).flat().reduce((stats, review) => {
    if (review.profileId !== profileId) return stats;
    stats.totalReviews += 1;
    if (review.voiceNote) stats.voiceReviews += 1;
    return stats;
  }, { totalReviews: 0, voiceReviews: 0 });
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-CO').format(value);
}

function formatTime(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function levelFromXp(xp) {
  return `Nivel ${String(Math.max(1, Math.floor(xp / 700))).padStart(2, '0')}`;
}

function getProfileXp(state) {
  const profile = profileFor(state.profileId);
  const eventXp = state.checkedEventIds.reduce((sum, eventId) => sum + (eventFor(eventId)?.reward || 0), 0);
  const missionXp = state.completedMissionIds.reduce((sum, missionId) => {
    const mission = data.missions.find((item) => item.id === missionId);
    return sum + (mission ? mission.reward : 0);
  }, 0);
  const reviewStats = getProfileReviewStats(state, state.profileId);
  return profile.baseXp
    + state.savedArtistIds.length * 120
    + state.likedArtistIds.length * 40
    + state.sharedTargets.length * 90
    + state.playlistContributions * 150
    + reviewStats.totalReviews * 70
    + reviewStats.voiceReviews * 120
    + eventXp
    + missionXp;
}

function getProfileStreak(state) {
  const profile = profileFor(state.profileId);
  const reviewStats = getProfileReviewStats(state, state.profileId);
  return profile.streak
    + Math.min(4, state.checkedEventIds.length)
    + Math.floor(state.sharedTargets.length / 2)
    + Math.min(3, reviewStats.totalReviews);
}

function missionProgress(state, mission) {
  let value = 0;
  switch (mission.type) {
    case 'savedCount':
      value = state.savedArtistIds.length;
      break;
    case 'sharedCount':
      value = state.sharedTargets.length;
      break;
    case 'checkedCount':
      value = state.checkedEventIds.length;
      break;
    case 'playlistCount':
      value = state.playlistContributions;
      break;
    case 'reviewCount':
      value = getProfileReviewStats(state, state.profileId).totalReviews;
      break;
    case 'voiceReviewCount':
      value = getProfileReviewStats(state, state.profileId).voiceReviews;
      break;
    default:
      value = 0;
  }
  return {
    value,
    done: value >= mission.threshold
  };
}

function syncMissions(nextState) {
  const state = mergeState(nextState);
  const newlyCompleted = [];
  data.missions.forEach((mission) => {
    const progress = missionProgress(state, mission);
    const alreadyDone = state.completedMissionIds.includes(mission.id);
    if (progress.done && !alreadyDone) {
      state.completedMissionIds.push(mission.id);
      newlyCompleted.push(mission);
    }
  });
  state.completedMissionIds = uniqueArray(state.completedMissionIds, []);
  return { state, newlyCompleted };
}

export {
  $, $$,
  allProfiles,
  artistFor,
  clearStoredState,
  clone,
  createFreshState,
  data,
  defaults,
  eventFor,
  formatNumber,
  formatTime,
  getArtistReviewMetrics,
  getArtistReviews,
  getProfileReviewStats,
  getProfileStreak,
  getProfileXp,
  getState,
  levelFromXp,
  mergeState,
  missionProgress,
  normalizeReview,
  playlistTracks,
  profileFor,
  selectedArtist,
  setState,
  storageKey,
  syncMissions
};
