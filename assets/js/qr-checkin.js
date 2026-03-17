import { createFreshState, data, eventFor, getState, setState, syncMissions } from './modules/state.js';

const params = new URLSearchParams(window.location.search);
const eventId = params.get('event') || data.events[0].id;
const eventItem = eventFor(eventId);
const state = getState();

const safeState = state.profileId ? state : createFreshState();

document.getElementById('event-name').textContent = eventItem.name;
document.getElementById('event-poster').src = eventItem.poster;
document.getElementById('event-poster').alt = eventItem.name;
document.getElementById('event-qr').src = eventItem.qr;
document.getElementById('event-qr').alt = `QR ${eventItem.name}`;
document.getElementById('event-copy').textContent = `${eventItem.place} · ${eventItem.time} · +${eventItem.reward} XP`;

const stateBox = document.getElementById('claim-state');
const button = document.getElementById('claim-btn');

function renderClaim() {
  const claimed = safeState.checkedEventIds.includes(eventItem.id);
  stateBox.textContent = claimed ? `Sello obtenido: ${eventItem.stamp}. Ya puedes volver a la app.` : 'Todavía no has reclamado este sello.';
  button.textContent = claimed ? 'Sello reclamado' : 'Reclamar sello y XP';
  button.disabled = claimed;
}

button.addEventListener('click', () => {
  if (!safeState.checkedEventIds.includes(eventItem.id)) {
    safeState.checkedEventIds.push(eventItem.id);
  }
  const { state: syncedState } = syncMissions(safeState);
  Object.assign(safeState, syncedState);
  setState(safeState);
  renderClaim();
});

renderClaim();
