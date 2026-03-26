    
      import {
        $, $$,
        artistFor,
        clearStoredState,
        createFreshState,
        data,
        eventFor,
        getRoleStudio,
        getState,
        profileFor,
        selectedArtist,
        setState,
        syncMissions
      } from './state.js';
      import {
        applyContrast,
        applyDevice,
        applyImmersive,
        applyTheme,
        burstNotesFrom,
        closeAllOverlays,
        closeOverlay,
        initClock,
        openOverlay,
        renderViewOnly,
        scrollAppToTop,
        showToast
      } from './ui.js';
      import {
        configureAudio,
        getAudioSnapshot,
        loadAudioForArtist,
        playArtist,
        seekAudio,
        stopAudio,
        toggleArtistPlayback
      } from './audio.js';
      import {
        buildDraftReview,
        clearDraft,
        discardVoiceDraft,
        resetReviewDrafts,
        setReviewUpdateCallback,
        startVoiceRecording,
        stopVoiceRecording,
        updateDraft
      } from './reviews.js';
      import {
        renderAll,
        renderLiveAudioState,
        renderLoginCards,
        renderNowPlaying,
        renderPlayerFeedback,
        renderScanner,
        renderSettings,
        renderTeamModal
      } from './render.js';
    
      function renderApp(state = getState()) {
        applyDevice(state);
        applyImmersive(state);
        applyContrast(state);
        applyTheme(state);
        renderViewOnly(state.view);
        renderAll();
        if (!state.loggedIn) {
          openLogin();
        }
      }
    
      function commitState(nextState, toastMessage = '') {
        const { state: syncedState, newlyCompleted } = syncMissions(nextState);
        const storedState = setState(syncedState);
        renderApp(storedState);
        if (toastMessage || newlyCompleted.length) {
          const missionLabel = newlyCompleted.length ? ` · Misión: ${newlyCompleted[0].name}` : '';
          showToast(`${toastMessage || 'Estado actualizado'}${missionLabel}`);
        }
        return storedState;
      }
    
      function openLogin() {
        renderLoginCards(getState());
        openOverlay($('[data-login-overlay]'));
      }
    
      function closeLogin() {
        if (!getState().loggedIn) return;
        closeOverlay($('[data-login-overlay]'));
      }
    
      function openSettings() {
        renderSettings(getState());
        openOverlay($('[data-settings-overlay]'));
      }
    
      function openTeam() {
        renderTeamModal();
        openOverlay($('[data-team-overlay]'));
      }
    
      function openScanner(eventId) {
        renderScanner(eventId);
        openOverlay($('[data-scanner-overlay]'));
      }
    
      function setView(view) {
        const state = getState();
        state.view = view;
        setState(state);
        renderViewOnly(view);
      }
    
      function goHome(triggerNode = null) {
        const state = getState();
        state.view = 'discover';
        setState(state);
        closeAllOverlays();
        renderApp(state);
        scrollAppToTop();
        burstNotesFrom(triggerNode);
      }
    
      async function selectArtist(artistId, shouldPlay = false) {
        const state = getState();
        state.selectedArtistId = artistId;
        setState(state);
        renderApp(state);
        const artist = selectedArtist(state);
        if (shouldPlay || state.settings.autoplay) {
          const started = await playArtist(artist, { reset: true });
          if (!started) {
            showToast('Tu navegador bloqueó el audio. Intenta de nuevo.');
          }
          return;
        }
        stopAudio(true);
        loadAudioForArtist(artist);
        renderLiveAudioState();
      }
    
      async function cycleArtist(direction = 1) {
        const state = getState();
        const currentIndex = data.artists.findIndex((artist) => artist.id === state.selectedArtistId);
        const nextIndex = (currentIndex + direction + data.artists.length) % data.artists.length;
        const keepPlaying = getAudioSnapshot(state.selectedArtistId).isPlaying;
        await selectArtist(data.artists[nextIndex].id, keepPlaying);
      }
    
      function toggleSave(artistId) {
        const state = getState();
        const set = new Set(state.savedArtistIds);
        let toast = 'Guardado en tu tablero';
        if (set.has(artistId)) {
          set.delete(artistId);
          toast = 'Hallazgo removido del tablero';
        } else {
          set.add(artistId);
        }
        state.savedArtistIds = Array.from(set);
        commitState(state, toast);
      }
    
      function toggleLike(artistId) {
        const state = getState();
        const set = new Set(state.likedArtistIds);
        let toast = 'Like agregado';
        if (set.has(artistId)) {
          set.delete(artistId);
          toast = 'Like removido';
        } else {
          set.add(artistId);
        }
        state.likedArtistIds = Array.from(set);
        commitState(state, toast);
      }
    
      function shareTo(targetId) {
        const state = getState();
        if (state.sharedTargets.includes(targetId)) {
          showToast('Ese canal ya fue usado en esta demo');
          return;
        }
        state.sharedTargets = [...state.sharedTargets, targetId];
        const target = data.shareTargets.find((item) => item.id === targetId);
        commitState(state, `Capsula compartida en ${target?.name || targetId}`);
      }
    
      function addSelectedToPlaylist() {
        const state = getState();
        if (state.playlistArtistIds.includes(state.selectedArtistId)) {
          showToast('Ese artista ya estaba en la playlist');
          return;
        }
        state.playlistArtistIds.push(state.selectedArtistId);
        state.playlistContributions += 1;
        commitState(state, 'Artista agregado a la playlist local');
      }
    
      function checkIn(eventId) {
        const state = getState();
        if (state.checkedEventIds.includes(eventId)) {
          closeOverlay($('[data-scanner-overlay]'));
          showToast('Ese sello ya fue reclamado');
          return;
        }
        state.checkedEventIds = [...state.checkedEventIds, eventId];
        commitState(state, `Check-in exitoso: +${eventFor(eventId).reward} XP`);
        closeOverlay($('[data-scanner-overlay]'));
      }
    
      function loginAs(profileId) {
        const state = getState();
        state.profileId = profileId;
        state.loggedIn = true;
        setState(state);
        closeOverlay($('[data-login-overlay]'));
        renderApp(state);
        showToast(`Sesión iniciada: ${profileFor(profileId).name}`);
      }
    
      function logout() {
        stopAudio(true);
        const state = getState();
        state.loggedIn = false;
        setState(state);
        closeAllOverlays();
        renderApp(state);
        openLogin();
        showToast('Sesión cerrada');
      }
    
      function resetAppState() {
        stopAudio(true);
        resetReviewDrafts();
        clearStoredState();
        const freshState = createFreshState();
        setState(freshState);
        closeAllOverlays();
        renderApp(freshState);
        openLogin();
        showToast('Demo reiniciada');
      }
    
    
      function updateRoleStudioState(mutator, toastMessage = '') {
        const state = getState();
        const studio = getRoleStudio(state);
        mutator(state, studio);
        state.roleStudio = studio;
        return commitState(state, toastMessage);
      }
    
      function formatFileSize(bytes) {
        const value = Math.max(0, Number(bytes || 0));
        if (!value) return '0 KB';
        if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
        return `${Math.max(1, Math.round(value / 1024))} KB`;
      }
    
      function guessTrackTitle(fileName = '') {
        const cleaned = String(fileName || '')
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!cleaned) return 'Nueva pista';
        return cleaned.split(' ').map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1)).join(' ');
      }
    
      function handleArtistUpload(file) {
        if (!file) return;
        const profile = profileFor(getState().profileId);
        if (profile.roleKey !== 'artist') {
          showToast('Esta acción es exclusiva del rol artista');
          return;
        }
        const title = guessTrackTitle(file.name);
        updateRoleStudioState((state, studio) => {
          studio.artistUploads.unshift({
            id: `upload-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            title,
            fileName: file.name,
            sizeLabel: formatFileSize(file.size),
            status: 'Publicado',
            createdAt: new Date().toISOString()
          });
          studio.artistUploads = studio.artistUploads.slice(0, 12);
        }, `Música subida: ${title}`);
      }
    
      function ambassadorContactArtist(artistId) {
        const artist = artistFor(artistId);
        const profile = profileFor(getState().profileId);
        if (profile.roleKey !== 'ambassador') {
          showToast('Esta acción es exclusiva del rol embajador');
          return;
        }
        const studio = getRoleStudio(getState());
        if (studio.ambassadorContacts.some((entry) => entry.artistId === artistId)) {
          showToast('Ese artista ya fue contactado');
          return;
        }
        updateRoleStudioState((state, nextStudio) => {
          nextStudio.ambassadorContacts.unshift({ artistId, createdAt: new Date().toISOString() });
        }, `Contacto enviado a ${artist.name}`);
      }
    
      function ambassadorHighlightArtist(artistId) {
        const artist = artistFor(artistId);
        const profile = profileFor(getState().profileId);
        if (profile.roleKey !== 'ambassador') {
          showToast('Esta acción es exclusiva del rol embajador');
          return;
        }
        const studio = getRoleStudio(getState());
        if (studio.ambassadorHighlights.some((entry) => entry.artistId === artistId)) {
          showToast('La difusión ya está activa para ese artista');
          return;
        }
        updateRoleStudioState((state, nextStudio) => {
          nextStudio.ambassadorHighlights.unshift({ artistId, createdAt: new Date().toISOString() });
        }, `Difusión activada para ${artist.name}`);
      }
    
      function markEventOperation(eventId, key) {
        const eventItem = eventFor(eventId);
        const profile = profileFor(getState().profileId);
        if (profile.roleKey !== 'manager') {
          showToast('Esta acción es exclusiva del gestor de eventos');
          return;
        }
        const studio = getRoleStudio(getState());
        if (studio.eventOps?.[eventId]?.[key]) {
          showToast(key === 'qrReady' ? 'El QR ya está listo' : 'La agenda ya fue confirmada');
          return;
        }
        updateRoleStudioState((state, nextStudio) => {
          nextStudio.eventOps[eventId] = Object.assign({}, nextStudio.eventOps[eventId] || {}, {
            [key]: true,
            updatedAt: new Date().toISOString()
          });
        }, key === 'qrReady' ? `QR activo para ${eventItem.name}` : `Agenda confirmada para ${eventItem.name}`);
      }
    
      function scoutShortlistArtist(artistId) {
        const artist = artistFor(artistId);
        const profile = profileFor(getState().profileId);
        if (profile.roleKey !== 'scout') {
          showToast('Esta acción es exclusiva del scout');
          return;
        }
        const studio = getRoleStudio(getState());
        if (studio.scoutShortlist.some((entry) => entry.artistId === artistId)) {
          showToast('Ese artista ya está en shortlist');
          return;
        }
        updateRoleStudioState((state, nextStudio) => {
          nextStudio.scoutShortlist.unshift({ artistId, createdAt: new Date().toISOString() });
        }, `${artist.name} agregado a shortlist`);
      }
    
      function scoutContactArtist(artistId) {
        const artist = artistFor(artistId);
        const profile = profileFor(getState().profileId);
        if (profile.roleKey !== 'scout') {
          showToast('Esta acción es exclusiva del scout');
          return;
        }
        const studio = getRoleStudio(getState());
        if (studio.scoutContacts.some((entry) => entry.artistId === artistId)) {
          showToast('Ese artista ya fue contactado');
          return;
        }
        updateRoleStudioState((state, nextStudio) => {
          nextStudio.scoutContacts.unshift({ artistId, createdAt: new Date().toISOString() });
        }, `Contacto discográfico enviado a ${artist.name}`);
      }
    
      function togglePreviewMode() {
        const state = getState();
        state.settings.preview30 = !state.settings.preview30;
        setState(state);
        renderApp(state);
        showToast(state.settings.preview30 ? 'Modo 30s activado' : 'Modo full demo activado');
      }
    
      function openCommunitySharePanel() {
        const details = document.querySelector('[data-community-share-details]');
        if (!details) return;
        details.open = true;
      }
    
      function toggleImmersive() {
        const state = getState();
        state.immersive = !state.immersive;
        setState(state);
        renderApp(state);
        showToast(state.immersive ? 'Vista expandida activada' : 'Vista expandida desactivada');
      }

      function updateTheme(themeMode) {
        const state = getState();
        state.settings.themeMode = themeMode === 'light' ? 'light' : 'dark';
        setState(state);
        renderApp(state);
        showToast(state.settings.themeMode === 'light' ? 'Modo claro activado' : 'Modo oscuro activado');
      }
    
      function toggleTheme(nextTheme) {
        const theme = nextTheme || (getState().settings.themeMode === 'dark' ? 'light' : 'dark');
        updateTheme(theme);
      }
    
      function updateSettingValue(key, value) {
        const state = getState();
        state.settings[key] = value;
        setState(state);
        renderApp(state);
        if ($('[data-settings-overlay]')?.classList.contains('is-open')) {
          openSettings();
        }
        showToast('Ajuste actualizado');
      }
    
      function updateSettingToggle(key) {
        const state = getState();
        state.settings[key] = !state.settings[key];
        setState(state);
        renderApp(state);
        if ($('[data-settings-overlay]')?.classList.contains('is-open')) {
          openSettings();
        }
      }
    
      function saveReview() {
        const state = getState();
        const artistId = state.selectedArtistId;
        const review = buildDraftReview(artistId, state.profileId);
        if (!review) {
          showToast('Agrega estrellas, texto o una cápsula de voz antes de guardar');
          return;
        }
        state.artistFeedback[artistId] = Array.isArray(state.artistFeedback[artistId]) ? state.artistFeedback[artistId] : [];
        state.artistFeedback[artistId].push(review);
        clearDraft(artistId);
        commitState(state, 'Reseña guardada');
      }
    
      async function handleClick(event) {
        const target = event.target;
        const homeTrigger = target.closest('[data-go-home]');
        if (homeTrigger) {
          goHome(homeTrigger);
          return;
        }
    
        const selectCard = target.closest('[data-select-artist]');
        if (selectCard && !target.closest('[data-card-play], [data-card-save], button')) {
          await selectArtist(selectCard.dataset.selectArtist);
          return;
        }
    
        const button = target.closest('button, [data-open-login], [data-open-team], [data-open-settings]');
        if (!button) return;
    
        if (button.matches('[data-device-option]')) {
          const state = getState();
          state.device = button.dataset.deviceOption;
          setState(state);
          renderApp(state);
          return;
        }
    
        if (button.matches('[data-view-target]')) {
          setView(button.dataset.viewTarget);
          return;
        }
    
        if (button.matches('[data-open-login]')) {
          openLogin();
          return;
        }
    
        if (button.matches('[data-reset-state]')) {
          resetAppState();
          return;
        }
    
        if (button.matches('[data-open-settings]')) {
          openSettings();
          return;
        }
    
        if (button.matches('[data-open-team]')) {
          openTeam();
          return;
        }
    
        if (button.matches('[data-close-login]')) {
          closeLogin();
          return;
        }
    
        if (button.matches('[data-close-settings]')) {
          closeOverlay($('[data-settings-overlay]'));
          return;
        }
    
        if (button.matches('[data-close-team]')) {
          closeOverlay($('[data-team-overlay]'));
          return;
        }
    
        if (button.matches('[data-close-scanner]')) {
          closeOverlay($('[data-scanner-overlay]'));
          return;
        }
    
        if (button.matches('[data-logout]')) {
          logout();
          return;
        }
    
        if (button.matches('[data-go-login-page]')) {
          window.open('login.html', '_blank', 'noopener');
          return;
        }
    
        if (button.matches('[data-trigger-role-upload]')) {
          const scope = button.closest('[data-role-demo-scope]') || document;
          const input = scope.querySelector('[data-role-upload-input]') || document.querySelector('[data-role-upload-input]');
          input?.click();
          return;
        }
    
        if (button.matches('[data-ambassador-contact]')) {
          ambassadorContactArtist(button.dataset.ambassadorContact);
          return;
        }
    
        if (button.matches('[data-ambassador-highlight]')) {
          ambassadorHighlightArtist(button.dataset.ambassadorHighlight);
          return;
        }
    
        if (button.matches('[data-event-ops-qr]')) {
          markEventOperation(button.dataset.eventOpsQr, 'qrReady');
          return;
        }
    
        if (button.matches('[data-event-ops-agenda]')) {
          markEventOperation(button.dataset.eventOpsAgenda, 'agendaReady');
          return;
        }
    
        if (button.matches('[data-scout-shortlist]')) {
          scoutShortlistArtist(button.dataset.scoutShortlist);
          return;
        }
    
        if (button.matches('[data-scout-contact]')) {
          scoutContactArtist(button.dataset.scoutContact);
          return;
        }
    
        if (button.matches('[data-theme-toggle], [data-theme-toggle-icon]')) {
          toggleTheme(button.dataset.nextTheme);
          return;
        }
    
        if (button.matches('[data-expand-toggle], [data-expand-toggle-icon]')) {
          toggleImmersive();
          return;
        }
    
        if (button.matches('[data-cycle-capsules]')) {
          await cycleArtist(1);
          return;
        }
    
        if (button.matches('[data-hero-play]')) {
          setView('player');
          const started = await playArtist(selectedArtist(getState()), { reset: true });
          if (!started) showToast('Tu navegador bloqueó el audio. Intenta de nuevo.');
          return;
        }
    
        if (button.matches('[data-hero-save]')) {
          toggleSave(getState().selectedArtistId);
          return;
        }
    
        if (button.matches('[data-hero-like]')) {
          toggleLike(getState().selectedArtistId);
          return;
        }
    
        if (button.matches('[data-card-play]')) {
          await selectArtist(button.dataset.cardPlay, true);
          setView('player');
          return;
        }
    
        if (button.matches('[data-card-save]')) {
          toggleSave(button.dataset.cardSave);
          return;
        }
    
        if (button.matches('[data-open-saved]')) {
          await selectArtist(button.dataset.openSaved);
          return;
        }
    
        if (button.matches('[data-player-toggle]')) {
          const started = await toggleArtistPlayback(selectedArtist(getState()));
          if (!started) showToast('No se pudo iniciar el audio.');
          return;
        }
    
        if (button.matches('[data-player-prev]')) {
          await cycleArtist(-1);
          return;
        }
    
        if (button.matches('[data-player-next]')) {
          await cycleArtist(1);
          return;
        }
    
        if (button.matches('[data-player-like]')) {
          toggleLike(getState().selectedArtistId);
          return;
        }
    
        if (button.matches('[data-player-save]')) {
          toggleSave(getState().selectedArtistId);
          return;
        }
    
        if (button.matches('[data-player-share]')) {
          setView('community');
          openCommunitySharePanel();
          showToast('Selecciona un canal para compartir');
          return;
        }
    
        if (button.matches('[data-toggle-preview]')) {
          togglePreviewMode();
          return;
        }
    
        if (button.matches('[data-queue-select]')) {
          await selectArtist(button.dataset.queueSelect, getAudioSnapshot(getState().selectedArtistId).isPlaying);
          return;
        }
    
        if (button.matches('[data-event-select]')) {
          const state = getState();
          state.activeEventId = button.dataset.eventSelect;
          setState(state);
          renderApp(state);
          return;
        }
    
        if (button.matches('[data-open-scanner-btn]')) {
          openScanner(button.dataset.openScannerBtn);
          return;
        }
    
        if (button.matches('[data-open-qr-direct]')) {
          window.open(`qr-checkin.html?event=${button.dataset.openQrDirect}`, '_blank', 'noopener');
          return;
        }
    
        if (button.matches('[data-jump-event]')) {
          const state = getState();
          state.activeEventId = button.dataset.jumpEvent;
          setState(state);
          renderApp(state);
          return;
        }
    
        if (button.matches('[data-event-checkin]')) {
          openScanner(button.dataset.eventCheckin);
          return;
        }
    
        if (button.matches('[data-add-playlist]')) {
          addSelectedToPlaylist();
          return;
        }
    
        if (button.matches('[data-share-target]')) {
          shareTo(button.dataset.shareTarget);
          return;
        }
    
        if (button.matches('[data-favorite-open]')) {
          await selectArtist(button.dataset.favoriteOpen);
          setView('player');
          return;
        }
    
        if (button.matches('[data-login-select]')) {
          loginAs(button.dataset.loginSelect);
          return;
        }
    
        if (button.matches('[data-setting-toggle]')) {
          updateSettingToggle(button.dataset.settingToggle);
          return;
        }
    
        if (button.matches('[data-simulate-checkin]')) {
          const eventId = $('[data-scanner-overlay]')?.dataset.eventId || getState().activeEventId;
          checkIn(eventId);
          return;
        }
    
        if (button.matches('[data-review-rating]')) {
          updateDraft(getState().selectedArtistId, { rating: Number(button.dataset.reviewRating || 0) });
          renderPlayerFeedback(getState());
          return;
        }
    
        if (button.matches('[data-review-record]')) {
          const started = await startVoiceRecording(getState().selectedArtistId);
          if (!started) {
            const recorderMessage = $('[data-player-review-summary]') ? 'Revisa permisos del micrófono e intenta de nuevo' : 'No se pudo iniciar la grabación';
            showToast(recorderMessage);
          }
          return;
        }
    
        if (button.matches('[data-review-stop]')) {
          stopVoiceRecording();
          return;
        }
    
        if (button.matches('[data-review-discard]')) {
          discardVoiceDraft(getState().selectedArtistId);
          showToast('Capsula descartada');
        }
      }
    
      function handleInput(event) {
        if (event.target.matches('[data-player-range]')) {
          seekAudio(event.target.value);
          renderLiveAudioState();
          return;
        }
        if (event.target.matches('[data-review-text]')) {
          updateDraft(getState().selectedArtistId, { text: event.target.value.slice(0, 220) });
        }
      }
    
      function handleChange(event) {
        if (event.target.matches('[data-role-upload-input]')) {
          handleArtistUpload(event.target.files?.[0]);
          event.target.value = '';
          return;
        }
        if (!event.target.matches('[data-setting-select]')) return;
        updateSettingValue(event.target.dataset.settingSelect, event.target.value);
      }
    
      function handleSubmit(event) {
        if (!event.target.matches('[data-review-form]')) return;
        event.preventDefault();
        saveReview();
      }
    
      function handleOverlayClick(event) {
        const overlay = event.target.closest('.overlay');
        if (!overlay || event.target !== overlay) return;
        if (overlay.matches('[data-login-overlay]') && !getState().loggedIn) return;
        closeOverlay(overlay);
      }
    
      function handleKeydown(event) {
        const homeTrigger = event.target.closest?.('[data-go-home]');
        if (homeTrigger && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          goHome(homeTrigger);
          return;
        }
        if (event.key !== 'Escape') return;
        const openOverlayNode = document.querySelector('.overlay.is-open');
        if (!openOverlayNode) return;
        if (openOverlayNode.matches('[data-login-overlay]') && !getState().loggedIn) return;
        closeOverlay(openOverlayNode);
      }
    
      function bindGlobalEvents() {
        document.addEventListener('click', (event) => {
          handleOverlayClick(event);
          handleClick(event);
        });
        document.addEventListener('input', handleInput);
        document.addEventListener('change', handleChange);
        document.addEventListener('submit', handleSubmit);
        document.addEventListener('keydown', handleKeydown);
      }
    
      function initController() {
        initClock();
        configureAudio({
          getPreviewEnabled: () => getState().settings.preview30,
          onUiUpdate: () => {
            renderLiveAudioState();
            renderNowPlaying(getState());
          },
          onPlaybackBlocked: () => {
            showToast('Tu navegador bloqueó el audio. Usa Reproducir de nuevo.');
          }
        });
        setReviewUpdateCallback(() => {
          renderPlayerFeedback(getState());
        });
        bindGlobalEvents();
        renderApp();
      }
    
      export { initController, renderApp };


    