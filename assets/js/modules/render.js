
    import {
      $, $$,
      allProfiles,
      artistFor,
      data,
      eventFor,
      formatNumber,
      formatTime,
      getArtistReviewMetrics,
      getArtistReviews,
      getProfileStreak,
      getProfileXp,
      getState,
      levelFromXp,
      missionProgress,
      playlistTracks,
      profileFor,
      selectedArtist
    } from './state.js';
    import { getAudioSnapshot } from './audio.js';
    import { getDraft, getRecorderSnapshot } from './reviews.js';
    
    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }
    
    function optionValue(option) {
      return typeof option === 'object' ? option.value : option;
    }
    
    function optionLabel(option) {
      return typeof option === 'object' ? option.label : option;
    }
    
    function formatReviewDate(value) {
      try {
        return new Intl.DateTimeFormat('es-CO', {
          dateStyle: 'short',
          timeStyle: 'short'
        }).format(new Date(value));
      } catch (error) {
        return 'Reciente';
      }
    }
    
    
    function eventPosterTone(eventId) {
      if (eventId === 'jam-rio') return 'violet';
      if (eventId === 'patio-pacifico') return 'emerald';
      return 'sunset';
    }

    function renderEventPoster(item) {
      return `
        <div class="event-poster" aria-label="Poster de ${escapeHtml(item.name)}">
          <div class="event-poster-frame">
            <div class="event-poster-card" data-event-tone="${eventPosterTone(item.id)}">
              <div class="event-poster-head">
                <span class="event-poster-kicker">KORA LIVE</span>
                <h3 class="event-poster-title">${escapeHtml(item.name)}</h3>
                <p class="event-poster-place">${escapeHtml(item.place)}</p>
              </div>
              <div class="event-poster-core">
                <div class="event-poster-divider"></div>
                <div class="event-poster-orbit"></div>
                <span class="event-poster-badge">+${item.reward} XP</span>
              </div>
              <div class="event-poster-foot">
                <p class="event-poster-copy">${escapeHtml(item.summary)}</p>
              </div>
            </div>
          </div>
        </div>`;
    }

    function renderShellProfile(state) {
      const profile = profileFor(state.profileId);
      const xp = getProfileXp(state);
      const streak = getProfileStreak(state);
      const level = levelFromXp(xp);
      $$('[data-profile-avatar]').forEach((img) => {
        img.src = profile.avatar;
        img.alt = profile.name;
      });
      $$('[data-profile-name]').forEach((node) => {
        node.textContent = profile.name;
      });
      $$('[data-profile-role]').forEach((node) => {
        node.textContent = profile.role;
      });
      $$('[data-profile-xp]').forEach((node) => {
        node.textContent = formatNumber(xp);
      });
      $$('[data-profile-streak]').forEach((node) => {
        node.textContent = String(streak);
      });
      $$('[data-profile-level]').forEach((node) => {
        node.textContent = level;
      });
    }
    
    function renderHero(state) {
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
            <h2>${escapeHtml(artist.name)}</h2>
            <p><strong>${escapeHtml(artist.track)}</strong> · ${escapeHtml(artist.genre)} · ${escapeHtml(artist.city)}</p>
            <p>${escapeHtml(artist.story)}</p>
            <div class="pill-row">
              <span class="mini-pill">${artist.match}% match</span>
              <span class="mini-pill">${escapeHtml(artist.listeners)} oyentes</span>
              <span class="mini-pill">${escapeHtml(artist.vibe)}</span>
            </div>
            <div class="card-actions">
              <button class="primary-btn" type="button" data-hero-play>Escuchar</button>
              <button class="soft-btn" type="button" data-hero-save>${saved ? 'Guardado' : 'Guardar'}</button>
              <button class="soft-btn" type="button" data-hero-like>${liked ? 'Te gusta' : 'Like'}</button>
            </div>
          </div>
          <div class="hero-visual">
            <img class="hero-cover" src="${escapeHtml(artist.cover)}" alt="${escapeHtml(artist.name)}">
            <div class="pill-row">
              ${artist.tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
        </div>`;
    }
    
    function renderCapsuleFeed(state) {
      const mount = $('[data-capsule-feed]');
      if (!mount) return;
      mount.innerHTML = data.artists.map((artist) => {
        const isSelected = state.selectedArtistId === artist.id;
        const isSaved = state.savedArtistIds.includes(artist.id);
        return `
          <article class="panel-card capsule-card stack-item ${isSelected ? 'is-active' : ''}" data-select-artist="${escapeHtml(artist.id)}">
            <img class="capsule-cover" src="${escapeHtml(artist.cover)}" alt="${escapeHtml(artist.name)}">
            <div class="capsule-copy">
              <h3>${escapeHtml(artist.track)}</h3>
              <p>${escapeHtml(artist.name)} · ${escapeHtml(artist.city)} · ${escapeHtml(artist.genre)}</p>
              <p>${escapeHtml(artist.story)}</p>
            </div>
            <div class="pill-row">
              <span class="mini-pill">${artist.match}% match</span>
              <span class="mini-pill">${escapeHtml(artist.vibe)}</span>
            </div>
            <div class="card-actions">
              <button class="soft-btn small-btn" type="button" data-card-play="${escapeHtml(artist.id)}">Play</button>
              <button class="soft-btn small-btn" type="button" data-card-save="${escapeHtml(artist.id)}">${isSaved ? 'Guardado' : 'Guardar'}</button>
            </div>
          </article>`;
      }).join('');
    }
    
    function renderSavedBoard(state) {
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
          <button class="stack-item ${state.selectedArtistId === artist.id ? 'is-active' : ''}" type="button" data-open-saved="${escapeHtml(artist.id)}">
            <img src="${escapeHtml(artist.cover)}" alt="${escapeHtml(artist.name)}">
            <div>
              <strong>${escapeHtml(artist.track)}</strong>
              <span>${escapeHtml(artist.name)} · ${escapeHtml(artist.city)}</span>
            </div>
          </button>`;
      }).join('');
    }
    
    function renderDiscoverTags(state) {
      const artist = selectedArtist(state);
      const mount = $('[data-discover-tags]');
      if (!mount) return;
      const tags = [...new Set([...artist.tags, artist.city.toLowerCase(), artist.region.toLowerCase(), artist.genre.toLowerCase()])];
      mount.innerHTML = tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('');
    }
    
    function buildStarButtons(rating) {
      return Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;
        return `<button class="star-btn ${rating >= value ? 'is-active' : ''}" type="button" data-review-rating="${value}" aria-label="${value} estrellas">★</button>`;
      }).join('');
    }
    
    function renderPlayerFeedback(state) {
      const artist = selectedArtist(state);
      const draft = getDraft(artist.id);
      const recorder = getRecorderSnapshot(artist.id);
      const metrics = getArtistReviewMetrics(state, artist.id);
      const summary = $('[data-player-review-summary]');
      const list = $('[data-review-list]');
      const count = $('[data-review-summary-count]');
      const average = $('[data-review-average]');
      const form = $('[data-review-form]');
      const reviews = getArtistReviews(state, artist.id).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      const recorderMessage = recorder.status === 'recording'
        ? `Grabando cápsula... ${formatTime(recorder.seconds)} / 0:30`
        : recorder.status === 'processing'
          ? 'Procesando audio...'
          : recorder.status === 'error'
            ? escapeHtml(recorder.error)
            : draft.voiceNote
              ? `Capsula lista · ${formatTime(draft.voiceNote.duration)}`
              : 'Graba hasta 30 segundos para dejar tu reseña hablada.';
    
      if (count) count.textContent = `${metrics.total} reseñas`;
      if (average) average.textContent = metrics.ratedCount ? `${metrics.averageRating.toFixed(1)}★` : 'Sin rating';
    
      if (summary) {
        summary.innerHTML = `
          <div class="review-summary-grid">
            <article class="review-metric">
              <span class="eyebrow">Promedio</span>
              <strong>${metrics.ratedCount ? metrics.averageRating.toFixed(1) : '0.0'}★</strong>
              <span>${metrics.ratedCount} valoraciones</span>
            </article>
            <article class="review-metric">
              <span class="eyebrow">Capsulas</span>
              <strong>${metrics.voiceCount}</strong>
              <span>reseñas de voz</span>
            </article>
            <article class="review-metric">
              <span class="eyebrow">Total</span>
              <strong>${metrics.total}</strong>
              <span>feedback guardado</span>
            </article>
          </div>`;
      }
    
      if (form) {
        form.innerHTML = `
          <div class="rating-row">
            <div>
              <p class="eyebrow">Tu valoración</p>
              <div class="star-row">${buildStarButtons(draft.rating || 0)}</div>
            </div>
            <span class="mini-pill">${draft.rating ? `${draft.rating} estrellas` : 'Opcional'}</span>
          </div>
          <textarea class="review-textarea" maxlength="220" placeholder="Escribe qué te pareció la canción, el hook o la cápsula..." data-review-text>${escapeHtml(draft.text || '')}</textarea>
          <div class="voice-recorder ${recorder.status === 'recording' ? 'is-recording' : ''}">
            <div class="voice-recorder-copy">
              <strong>Capsula de voz</strong>
              <span>${recorderMessage}</span>
            </div>
            <audio class="${draft.voiceNote ? '' : 'hidden'}" controls data-review-audio-preview src="${draft.voiceNote ? draft.voiceNote.dataUrl : ''}"></audio>
            <div class="card-actions">
              <button class="soft-btn" type="button" data-review-record ${recorder.status === 'recording' || recorder.status === 'processing' ? 'disabled' : ''}>Grabar cápsula</button>
              <button class="soft-btn ${recorder.status === 'recording' ? '' : 'hidden'}" type="button" data-review-stop>Detener</button>
              <button class="soft-btn ${draft.voiceNote || recorder.status === 'recording' || recorder.status === 'error' ? '' : 'hidden'}" type="button" data-review-discard>Descartar</button>
            </div>
          </div>
          <div class="card-actions review-submit-row">
            <button class="primary-btn" type="submit">Guardar reseña</button>
            <span class="helper-copy">Puedes guardar estrellas, texto, voz o todo junto.</span>
          </div>`;
      }
    
      if (!list) return;
      if (!reviews.length) {
        list.innerHTML = '<div class="empty-state">Todavia no hay reseñas. Sé la primera persona en dejar estrellas, comentario o una cápsula de voz.</div>';
        return;
      }
      list.innerHTML = reviews.map((review) => {
        const reviewer = profileFor(review.profileId);
        return `
          <article class="review-card">
            <div class="review-card-head">
              <div class="review-author">
                <img src="${escapeHtml(reviewer.avatar)}" alt="${escapeHtml(reviewer.name)}">
                <div>
                  <strong>${escapeHtml(reviewer.name)}</strong>
                  <span>${escapeHtml(reviewer.role)}</span>
                </div>
              </div>
              <div class="review-meta">
                <span class="mini-pill">${review.rating ? `${review.rating}★` : 'Sin rating'}</span>
                <span class="review-date">${escapeHtml(formatReviewDate(review.createdAt))}</span>
              </div>
            </div>
            ${review.comment ? `<p class="review-copy">${escapeHtml(review.comment)}</p>` : ''}
            ${review.voiceNote ? `<audio controls src="${review.voiceNote.dataUrl}"></audio><div class="review-foot"><span class="mini-pill">${formatTime(review.voiceNote.duration)}</span><span class="mini-pill">Capsula de voz</span></div>` : ''}
          </article>`;
      }).join('');
    }
    
    function renderPlayer(state) {
      const artist = selectedArtist(state);
      const snapshot = getAudioSnapshot(artist.id);
      const saved = state.savedArtistIds.includes(artist.id);
      const liked = state.likedArtistIds.includes(artist.id);
      const showCaptions = Boolean(state.settings.captions);
    
      $('[data-player-cover]').src = artist.cover;
      $('[data-player-cover]').alt = artist.name;
      $('[data-player-track]').textContent = artist.track;
      $('[data-player-name]').textContent = `${artist.name} · ${artist.genre}`;
      $('[data-player-story]').textContent = showCaptions ? artist.story : 'Activa la historia y etiquetas para ver el contexto de la cápsula.';
      $('[data-player-match]').textContent = `${artist.match}% match`;
      $('[data-player-duration]').textContent = state.settings.preview30 ? '0:30' : artist.duration;
      $('[data-player-total]').textContent = formatTime(snapshot.total);
      $('[data-player-current]').textContent = formatTime(snapshot.currentTime);
      $('[data-player-range]').value = String(snapshot.currentTime);
      $('[data-player-range]').max = String(snapshot.total);
      $('[data-toggle-preview]').textContent = state.settings.preview30 ? 'Modo 30s' : 'Full demo';
      $('[data-toggle-preview]').classList.toggle('is-active', state.settings.preview30);
      $('[data-player-toggle]').textContent = snapshot.isPlaying ? 'Pausar' : 'Reproducir';
      $('[data-player-like]').textContent = liked ? 'Te gusta' : 'Like';
      $('[data-player-save]').textContent = saved ? 'Guardado' : 'Guardar';
    
      const queueMount = $('[data-player-queue]');
      queueMount.innerHTML = data.artists.map((item) => `
        <button class="stack-item ${item.id === artist.id ? 'is-active' : ''}" type="button" data-queue-select="${escapeHtml(item.id)}">
          <img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.name)}">
          <div>
            <strong>${escapeHtml(item.track)}</strong>
            <span>${escapeHtml(item.name)} · ${escapeHtml(item.city)}</span>
          </div>
        </button>`).join('');
    
      const insightMount = $('[data-player-insights]');
      const insights = showCaptions
        ? [
            `Barrio / escena: ${artist.city} · ${artist.region}`,
            `Capsula: ${artist.capsule}`,
            `Etiquetas: ${artist.tags.join(' · ')}`
          ]
        : ['La historia y las etiquetas están ocultas en este modo.'];
      insightMount.innerHTML = insights.map((text) => `<div class="insight-row"><p>${escapeHtml(text)}</p></div>`).join('');
    
      renderPlayerFeedback(state);
    }
    
    function renderEvents(state) {
      const activeEvent = eventFor(state.activeEventId);
      const map = $('[data-event-map]');
      if (map) {
        map.innerHTML = data.events.map((item, index) => `
          <button class="map-pin ${activeEvent.id === item.id ? 'is-active' : ''}" style="left:${item.x}%; top:${item.y}%;" type="button" data-event-select="${escapeHtml(item.id)}">
            <span>${index + 1}</span>
          </button>`).join('');
      }
    
      const preview = $('[data-event-preview]');
      const claimed = state.checkedEventIds.includes(activeEvent.id);
      preview.className = 'panel-card event-preview';
      preview.innerHTML = `
        <div class="panel-head">
          <strong>${escapeHtml(activeEvent.name)}</strong>
          <span class="mini-pill">+${activeEvent.reward} XP</span>
        </div>
        ${renderEventPoster(activeEvent)}
        <p>${escapeHtml(activeEvent.summary)}</p>
        <div class="event-meta">
          <span class="mini-pill">${escapeHtml(activeEvent.place)}</span>
          <span class="mini-pill">${escapeHtml(activeEvent.time)}</span>
        </div>
        <div class="card-actions">
          <button class="primary-btn" type="button" data-open-scanner-btn="${escapeHtml(activeEvent.id)}">${claimed ? 'Ver sello' : 'Abrir QR'}</button>
          <button class="soft-btn" type="button" data-open-qr-direct="${escapeHtml(activeEvent.id)}">qr-checkin</button>
        </div>`;
    
      const list = $('[data-events-list]');
      const count = $('[data-event-count]');
      if (count) count.textContent = `${data.events.length} eventos`;
      list.innerHTML = data.events.map((item) => {
        const earned = state.checkedEventIds.includes(item.id);
        return `
          <article class="event-card ${earned ? 'is-complete' : ''}">
            <div class="panel-head">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="mini-pill">${earned ? 'Sello obtenido' : `+${item.reward} XP`}</span>
            </div>
            <p>${escapeHtml(item.summary)}</p>
            <div class="event-meta">
              <span class="mini-pill">${escapeHtml(item.place)}</span>
              <span class="mini-pill">${escapeHtml(item.time)}</span>
            </div>
            <div class="card-actions">
              <button class="soft-btn small-btn" type="button" data-jump-event="${escapeHtml(item.id)}">Ver</button>
              <button class="soft-btn small-btn" type="button" data-event-checkin="${escapeHtml(item.id)}">${earned ? 'Reclamado' : 'Check-in'}</button>
            </div>
          </article>`;
      }).join('');
    }
    
    function renderPlaylistCard(state) {
      const mount = $('[data-playlist-card]');
      const tracks = playlistTracks(state);
      mount.innerHTML = `
        <div class="playlist-hero">
          <div class="panel-head">
            <strong>${escapeHtml(data.playlists[0].name)}</strong>
            <span class="mini-pill">${tracks.length} canciones</span>
          </div>
          <p>${escapeHtml(data.playlists[0].subtitle)}. Descubrir → guardar → compartir → aportar.</p>
          <div class="pill-row">
            <span class="mini-pill">${data.playlists[0].followers + state.playlistContributions * 3} seguidores</span>
            <span class="mini-pill">${state.playlistContributions} aportes</span>
          </div>
          <div class="playlist-tracks">
            ${tracks.map((artist, index) => `<div class="track-row"><span>${index + 1}. ${escapeHtml(artist.track)}</span><span>${escapeHtml(artist.name)}</span></div>`).join('')}
          </div>
        </div>`;
    }
    
    function renderShares(state) {
      const mount = $('[data-share-grid]');
      mount.innerHTML = data.shareTargets.map((target) => `
        <button class="share-card ${state.sharedTargets.includes(target.id) ? 'is-active' : ''}" type="button" data-share-target="${escapeHtml(target.id)}">
          <span class="share-icon">${escapeHtml(target.icon)}</span>
          <strong>${escapeHtml(target.name)}</strong>
          <span>${state.sharedTargets.includes(target.id) ? 'Compartido' : 'Listo para demo'}</span>
        </button>`).join('');
    }
    
    function renderLeaderboards(state) {
      const userMount = $('[data-user-leaderboard]');
      const artistMount = $('[data-artist-leaderboard]');
      const users = allProfiles.map((profile) => ({
        profile,
        xp: profile.id === state.profileId ? getProfileXp(state) : profile.baseXp
      })).sort((left, right) => right.xp - left.xp).slice(0, 5);
      userMount.innerHTML = users.map((entry, index) => `
        <div class="leaderboard-card">
          <img src="${escapeHtml(entry.profile.avatar)}" alt="${escapeHtml(entry.profile.name)}">
          <div>
            <strong>${escapeHtml(entry.profile.name)}</strong>
            <span>${escapeHtml(entry.profile.role)}</span>
          </div>
          <div>
            <strong>#${index + 1}</strong>
            <span>${formatNumber(entry.xp)} XP</span>
          </div>
        </div>`).join('');
    
      const artists = data.artists.map((artist) => {
        const reviewMetrics = getArtistReviewMetrics(state, artist.id);
        return {
          artist,
          score: artist.match
            + (state.savedArtistIds.includes(artist.id) ? 8 : 0)
            + (state.likedArtistIds.includes(artist.id) ? 5 : 0)
            + (state.playlistArtistIds.includes(artist.id) ? 6 : 0)
            + Math.round(reviewMetrics.averageRating * 2)
        };
      }).sort((left, right) => right.score - left.score).slice(0, 5);
      artistMount.innerHTML = artists.map((entry, index) => `
        <div class="leaderboard-card">
          <img src="${escapeHtml(entry.artist.cover)}" alt="${escapeHtml(entry.artist.name)}">
          <div>
            <strong>${escapeHtml(entry.artist.name)}</strong>
            <span>${escapeHtml(entry.artist.genre)}</span>
          </div>
          <div>
            <strong>#${index + 1}</strong>
            <span>${entry.score} pts</span>
          </div>
        </div>`).join('');
    }
    
    function renderProfile(state) {
      const profile = profileFor(state.profileId);
      const xp = getProfileXp(state);
      const streak = getProfileStreak(state);
      const overview = $('[data-profile-overview]');
      overview.className = 'panel-card profile-overview';
      overview.innerHTML = `
        <div class="summary-head">
          <img src="${escapeHtml(profile.avatar)}" alt="${escapeHtml(profile.name)}">
          <div>
            <p class="eyebrow">Perfil activo</p>
            <h2>${escapeHtml(profile.name)}</h2>
            <p>${escapeHtml(profile.role)} · ${escapeHtml(profile.city)}</p>
          </div>
        </div>
        <p>${escapeHtml(profile.bio)}</p>
        <div class="profile-stats">
          <div class="stat-box"><span class="eyebrow">XP</span><strong>${formatNumber(xp)}</strong></div>
          <div class="stat-box"><span class="eyebrow">Racha</span><strong>${streak}</strong></div>
          <div class="stat-box"><span class="eyebrow">Guardados</span><strong>${state.savedArtistIds.length}</strong></div>
          <div class="stat-box"><span class="eyebrow">Shares</span><strong>${state.sharedTargets.length}</strong></div>
        </div>`;
    
      const badges = $('[data-badge-list]');
      badges.innerHTML = profile.badges.map((badge) => `<span class="badge-pill">${escapeHtml(badge)}</span>`).join('');
    
      const favorites = $('[data-favorite-list]');
      const favoriteArtists = state.savedArtistIds.length ? state.savedArtistIds.map(artistFor) : data.artists.slice(0, 2);
      favorites.innerHTML = favoriteArtists.map((artist) => `
        <button class="favorite-card" type="button" data-favorite-open="${escapeHtml(artist.id)}">
          <img src="${escapeHtml(artist.cover)}" alt="${escapeHtml(artist.name)}">
          <div>
            <strong>${escapeHtml(artist.track)}</strong>
            <span>${escapeHtml(artist.name)} · ${escapeHtml(artist.city)}</span>
          </div>
        </button>`).join('');
    
      renderStamps('[data-stamps-grid-main]', state);
    }
    
    function renderNowPlaying(state) {
      const artist = selectedArtist(state);
      const snapshot = getAudioSnapshot(artist.id);
      const mount = $('[data-now-playing-card]');
      if (!mount) return;
      mount.className = 'panel-card now-playing-card';
      mount.innerHTML = `
        <p class="eyebrow">Ahora sonando</p>
        <div class="now-playing-media">
          <img src="${escapeHtml(artist.cover)}" alt="${escapeHtml(artist.name)}">
          <div>
            <h3>${escapeHtml(artist.track)}</h3>
            <p>${escapeHtml(artist.name)} · ${escapeHtml(artist.genre)}</p>
          </div>
        </div>
        <div class="progress"><span data-now-playing-progress style="width:${Math.min(100, snapshot.currentTime / Math.max(1, snapshot.total) * 100)}%"></span></div>
        <div class="pill-row">
          <span class="mini-pill">${snapshot.isPlaying ? 'Reproduciendo' : 'Pausado'}</span>
          <span class="mini-pill">${formatTime(snapshot.currentTime)} / ${formatTime(snapshot.total)}</span>
        </div>`;
    }
    
    function renderMissions(state) {
      const mount = $('[data-missions-list]');
      if (!mount) return;
      mount.innerHTML = data.missions.map((mission) => {
        const progress = missionProgress(state, mission);
        return `
          <article class="mission-card ${progress.done ? 'is-complete' : ''}">
            <div class="panel-head">
              <strong>${escapeHtml(mission.name)}</strong>
              <span class="mini-pill">+${mission.reward} XP</span>
            </div>
            <p>${escapeHtml(mission.description)}</p>
            <div class="mission-meta">
              <span class="mini-pill">${progress.value}/${mission.threshold}</span>
              <span class="mini-pill">${progress.done ? 'Completada' : 'En progreso'}</span>
            </div>
            <div class="progress"><span style="width:${Math.min(100, progress.value / mission.threshold * 100)}%"></span></div>
          </article>`;
      }).join('');
    }
    
    function renderStamps(selector, state = getState()) {
      const mount = $(selector);
      if (!mount) return;
      mount.innerHTML = data.events.map((item) => {
        const earned = state.checkedEventIds.includes(item.id);
        return `
          <div class="stamp-card ${earned ? 'is-earned' : ''}">
            <div>
              <strong>${escapeHtml(item.stamp)}</strong>
              <span>${earned ? 'Obtenido' : 'Pendiente'}</span>
            </div>
            <span class="stamp-pill">${earned ? '✓' : `+${item.reward}`}</span>
          </div>`;
      }).join('');
    }
    
    function renderLoginCards(state) {
      const teamMount = $('[data-team-profiles]');
      const roleMount = $('[data-role-profiles]');
      if (!teamMount || !roleMount) return;
      const renderGroup = (items) => items.map((profile) => `
        <button class="profile-card ${state.profileId === profile.id ? 'is-active' : ''}" type="button" data-login-select="${escapeHtml(profile.id)}">
          <img src="${escapeHtml(profile.avatar)}" alt="${escapeHtml(profile.name)}">
          <strong>${escapeHtml(profile.name)}</strong>
          <span>${escapeHtml(profile.role)}</span>
          <small>${escapeHtml(profile.code)}</small>
        </button>`).join('');
      teamMount.innerHTML = renderGroup(data.teamMembers);
      roleMount.innerHTML = renderGroup(data.demoRoles);
    }
    
    function renderSettings(state) {
      const mount = $('[data-settings-content]');
      if (!mount) return;
      const profile = profileFor(state.profileId);
      mount.innerHTML = `
        <article class="settings-card">
          <div class="panel-head">
            <strong>Cuenta activa</strong>
            <span class="mini-pill">${escapeHtml(profile.role)}</span>
          </div>
          <p class="settings-copy">${escapeHtml(profile.name)} · ${escapeHtml(profile.handle || profile.role)} · ${escapeHtml(profile.city)}</p>
        </article>
        <article class="settings-card">
          <div class="panel-head">
            <strong>Apariencia</strong>
            <span class="mini-pill">tema visual</span>
          </div>
          <div class="settings-item">
            <div>
              <strong>Modo de interfaz</strong>
            </div>
            <select data-setting-select="themeMode">
              <option value="dark" ${state.settings.themeMode === 'dark' ? 'selected' : ''}>Oscuro</option>
              <option value="light" ${state.settings.themeMode === 'light' ? 'selected' : ''}>Claro</option>
            </select>
          </div>
        </article>
        ${data.settingsOptions.map((section) => `
          <article class="settings-card">
            <div class="panel-head">
              <strong>${escapeHtml(section.section)}</strong>
              <span class="mini-pill">demo funcional</span>
            </div>
            ${section.items.map((item) => item.type === 'toggle' ? `
              <div class="settings-item">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                </div>
                <button class="switch ${state.settings[item.key] ? 'is-on' : ''}" type="button" data-setting-toggle="${escapeHtml(item.key)}" aria-label="${escapeHtml(item.label)}"></button>
              </div>` : `
              <div class="settings-item">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                </div>
                <select data-setting-select="${escapeHtml(item.key)}">
                  ${item.options.map((option) => `<option value="${escapeHtml(optionValue(option))}" ${String(state.settings[item.key]) === String(optionValue(option)) ? 'selected' : ''}>${escapeHtml(optionLabel(option))}</option>`).join('')}
                </select>
              </div>`).join('')}
          </article>`).join('')}`;
    }
    
    function renderTeamModal() {
      const mount = $('[data-team-modal-grid]');
      if (!mount) return;
      mount.innerHTML = data.teamMembers.map((member) => `
        <article class="team-modal-card panel-card">
          <img src="${escapeHtml(member.avatar)}" alt="${escapeHtml(member.name)}">
          <strong>${escapeHtml(member.name)}</strong>
          <span>${escapeHtml(member.role)}</span>
          <small>${escapeHtml(member.code)}</small>
          <p>${escapeHtml(member.bio)}</p>
        </article>`).join('');
    }
    
    function renderScanner(eventId) {
      const item = eventFor(eventId);
      const overlay = $('[data-scanner-overlay]');
      if (overlay) overlay.dataset.eventId = item.id;
      $('[data-scanner-title]').textContent = item.name;
      $('[data-scanner-poster]').src = item.poster;
      $('[data-scanner-poster]').alt = item.name;
      $('[data-scanner-qr]').src = item.qr;
      $('[data-scanner-qr]').alt = `QR ${item.name}`;
      $('[data-scanner-copy]').textContent = `${item.place} · ${item.time} · +${item.reward} XP`;
      $('[data-open-qr-page]').href = `qr-checkin.html?event=${item.id}`;
    }
    
    function renderLiveAudioState() {
      const state = getState();
      const artist = selectedArtist(state);
      const snapshot = getAudioSnapshot(artist.id);
      const current = $('[data-player-current]');
      const total = $('[data-player-total]');
      const range = $('[data-player-range]');
      const nowPlayingProgress = $('[data-now-playing-progress]');
      if (current) current.textContent = formatTime(snapshot.currentTime);
      if (total) total.textContent = formatTime(snapshot.total);
      if (range) {
        range.max = String(snapshot.total);
        range.value = String(snapshot.currentTime);
      }
      if (nowPlayingProgress) {
        nowPlayingProgress.style.width = `${Math.min(100, snapshot.currentTime / Math.max(1, snapshot.total) * 100)}%`;
      }
      const toggle = $('[data-player-toggle]');
      if (toggle) toggle.textContent = snapshot.isPlaying ? 'Pausar' : 'Reproducir';
    }
    
    function renderAll() {
      const state = getState();
      renderShellProfile(state);
      renderHero(state);
      renderCapsuleFeed(state);
      renderSavedBoard(state);
      renderDiscoverTags(state);
      renderPlayer(state);
      renderEvents(state);
      renderPlaylistCard(state);
      renderShares(state);
      renderLeaderboards(state);
      renderProfile(state);
      renderNowPlaying(state);
      renderMissions(state);
      renderStamps('[data-stamps-grid-rail]', state);
      renderLoginCards(state);
      renderTeamModal();
      if ($('[data-settings-overlay]')?.classList.contains('is-open')) {
        renderSettings(state);
      }
      const scannerOverlay = $('[data-scanner-overlay]');
      if (scannerOverlay?.dataset.eventId) {
        renderScanner(scannerOverlay.dataset.eventId);
      }
    }
    
    export {
      renderAll,
      renderLiveAudioState,
      renderLoginCards,
      renderNowPlaying,
      renderPlayerFeedback,
      renderScanner,
      renderSettings,
      renderTeamModal
    };


    