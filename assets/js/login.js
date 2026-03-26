import { createFreshState, data, getState, setState } from './modules/state.js';

function saveProfile(profileId) {
  const currentState = getState();
  const nextState = createFreshState({
    profileId,
    loggedIn: true,
    settings: currentState.settings,
    device: currentState.device,
    view: currentState.view,
    artistFeedback: currentState.artistFeedback,
    roleStudio: currentState.roleStudio,
    checkedEventIds: currentState.checkedEventIds,
    completedMissionIds: currentState.completedMissionIds
  });
  setState(nextState);
  window.location.href = 'index.html';
}

function render(items, mountId) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = items.map((profile) => `
    <button class="profile-card" type="button" data-login="${profile.id}">
      <img src="${profile.avatar}" alt="${profile.name}">
      <strong>${profile.name}</strong>
      <span>${profile.role}</span>
      <small>${profile.code}</small>
    </button>`).join('');
}

function initLogin() {
  render(data.teamMembers, 'login-team-grid');
  render(data.demoRoles, 'login-role-grid');
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-login]');
    if (!button) return;
    saveProfile(button.dataset.login);
  });
}

initLogin();