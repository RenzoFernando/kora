const audio = new Audio();
audio.preload = 'metadata';

let playerTick = null;
let configured = false;
let getPreviewEnabled = () => true;
let onUiUpdate = () => {};
let onPlaybackBlocked = () => {};

function runUiUpdate() {
  onUiUpdate();
}

function syncTick() {
  clearInterval(playerTick);
  playerTick = setInterval(() => {
    if (getPreviewEnabled() && (audio.currentTime || 0) >= 30) {
      stopAudio(false);
      return;
    }
    runUiUpdate();
  }, 200);
}

function configureAudio(options = {}) {
  getPreviewEnabled = typeof options.getPreviewEnabled === 'function' ? options.getPreviewEnabled : getPreviewEnabled;
  onUiUpdate = typeof options.onUiUpdate === 'function' ? options.onUiUpdate : onUiUpdate;
  onPlaybackBlocked = typeof options.onPlaybackBlocked === 'function' ? options.onPlaybackBlocked : onPlaybackBlocked;
  if (configured) return;
  configured = true;

  audio.addEventListener('loadedmetadata', runUiUpdate);
  audio.addEventListener('play', () => {
    syncTick();
    runUiUpdate();
  });
  audio.addEventListener('pause', () => {
    clearInterval(playerTick);
    runUiUpdate();
  });
  audio.addEventListener('ended', () => {
    stopAudio(true);
  });
}

function loadAudioForArtist(artist) {
  if (!artist) return;
  if (audio.dataset.artistId !== artist.id) {
    audio.src = artist.audio;
    audio.dataset.artistId = artist.id;
  }
}

async function playArtist(artist, { reset = false } = {}) {
  loadAudioForArtist(artist);
  if (reset) {
    audio.currentTime = 0;
  }
  try {
    await audio.play();
    syncTick();
    runUiUpdate();
    return true;
  } catch (error) {
    onPlaybackBlocked(error);
    runUiUpdate();
    return false;
  }
}

async function toggleArtistPlayback(artist) {
  loadAudioForArtist(artist);
  if (audio.paused || audio.dataset.artistId !== artist.id) {
    return playArtist(artist, { reset: audio.dataset.artistId !== artist.id });
  }
  stopAudio(false);
  return true;
}

function stopAudio(reset = false) {
  audio.pause();
  clearInterval(playerTick);
  if (reset) {
    audio.currentTime = 0;
  }
  runUiUpdate();
}

function seekAudio(value) {
  const nextValue = Number(value || 0);
  if (Number.isNaN(nextValue)) return;
  audio.currentTime = nextValue;
  runUiUpdate();
}

function getAudioSnapshot(artistId) {
  const total = Math.min(30, Math.floor(audio.duration || 30)) || 30;
  const isCurrentArtist = audio.dataset.artistId === artistId;
  const currentTime = isCurrentArtist ? Math.min(audio.currentTime || 0, total) : 0;
  return {
    isCurrentArtist,
    isPlaying: isCurrentArtist && !audio.paused,
    currentTime,
    total
  };
}

export {
  audio,
  configureAudio,
  getAudioSnapshot,
  loadAudioForArtist,
  playArtist,
  seekAudio,
  stopAudio,
  toggleArtistPlayback
};
