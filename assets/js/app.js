(function () {
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
    settings: {
      autoLogin: true,
      publicProfile: false,
      preview30: true,
      autoplay: false,
      audioMode: 'Demo HQ',
      eventAlerts: true,
      missionAlerts: true,
      highContrast: false,
      captions: true
    }
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  const audio = new Audio();
  audio.preload = 'metadata';
  let toastTimer = null;
  let playerTick = null;
  let selectedLoginId = defaults.profileId;
  let scannerEventId = defaults.activeEventId;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeState(parsed) {
    const state = clone(defaults);
    Object.assign(state, parsed || {});
    state.settings = Object.assign({}, defaults.settings, parsed?.settings || {});
    state.savedArtistIds = Array.isArray(parsed?.savedArtistIds) ? parsed.savedArtistIds : clone(defaults.savedArtistIds);
    state.likedArtistIds = Array.isArray(parsed?.likedArtistIds) ? parsed.likedArtistIds : [];
    state.checkedEventIds = Array.isArray(parsed?.checkedEventIds) ? parsed.checkedEventIds : [];
    state.sharedTargets = Array.isArray(parsed?.sharedTargets) ? parsed.sharedTargets : [];
    state.playlistArtistIds = Array.isArray(parsed?.playlistArtistIds) ? parsed.playlistArtistIds : clone(defaults.playlistArtistIds);
    state.completedMissionIds = Array.isArray(parsed?.completedMissionIds) ? parsed.completedMissionIds : [];
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

  function setState(next) {
    const merged = mergeState(next);
    localStorage.setItem(storageKey, JSON.stringify(merged));
    return merged;
  }

  function resetState() {
    localStorage.removeItem(storageKey);
    stopAudio(true);
    setState(clone(defaults));
    selectedLoginId = defaults.profileId;
    scannerEventId = defaults.activeEventId;
    render();
    openLogin();
    showToast('Demo reiniciada');
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('es-CO').format(value);
  }

  function formatTime(value) {
    const total = Math.max(0, Math.floor(value));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function profileFor(id) {
    return allProfiles.find((item) => item.id === id) || allProfiles[0];
  }

  function artistFor(id) {
    return data.artists.find((item) => item.id === id) || data.artists[0];
  }

  function eventFor(id) {
    return data.events.find((item) => item.id === id) || data.events[0];
  }

  function playlistTracks(state) {
    return state.playlistArtistIds.map(artistFor);
  }

  function selectedArtist(state) {
    return artistFor(state.selectedArtistId);
  }

  function getProfileXp(state) {
    const profile = profileFor(state.profileId);
    const eventXp = state.checkedEventIds.reduce((sum, id) => sum + (eventFor(id)?.reward || 0), 0);
    const missionXp = state.completedMissionIds.reduce((sum, id) => {
      const mission = data.missions.find((item) => item.id === id);
      return sum + (mission ? mission.reward : 0);
    }, 0);
    return profile.baseXp + state.savedArtistIds.length * 120 + state.likedArtistIds.length * 40 + state.sharedTargets.length * 90 + state.playlistContributions * 150 + eventXp + missionXp;
  }

  function getProfileStreak(state) {
    const profile = profileFor(state.profileId);
    return profile.streak + Math.min(4, state.checkedEventIds.length) + Math.floor(state.sharedTargets.length / 2);
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
      default:
        value = 0;
    }
    return { value, done: value >= mission.threshold };
  }

  function syncMissions(nextState) {
    const newlyCompleted = [];
    data.missions.forEach((mission) => {
      const progress = missionProgress(nextState, mission);
      const already = nextState.completedMissionIds.includes(mission.id);
      if (progress.done && !already) {
        nextState.completedMissionIds.push(mission.id);
        newlyCompleted.push(mission);
      }
    });
    if (newlyCompleted.length) {
      showToast(`Mision completada: ${newlyCompleted[0].name}`);
    }
    return nextState;
  }

  function levelFromXp(xp) {
    return `Nivel ${String(Math.max(1, Math.floor(xp / 700))).padStart(2, '0')}`;
  }

  function showToast(message) {
    const toast = $('[data-toast]');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    $$('[data-live-time]').forEach((node) => { node.textContent = `${hours}:${minutes}`; });
  }

  function initClock() {
    updateClock();
    setInterval(updateClock, 15000);
  }

  function applyDevice(state) {
    const frame = $('[data-device-frame]');
    const shell = $('[data-device-shell]');
    if (!frame || !shell) return;
    frame.dataset.deviceFrame = state.device;
    shell.dataset.device = state.device;
    $$('[data-device-option]').forEach((button) => button.classList.toggle('is-active', button.dataset.deviceOption === state.device));
  }

  function applyContrast(state) {
    document.body.classList.toggle('high-contrast', !!state.settings.highContrast);
  }

  function changeDevice(device) {
    const state = getState();
    state.device = device;
    setState(state);
    render();
  }

  function openOverlay(node) {
    node?.classList.add('is-open');
    document.body.classList.add('overlay-open');
  }

  function closeOverlay(node) {
    node?.classList.remove('is-open');
    if (!$('.overlay.is-open')) document.body.classList.remove('overlay-open');
  }

  function openLogin() {
    selectedLoginId = getState().profileId;
    renderLoginCards();
    openOverlay($('[data-login-overlay]'));
  }

  function closeLogin() {
    if (!getState().loggedIn) return;
    closeOverlay($('[data-login-overlay]'));
  }

  function openSettings() {
    renderSettings();
    openOverlay($('[data-settings-overlay]'));
  }

  function openTeam() {
    renderTeamModal();
    openOverlay($('[data-team-overlay]'));
  }

  function openScanner(eventId) {
    scannerEventId = eventId;
    renderScanner();
    openOverlay($('[data-scanner-overlay]'));
  }

  function closeAllOverlays() {
    $$('.overlay').forEach((item) => item.classList.remove('is-open'));
    document.body.classList.remove('overlay-open');
  }

  function loginAs(profileId) {
    const state = getState();
    state.profileId = profileId;
    state.loggedIn = true;
    setState(syncMissions(state));
    closeOverlay($('[data-login-overlay]'));
    render();
    showToast(`Sesion iniciada: ${profileFor(profileId).name}`);
  }

  function logout() {
    stopAudio(true);
    const state = getState();
    state.loggedIn = false;
    setState(state);
    closeAllOverlays();
    render();
    openLogin();
    showToast('Sesion cerrada');
  }

  function stopAudio(reset = false) {
    audio.pause();
    clearInterval(playerTick);
    if (reset) {
      audio.currentTime = 0;
    }
    updatePlayerButtons();
  }

  function loadAudioForArtist(artist) {
    if (audio.dataset.artistId !== artist.id) {
      audio.src = artist.audio;
      audio.dataset.artistId = artist.id;
    }
  }

  function updatePlayerButtons() {
    const playing = !audio.paused;
    const label = playing ? 'Pausar' : 'Reproducir';
    $('[data-player-toggle]') && ($('[data-player-toggle]').textContent = label);
    $('[data-player-like]') && ($('[data-player-like]').textContent = 'Like');
  }

  function bindAudioTick() {
    clearInterval(playerTick);
    playerTick = setInterval(() => {
      const current = audio.currentTime || 0;
      $('[data-player-range]') && ($('[data-player-range]').value = String(current));
      $('[data-player-current]') && ($('[data-player-current]').textContent = formatTime(current));
      if (getState().settings.preview30 && current >= 30) {
        stopAudio();
      }
    }, 200);
  }

  audio.addEventListener('loadedmetadata', () => {
    const total = Math.min(30, Math.floor(audio.duration || 30));
    const range = $('[data-player-range]');
    if (range) range.max = String(total || 30);
    $('[data-player-total]') && ($('[data-player-total]').textContent = formatTime(total || 30));
    $('[data-player-duration]') && ($('[data-player-duration]').textContent = formatTime(total || 30));
  });

  audio.addEventListener('ended', () => {
    stopAudio(true);
  });

  function playCurrentArtist() {
    const state = getState();
    const artist = selectedArtist(state);
    loadAudioForArtist(artist);
    audio.currentTime = 0;
    audio.play().then(() => {
      bindAudioTick();
      updatePlayerButtons();
    }).catch(() => {
      showToast('Tu navegador bloqueo autoplay. Usa Reproducir de nuevo.');
    });
  }

  function togglePlay() {
    const artist = selectedArtist(getState());
    loadAudioForArtist(artist);
    if (audio.paused) {
      audio.play().then(() => {
        bindAudioTick();
        updatePlayerButtons();
      }).catch(() => showToast('No se pudo iniciar el audio.'));
    } else {
      stopAudio();
    }
  }

  function selectArtist(artistId, shouldPlay = false) {
    const state = getState();
    state.selectedArtistId = artistId;
    setState(state);
    render();
    if (shouldPlay || state.settings.autoplay) {
      playCurrentArtist();
    } else {
      stopAudio(true);
      const artist = selectedArtist(state);
      loadAudioForArtist(artist);
      $('[data-player-current]') && ($('[data-player-current]').textContent = '0:00');
      $('[data-player-range]') && ($('[data-player-range]').value = '0');
    }
  }

  function cycleArtist(direction = 1) {
    const state = getState();
    const idx = data.artists.findIndex((item) => item.id === state.selectedArtistId);
    const next = (idx + direction + data.artists.length) % data.artists.length;
    selectArtist(data.artists[next].id, !audio.paused);
  }

  function toggleSave(artistId) {
    const state = getState();
    const set = new Set(state.savedArtistIds);
    if (set.has(artistId)) {
      set.delete(artistId);
      showToast('Hallazgo removido del tablero');
    } else {
      set.add(artistId);
      showToast('Guardado en tu tablero');
    }
    state.savedArtistIds = Array.from(set);
    setState(syncMissions(state));
    render();
  }

  function toggleLike(artistId) {
    const state = getState();
    const set = new Set(state.likedArtistIds);
    if (set.has(artistId)) {
      set.delete(artistId);
      showToast('Like removido');
    } else {
      set.add(artistId);
      showToast('Like agregado');
    }
    state.likedArtistIds = Array.from(set);
    setState(syncMissions(state));
    render();
  }

  function shareTo(targetId) {
    const state = getState();
    if (state.sharedTargets.includes(targetId)) {
      showToast('Ese canal ya fue usado en esta demo');
      return;
    }
    state.sharedTargets = [...state.sharedTargets, targetId];
    setState(syncMissions(state));
    render();
    const target = data.shareTargets.find((item) => item.id === targetId);
    showToast(`Capsula compartida en ${target?.name || targetId}`);
  }

  function addSelectedToPlaylist() {
    const state = getState();
    if (!state.playlistArtistIds.includes(state.selectedArtistId)) {
      state.playlistArtistIds.push(state.selectedArtistId);
      state.playlistContributions += 1;
      setState(syncMissions(state));
      render();
      showToast('Artista agregado a la playlist local');
      return;
    }
    showToast('Ese artista ya estaba en la playlist');
  }

  function checkIn(eventId) {
    const state = getState();
    if (!state.checkedEventIds.includes(eventId)) {
      state.checkedEventIds = [...state.checkedEventIds, eventId];
      setState(syncMissions(state));
      render();
      showToast(`Check-in exitoso: +${eventFor(eventId).reward} XP`);
    } else {
      showToast('Ese sello ya fue reclamado');
    }
    closeOverlay($('[data-scanner-overlay]'));
  }

  function setView(view) {
    const state = getState();
    state.view = view;
    setState(state);
    renderViewOnly(view);
  }

  function renderViewOnly(view) {
    $$('[data-view]').forEach((node) => node.classList.toggle('is-active', node.dataset.view === view));
    $$('[data-view-target]').forEach((button) => button.classList.toggle('is-active', button.dataset.viewTarget === view));
    $$('.nav-link').forEach((button) => button.classList.toggle('is-active', button.dataset.viewTarget === view));
    $$('.bottom-nav button').forEach((button) => button.classList.toggle('is-active', button.dataset.viewTarget === view));
  }

  function renderShellProfile() {
    const state = getState();
    const profile = profileFor(state.profileId);
    const xp = getProfileXp(state);
    const streak = getProfileStreak(state);
    const level = levelFromXp(xp);
    $$('[data-profile-avatar]').forEach((img) => {
      img.src = profile.avatar;
      img.alt = profile.name;
    });
    $$('[data-profile-name]').forEach((node) => { node.textContent = profile.name; });
    $$('[data-profile-role]').forEach((node) => { node.textContent = profile.role; });
    $$('[data-profile-xp]').forEach((node) => { node.textContent = formatNumber(xp); });
    $$('[data-profile-streak]').forEach((node) => { node.textContent = String(streak); });
    $$('[data-profile-level]').forEach((node) => { node.textContent = level; });
  }

  function renderHero() {
    const state = getState();
    const artist = selectedArtist(state);
    const saved = state.savedArtistIds.includes(artist.id);
    const liked = state.likedArtistIds.includes(artist.id);
    const mount = $('[data-featured-card]');
    if (!mount) return;
    mount.style.setProperty('--hero-gradient', artist.gradient);
    mount.innerHTML = `
      <div class="hero-layout">
        <div class="hero-copy">
          <p class="eyebrow">Capsula protagonista</p>
          <h2>${artist.name}</h2>
          <p><strong>${artist.track}</strong> · ${artist.genre} · ${artist.city}</p>
          <p>${artist.story}</p>
          <div class="pill-row">
            <span class="mini-pill">${artist.match}% match</span>
            <span class="mini-pill">${artist.listeners} oyentes</span>
            <span class="mini-pill">${artist.vibe}</span>
          </div>
          <div class="card-actions">
            <button class="primary-btn" type="button" data-hero-play>Escuchar</button>
            <button class="soft-btn" type="button" data-hero-save>${saved ? 'Guardado' : 'Guardar'}</button>
            <button class="soft-btn" type="button" data-hero-like>${liked ? 'Te gusta' : 'Like'}</button>
          </div>
        </div>
        <div class="hero-visual">
          <img class="hero-cover" src="${artist.cover}" alt="${artist.name}">
          <div class="pill-row">
            ${artist.tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join('')}
          </div>
        </div>
      </div>`;
    $('[data-hero-play]')?.addEventListener('click', () => { setView('player'); playCurrentArtist(); });
    $('[data-hero-save]')?.addEventListener('click', () => toggleSave(artist.id));
    $('[data-hero-like]')?.addEventListener('click', () => toggleLike(artist.id));
  }

  function renderCapsuleFeed() {
    const state = getState();
    const mount = $('[data-capsule-feed]');
    if (!mount) return;
    mount.innerHTML = data.artists.map((artist) => {
      const isSelected = state.selectedArtistId === artist.id;
      const isSaved = state.savedArtistIds.includes(artist.id);
      return `
        <article class="panel-card capsule-card stack-item ${isSelected ? 'is-active' : ''}" data-select-artist="${artist.id}">
          <img class="capsule-cover" src="${artist.cover}" alt="${artist.name}">
          <div class="capsule-copy">
            <h3>${artist.track}</h3>
            <p>${artist.name} · ${artist.city} · ${artist.genre}</p>
            <p>${artist.story}</p>
          </div>
          <div class="pill-row">
            <span class="mini-pill">${artist.match}% match</span>
            <span class="mini-pill">${artist.vibe}</span>
          </div>
          <div class="card-actions">
            <button class="soft-btn small-btn" type="button" data-card-play="${artist.id}">Play</button>
            <button class="soft-btn small-btn" type="button" data-card-save="${artist.id}">${isSaved ? 'Guardado' : 'Guardar'}</button>
          </div>
        </article>`;
    }).join('');

    $$('[data-select-artist]').forEach((card) => card.addEventListener('click', () => selectArtist(card.dataset.selectArtist)));
    $$('[data-card-play]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      selectArtist(button.dataset.cardPlay, true);
      setView('player');
    }));
    $$('[data-card-save]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSave(button.dataset.cardSave);
    }));
  }

  function renderSavedBoard() {
    const state = getState();
    const mount = $('[data-saved-board]');
    const count = $('[data-saved-count]');
    if (count) count.textContent = `${state.savedArtistIds.length} guardados`;
    if (!mount) return;
    if (!state.savedArtistIds.length) {
      mount.innerHTML = '<div class="empty-state">Todavia no has guardado artistas. Usa las cápsulas para llenar este tablero.</div>';
      return;
    }
    mount.innerHTML = state.savedArtistIds.map((artistId) => {
      const artist = artistFor(artistId);
      return `
        <button class="stack-item ${state.selectedArtistId === artist.id ? 'is-active' : ''}" type="button" data-open-saved="${artist.id}">
          <img src="${artist.cover}" alt="${artist.name}">
          <div>
            <strong>${artist.track}</strong>
            <span>${artist.name} · ${artist.city}</span>
          </div>
        </button>`;
    }).join('');
    $$('[data-open-saved]').forEach((button) => button.addEventListener('click', () => selectArtist(button.dataset.openSaved)));
  }

  function renderDiscoverTags() {
    const state = getState();
    const artist = selectedArtist(state);
    const mount = $('[data-discover-tags]');
    if (!mount) return;
    const tags = [...new Set([...artist.tags, artist.city.toLowerCase(), artist.region.toLowerCase(), artist.genre.toLowerCase()])];
    mount.innerHTML = tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join('');
  }

  function renderPlayer() {
    const state = getState();
    const artist = selectedArtist(state);
    $('[data-player-cover]').src = artist.cover;
    $('[data-player-cover]').alt = artist.name;
    $('[data-player-track]').textContent = artist.track;
    $('[data-player-name]').textContent = `${artist.name} · ${artist.genre}`;
    $('[data-player-story]').textContent = artist.story;
    $('[data-player-match]').textContent = `${artist.match}% match`;
    $('[data-player-duration]').textContent = artist.duration;
    $('[data-player-total]').textContent = artist.duration;
    $('[data-player-current]').textContent = formatTime(audio.dataset.artistId === artist.id ? audio.currentTime : 0);
    $('[data-player-range]').value = audio.dataset.artistId === artist.id ? String(audio.currentTime) : '0';
    $('[data-player-range]').max = '30';
    $('[data-toggle-preview]').textContent = state.settings.preview30 ? 'Modo 30s' : 'Full demo';
    $('[data-toggle-preview]').classList.toggle('is-active', state.settings.preview30);

    const queueMount = $('[data-player-queue]');
    queueMount.innerHTML = data.artists.map((item) => `
      <button class="stack-item ${item.id === artist.id ? 'is-active' : ''}" type="button" data-queue-select="${item.id}">
        <img src="${item.cover}" alt="${item.name}">
        <div>
          <strong>${item.track}</strong>
          <span>${item.name} · ${item.city}</span>
        </div>
      </button>`).join('');
    $$('[data-queue-select]').forEach((button) => button.addEventListener('click', () => selectArtist(button.dataset.queueSelect, !audio.paused)));

    const insightMount = $('[data-player-insights]');
    insightMount.innerHTML = [
      `Barrio / escena: ${artist.city} · ${artist.region}`,
      `Capsula: ${artist.capsule}`,
      `Etiquetas: ${artist.tags.join(' · ')}`
    ].map((text) => `<div class="insight-row"><p>${text}</p></div>`).join('');

    updatePlayerButtons();
  }

  function renderEvents() {
    const state = getState();
    const activeEvent = eventFor(state.activeEventId);
    const map = $('[data-event-map]');
    map.innerHTML = data.events.map((eventItem, index) => `
      <button class="map-pin ${eventItem.id === activeEvent.id ? 'is-active' : ''}" type="button" data-event-select="${eventItem.id}" style="left:${eventItem.x}%; top:${eventItem.y}%; background:${['linear-gradient(135deg,#ff6b35,#ff8c42)','linear-gradient(135deg,#9d7bf5,#7dd3fc)','linear-gradient(135deg,#22c55e,#14b8a6)'][index % 3]}">
        <span>${index + 1}</span>
      </button>`).join('');
    $$('[data-event-select]').forEach((button) => button.addEventListener('click', () => {
      const next = getState();
      next.activeEventId = button.dataset.eventSelect;
      setState(next);
      renderEvents();
    }));

    const preview = $('[data-event-preview]');
    const claimed = state.checkedEventIds.includes(activeEvent.id);
    preview.className = 'panel-card event-preview';
    preview.innerHTML = `
      <div class="panel-head">
        <strong>${activeEvent.name}</strong>
        <span class="mini-pill">+${activeEvent.reward} XP</span>
      </div>
      <img class="event-poster" src="${activeEvent.poster}" alt="${activeEvent.name}">
      <p>${activeEvent.summary}</p>
      <div class="event-meta">
        <span class="mini-pill">${activeEvent.place}</span>
        <span class="mini-pill">${activeEvent.time}</span>
      </div>
      <div class="card-actions">
        <button class="primary-btn" type="button" data-open-scanner-btn>${claimed ? 'Ver sello' : 'Abrir QR'}</button>
        <button class="soft-btn" type="button" data-open-qr-direct>qr-checkin</button>
      </div>`;
    $('[data-open-scanner-btn]')?.addEventListener('click', () => openScanner(activeEvent.id));
    $('[data-open-qr-direct]')?.addEventListener('click', () => window.open(`qr-checkin.html?event=${activeEvent.id}`, '_blank', 'noopener'));

    const list = $('[data-events-list]');
    const count = $('[data-event-count]');
    if (count) count.textContent = `${data.events.length} eventos`;
    list.innerHTML = data.events.map((item) => {
      const earned = state.checkedEventIds.includes(item.id);
      return `
        <article class="event-card ${earned ? 'is-complete' : ''}">
          <div class="panel-head">
            <strong>${item.name}</strong>
            <span class="mini-pill">${earned ? 'Sello obtenido' : '+' + item.reward + ' XP'}</span>
          </div>
          <p>${item.summary}</p>
          <div class="event-meta">
            <span class="mini-pill">${item.place}</span>
            <span class="mini-pill">${item.time}</span>
          </div>
          <div class="card-actions">
            <button class="soft-btn small-btn" type="button" data-jump-event="${item.id}">Ver</button>
            <button class="soft-btn small-btn" type="button" data-event-checkin="${item.id}">${earned ? 'Reclamado' : 'Check-in'}</button>
          </div>
        </article>`;
    }).join('');
    $$('[data-jump-event]').forEach((button) => button.addEventListener('click', () => {
      const next = getState();
      next.activeEventId = button.dataset.jumpEvent;
      setState(next);
      renderEvents();
    }));
    $$('[data-event-checkin]').forEach((button) => button.addEventListener('click', () => openScanner(button.dataset.eventCheckin)));
  }

  function renderPlaylistCard() {
    const state = getState();
    const mount = $('[data-playlist-card]');
    const tracks = playlistTracks(state);
    mount.innerHTML = `
      <div class="playlist-hero">
        <div class="panel-head">
          <strong>${data.playlists[0].name}</strong>
          <span class="mini-pill">${tracks.length} canciones</span>
        </div>
        <p>${data.playlists[0].subtitle}. Descubrir → guardar → compartir → aportar.</p>
        <div class="pill-row">
          <span class="mini-pill">${data.playlists[0].followers + state.playlistContributions * 3} seguidores</span>
          <span class="mini-pill">${state.playlistContributions} aportes</span>
        </div>
        <div class="playlist-tracks">
          ${tracks.map((artist, idx) => `<div class="track-row"><span>${idx + 1}. ${artist.track}</span><span>${artist.name}</span></div>`).join('')}
        </div>
      </div>`;
  }

  function renderShares() {
    const state = getState();
    const mount = $('[data-share-grid]');
    mount.innerHTML = data.shareTargets.map((target) => `
      <button class="share-card ${state.sharedTargets.includes(target.id) ? 'is-active' : ''}" type="button" data-share-target="${target.id}">
        <span class="share-icon">${target.icon}</span>
        <strong>${target.name}</strong>
        <span>${state.sharedTargets.includes(target.id) ? 'Compartido' : 'Listo para demo'}</span>
      </button>`).join('');
    $$('[data-share-target]').forEach((button) => button.addEventListener('click', () => shareTo(button.dataset.shareTarget)));
  }

  function renderLeaderboards() {
    const state = getState();
    const userMount = $('[data-user-leaderboard]');
    const artistMount = $('[data-artist-leaderboard]');
    const users = allProfiles.map((profile) => ({
      profile,
      xp: profile.id === state.profileId ? getProfileXp(state) : profile.baseXp
    })).sort((a, b) => b.xp - a.xp).slice(0, 5);
    userMount.innerHTML = users.map((entry, idx) => `
      <div class="leaderboard-card">
        <img src="${entry.profile.avatar}" alt="${entry.profile.name}">
        <div>
          <strong>${entry.profile.name}</strong>
          <span>${entry.profile.role}</span>
        </div>
        <div>
          <strong>#${idx + 1}</strong>
          <span>${formatNumber(entry.xp)} XP</span>
        </div>
      </div>`).join('');

    const artists = data.artists.map((artist) => ({
      artist,
      score: artist.match + (state.savedArtistIds.includes(artist.id) ? 8 : 0) + (state.likedArtistIds.includes(artist.id) ? 5 : 0) + (state.playlistArtistIds.includes(artist.id) ? 6 : 0)
    })).sort((a, b) => b.score - a.score).slice(0, 5);
    artistMount.innerHTML = artists.map((entry, idx) => `
      <div class="leaderboard-card">
        <img src="${entry.artist.cover}" alt="${entry.artist.name}">
        <div>
          <strong>${entry.artist.name}</strong>
          <span>${entry.artist.genre}</span>
        </div>
        <div>
          <strong>#${idx + 1}</strong>
          <span>${entry.score} pts</span>
        </div>
      </div>`).join('');
  }

  function renderProfile() {
    const state = getState();
    const profile = profileFor(state.profileId);
    const xp = getProfileXp(state);
    const streak = getProfileStreak(state);
    const overview = $('[data-profile-overview]');
    overview.className = 'panel-card profile-overview';
    overview.innerHTML = `
      <div class="summary-head">
        <img src="${profile.avatar}" alt="${profile.name}">
        <div>
          <p class="eyebrow">Perfil activo</p>
          <h2>${profile.name}</h2>
          <p>${profile.role} · ${profile.city}</p>
        </div>
      </div>
      <p>${profile.bio}</p>
      <div class="profile-stats">
        <div class="stat-box"><span class="eyebrow">XP</span><strong>${formatNumber(xp)}</strong></div>
        <div class="stat-box"><span class="eyebrow">Racha</span><strong>${streak}</strong></div>
        <div class="stat-box"><span class="eyebrow">Guardados</span><strong>${state.savedArtistIds.length}</strong></div>
        <div class="stat-box"><span class="eyebrow">Shares</span><strong>${state.sharedTargets.length}</strong></div>
      </div>`;

    const badges = $('[data-badge-list]');
    badges.innerHTML = profile.badges.map((badge) => `<span class="badge-pill">${badge}</span>`).join('');

    const favorites = $('[data-favorite-list]');
    const favoriteArtists = state.savedArtistIds.length ? state.savedArtistIds.map(artistFor) : data.artists.slice(0, 2);
    favorites.innerHTML = favoriteArtists.map((artist) => `
      <button class="favorite-card" type="button" data-favorite-open="${artist.id}">
        <img src="${artist.cover}" alt="${artist.name}">
        <div>
          <strong>${artist.track}</strong>
          <span>${artist.name} · ${artist.city}</span>
        </div>
      </button>`).join('');
    $$('[data-favorite-open]').forEach((button) => button.addEventListener('click', () => {
      selectArtist(button.dataset.favoriteOpen);
      setView('player');
    }));

    renderStamps('[data-stamps-grid-main]');
  }

  function renderNowPlaying() {
    const state = getState();
    const artist = selectedArtist(state);
    const mount = $('[data-now-playing-card]');
    if (!mount) return;
    mount.className = 'panel-card now-playing-card';
    mount.innerHTML = `
      <p class="eyebrow">Ahora sonando</p>
      <div class="now-playing-media">
        <img src="${artist.cover}" alt="${artist.name}">
        <div>
          <h3>${artist.track}</h3>
          <p>${artist.name} · ${artist.genre}</p>
        </div>
      </div>
      <div class="progress"><span style="width:${Math.min(100, (audio.currentTime || 0) / 30 * 100)}%"></span></div>
      <div class="pill-row">
        <span class="mini-pill">${audio.paused ? 'Pausado' : 'Reproduciendo'}</span>
        <span class="mini-pill">${artist.duration}</span>
      </div>`;
  }

  function renderMissions() {
    const state = getState();
    const mount = $('[data-missions-list]');
    if (!mount) return;
    mount.innerHTML = data.missions.map((mission) => {
      const progress = missionProgress(state, mission);
      return `
        <article class="mission-card ${progress.done ? 'is-complete' : ''}">
          <div class="panel-head">
            <strong>${mission.name}</strong>
            <span class="mini-pill">+${mission.reward} XP</span>
          </div>
          <p>${mission.description}</p>
          <div class="mission-meta">
            <span class="mini-pill">${progress.value}/${mission.threshold}</span>
            <span class="mini-pill">${progress.done ? 'Completada' : 'En progreso'}</span>
          </div>
          <div class="progress"><span style="width:${Math.min(100, progress.value / mission.threshold * 100)}%"></span></div>
        </article>`;
    }).join('');
  }

  function renderStamps(selector) {
    const state = getState();
    const mount = $(selector);
    if (!mount) return;
    mount.innerHTML = data.events.map((item) => {
      const earned = state.checkedEventIds.includes(item.id);
      return `
        <div class="stamp-card ${earned ? 'is-earned' : ''}">
          <div>
            <strong>${item.stamp}</strong>
            <span>${earned ? 'Obtenido' : 'Pendiente'}</span>
          </div>
          <span class="stamp-pill">${earned ? '✓' : '+' + item.reward}</span>
        </div>`;
    }).join('');
  }

  function renderLoginCards() {
    const teamMount = $('[data-team-profiles]');
    const roleMount = $('[data-role-profiles]');
    const renderCards = (items, mount) => {
      mount.innerHTML = items.map((profile) => `
        <button class="profile-card ${selectedLoginId === profile.id ? 'is-active' : ''}" type="button" data-login-select="${profile.id}">
          <img src="${profile.avatar}" alt="${profile.name}">
          <strong>${profile.name}</strong>
          <span>${profile.role}</span>
          <small>${profile.code}</small>
        </button>`).join('');
    };
    renderCards(data.teamMembers, teamMount);
    renderCards(data.demoRoles, roleMount);
    $$('[data-login-select]').forEach((button) => button.addEventListener('click', () => {
      selectedLoginId = button.dataset.loginSelect;
      loginAs(selectedLoginId);
    }));
  }

  function renderSettings() {
    const state = getState();
    const mount = $('[data-settings-content]');
    const profile = profileFor(state.profileId);
    mount.innerHTML = `
      <article class="settings-card">
        <div class="panel-head">
          <strong>Cuenta activa</strong>
          <span class="mini-pill">${profile.role}</span>
        </div>
        <p class="settings-copy">${profile.name} · ${profile.handle || profile.role} · ${profile.city}</p>
      </article>
      ${data.settingsOptions.map((section) => `
        <article class="settings-card">
          <div class="panel-head">
            <strong>${section.section}</strong>
            <span class="mini-pill">demo funcional</span>
          </div>
          ${section.items.map((item) => item.type === 'toggle' ? `
            <div class="settings-item">
              <div>
                <strong>${item.label}</strong>
              </div>
              <button class="switch ${state.settings[item.key] ? 'is-on' : ''}" type="button" data-setting-toggle="${item.key}" aria-label="${item.label}"></button>
            </div>` : `
            <div class="settings-item">
              <div>
                <strong>${item.label}</strong>
              </div>
              <select data-setting-select="${item.key}">
                ${item.options.map((option) => `<option ${state.settings[item.key] === option ? 'selected' : ''}>${option}</option>`).join('')}
              </select>
            </div>`).join('')}
        </article>`).join('')}`;

    $$('[data-setting-toggle]').forEach((button) => button.addEventListener('click', () => {
      const next = getState();
      const key = button.dataset.settingToggle;
      next.settings[key] = !next.settings[key];
      setState(next);
      applyContrast(next);
      render();
      openSettings();
    }));
    $$('[data-setting-select]').forEach((select) => select.addEventListener('change', () => {
      const next = getState();
      next.settings[select.dataset.settingSelect] = select.value;
      setState(next);
      render();
      openSettings();
      showToast('Ajuste actualizado');
    }));
  }

  function renderTeamModal() {
    const mount = $('[data-team-modal-grid]');
    mount.innerHTML = data.teamMembers.map((member) => `
      <article class="team-modal-card">
        <img src="${member.avatar}" alt="${member.name}">
        <strong>${member.name}</strong>
        <span>${member.role}</span>
        <small>${member.code}</small>
        <p>${member.bio}</p>
      </article>`).join('');
  }

  function renderScanner() {
    const item = eventFor(scannerEventId);
    $('[data-scanner-title]').textContent = item.name;
    $('[data-scanner-poster]').src = item.poster;
    $('[data-scanner-poster]').alt = item.name;
    $('[data-scanner-qr]').src = item.qr;
    $('[data-scanner-qr]').alt = `QR ${item.name}`;
    $('[data-scanner-copy]').textContent = `${item.place} · ${item.time} · +${item.reward} XP`;
    const link = $('[data-open-qr-page]');
    link.href = `qr-checkin.html?event=${item.id}`;
  }

  function bindGlobalEvents() {
    $$('[data-device-option]').forEach((button) => button.addEventListener('click', () => changeDevice(button.dataset.deviceOption)));
    $$('[data-view-target]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.viewTarget)));
    $('[data-open-login]')?.addEventListener('click', openLogin);
    $('[data-reset-state]')?.addEventListener('click', resetState);
    $('[data-open-settings]')?.addEventListener('click', openSettings);
    $('[data-open-team]')?.addEventListener('click', openTeam);
    $('[data-close-login]')?.addEventListener('click', closeLogin);
    $('[data-close-settings]')?.addEventListener('click', () => closeOverlay($('[data-settings-overlay]')));
    $('[data-close-team]')?.addEventListener('click', () => closeOverlay($('[data-team-overlay]')));
    $('[data-close-scanner]')?.addEventListener('click', () => closeOverlay($('[data-scanner-overlay]')));
    $('[data-logout]')?.addEventListener('click', logout);
    $('[data-go-login-page]')?.addEventListener('click', () => window.open('login.html', '_blank', 'noopener'));
    $('[data-cycle-capsules]')?.addEventListener('click', () => cycleArtist(1));
    $('[data-player-toggle]')?.addEventListener('click', togglePlay);
    $('[data-player-prev]')?.addEventListener('click', () => cycleArtist(-1));
    $('[data-player-next]')?.addEventListener('click', () => cycleArtist(1));
    $('[data-player-save]')?.addEventListener('click', () => toggleSave(getState().selectedArtistId));
    $('[data-player-like]')?.addEventListener('click', () => toggleLike(getState().selectedArtistId));
    $('[data-player-share]')?.addEventListener('click', () => { setView('community'); showToast('Selecciona un canal para compartir'); });
    $('[data-toggle-preview]')?.addEventListener('click', () => {
      const next = getState();
      next.settings.preview30 = !next.settings.preview30;
      setState(next);
      render();
      showToast(next.settings.preview30 ? 'Modo cápsula activado' : 'Modo full demo activado');
    });
    $('[data-player-range]')?.addEventListener('input', (event) => {
      const value = Number(event.target.value || 0);
      if (!Number.isNaN(value)) {
        audio.currentTime = value;
        $('[data-player-current]').textContent = formatTime(value);
      }
    });
    $('[data-add-playlist]')?.addEventListener('click', addSelectedToPlaylist);
    $('[data-simulate-checkin]')?.addEventListener('click', () => checkIn(scannerEventId));
    $$('.overlay').forEach((overlay) => overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        if (overlay.matches('[data-login-overlay]') && !getState().loggedIn) return;
        closeOverlay(overlay);
      }
    }));
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-open-login], [data-open-team], [data-open-settings]');
      if (!trigger) return;
      if (trigger.matches('[data-open-login]')) openLogin();
      if (trigger.matches('[data-open-team]')) openTeam();
      if (trigger.matches('[data-open-settings]')) openSettings();
    });
  }

  function render() {
    const state = getState();
    applyDevice(state);
    applyContrast(state);
    renderViewOnly(state.view);
    renderShellProfile();
    renderHero();
    renderCapsuleFeed();
    renderSavedBoard();
    renderDiscoverTags();
    renderPlayer();
    renderEvents();
    renderPlaylistCard();
    renderShares();
    renderLeaderboards();
    renderProfile();
    renderNowPlaying();
    renderMissions();
    renderStamps('[data-stamps-grid-rail]');
    if (!state.loggedIn) {
      openLogin();
    }
  }

  function init() {
    initClock();
    bindGlobalEvents();
    render();
  }

  init();
})();
