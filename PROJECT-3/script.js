const appShell = document.querySelector('#app-shell');
const loginScreen = document.querySelector('#login-screen');
const callOverlay = document.querySelector('#call-overlay');
const toast = document.querySelector('#toast');
const voiceCards = [...document.querySelectorAll('.voice-card')];
let selectedVoice = 'Natural Female';
let timerInterval = null;
let callStartedAt = 0;
let toastTimeout = null;
let demoTones = '';
let historyItems = JSON.parse(localStorage.getItem('voiceshift-history') || '[]');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function displayPhone(value) {
  const phone = value.trim();
  if (!phone) return 'Not set';
  if (phone.startsWith('+')) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `+1 ${phone}`;
}

function enterWorkspace(phone) {
  loginScreen.hidden = true;
  appShell.classList.add('visible');
  appShell.setAttribute('aria-hidden', 'false');
  const digits = phone.replace(/\D/g, '');
  const myNumber = document.querySelector('#my-number');
  myNumber.value = digits.length >= 10 ? `${digits.slice(-10, -7)} ${digits.slice(-7, -4)} ${digits.slice(-4)}` : phone;
  document.querySelector('#caller-display').textContent = displayPhone(myNumber.value);
  document.querySelector('#account-name').textContent = 'Personal account';
  renderHistory();
}

document.querySelector('#login-form').addEventListener('submit', event => {
  event.preventDefault();
  const phone = document.querySelector('#login-phone').value.trim();
  const password = document.querySelector('#login-password').value;
  if (phone.replace(/\D/g, '').length < 7 || password.length < 4) {
    document.querySelector('#login-error').textContent = 'Enter a valid phone number and a password of at least 4 characters.';
    return;
  }
  if (document.querySelector('#remember-me').checked) localStorage.setItem('voiceshift-remembered-phone', phone);
  else localStorage.removeItem('voiceshift-remembered-phone');
  enterWorkspace(phone);
});

document.querySelector('#create-account').addEventListener('click', () => {
  showToast('Account creation requires a secure backend integration. Use a demo phone number to preview the workspace.');
  document.querySelector('#login-phone').focus();
});

const rememberedPhone = localStorage.getItem('voiceshift-remembered-phone');
if (rememberedPhone) {
  document.querySelector('#login-phone').value = rememberedPhone;
  document.querySelector('#remember-me').checked = true;
}

voiceCards.forEach(card => {
  card.querySelector('.select-button').addEventListener('click', () => {
    selectedVoice = card.dataset.voice;
    voiceCards.forEach(option => {
      const isSelected = option === card;
      option.classList.toggle('selected', isSelected);
      option.querySelector('.select-button').textContent = isSelected ? 'Selected' : 'Select';
    });
  });
  card.querySelector('.preview-button').addEventListener('click', () => {
    showToast(`${card.dataset.voice} preview needs the AI voice generation service; it is not connected in this prototype.`);
  });
});

const callVoicePicker = document.querySelector('#call-voice-picker');
document.querySelector('#change-voice').addEventListener('click', event => {
  callVoicePicker.hidden = !callVoicePicker.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!callVoicePicker.hidden));
});
document.querySelectorAll('[data-call-voice]').forEach(button => {
  button.addEventListener('click', () => {
    selectedVoice = button.dataset.callVoice;
    document.querySelector('#call-voice').textContent = selectedVoice;
    voiceCards.forEach(card => {
      const isSelected = card.dataset.voice === selectedVoice;
      card.classList.toggle('selected', isSelected);
      card.querySelector('.select-button').textContent = isSelected ? 'Selected' : 'Select';
    });
    callVoicePicker.hidden = true;
    document.querySelector('#change-voice').setAttribute('aria-expanded', 'false');
    showToast('Demo voice selection changed. Live audio conversion is not connected.');
  });
});

document.querySelector('#realism-range').addEventListener('input', event => {
  document.querySelector('#realism-value').textContent = `${event.target.value}%`;
});

const recipientPad = document.querySelector('#recipient-dialpad');
const recipientInput = document.querySelector('#recipient-number');
document.querySelector('#toggle-dialpad').addEventListener('click', () => {
  recipientPad.hidden = !recipientPad.hidden;
  document.querySelector('#toggle-dialpad').setAttribute('aria-expanded', String(!recipientPad.hidden));
});
document.querySelectorAll('[data-recipient-key]').forEach(button => {
  button.addEventListener('click', () => {
    recipientInput.value += button.dataset.recipientKey;
    recipientInput.focus();
  });
});
document.querySelector('[data-recipient-action="backspace"]').addEventListener('click', () => {
  recipientInput.value = recipientInput.value.slice(0, -1);
  recipientInput.focus();
});
document.querySelector('#clear-recipient').addEventListener('click', () => {
  recipientInput.value = '';
  recipientInput.focus();
});

document.querySelector('#my-number').addEventListener('input', event => {
  document.querySelector('#caller-display').textContent = displayPhone(event.target.value);
});

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function startCall() {
  const recipient = document.querySelector('#recipient-number').value.trim();
  if (recipient.replace(/\D/g, '').length < 7) {
    document.querySelector('#recipient-number').focus();
    showToast('Enter a valid recipient phone number to preview the call screen.');
    return;
  }
  const ownNumber = document.querySelector('#my-number').value.trim();
  if (ownNumber.replace(/\D/g, '').length < 7) {
    document.querySelector('#my-number').focus();
    showToast('Set a phone number you own or are authorized to use as caller ID.');
    return;
  }
  if (!document.querySelector('#caller-authorized').checked) {
    document.querySelector('#caller-authorized').focus();
    showToast('Confirm that you own or are authorized to use this caller ID number.');
    return;
  }
  document.querySelector('#call-recipient').textContent = `From ${displayPhone(ownNumber)}\nTo ${displayPhone(recipient)}`;
  document.querySelector('#call-voice').textContent = selectedVoice;
  demoTones = '';
  document.querySelector('#dialpad-display').textContent = 'No tones entered';
  document.querySelector('#call-dialpad').hidden = true;
  document.querySelector('#keypad-control').setAttribute('aria-expanded', 'false');
  document.querySelector('#call-status').textContent = 'CONNECTING...';
  document.querySelector('#call-timer').textContent = '00:00';
  callOverlay.classList.add('open');
  callOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  callStartedAt = Date.now();
  window.setTimeout(() => {
    if (callOverlay.classList.contains('open')) document.querySelector('#call-status').textContent = 'DEMO CALL ACTIVE';
  }, 1800);
  timerInterval = window.setInterval(() => {
    document.querySelector('#call-timer').textContent = formatDuration(Math.floor((Date.now() - callStartedAt) / 1000));
  }, 1000);
}

function finishCall() {
  if (!callOverlay.classList.contains('open')) return;
  clearInterval(timerInterval);
  const duration = Math.floor((Date.now() - callStartedAt) / 1000);
  historyItems.unshift({
    caller: displayPhone(document.querySelector('#my-number').value),
    recipient: displayPhone(document.querySelector('#recipient-number').value),
    voice: selectedVoice,
    duration: formatDuration(duration),
    date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  });
  historyItems = historyItems.slice(0, 8);
  localStorage.setItem('voiceshift-history', JSON.stringify(historyItems));
  renderHistory();
  callOverlay.classList.remove('open');
  callOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  showToast('Demo call ended. No phone call was placed.');
}

function renderHistory() {
  const list = document.querySelector('#history-list');
  if (!historyItems.length) {
    list.innerHTML = '<div class="history-empty"><span>◷</span><b>Your calls will show up here</b><small>Call history in this prototype is stored only in this browser.</small></div>';
    return;
  }
  list.innerHTML = historyItems.map(item => `<div class="history-row"><span class="history-call-icon">↗</span><span class="history-details"><b>${item.recipient}</b><small>From ${item.caller || 'Not set'} · ${item.date} · Demo call</small></span><span class="history-voice">${item.voice}</span><span class="history-duration">${item.duration}</span></div>`).join('');
}

document.querySelector('#start-call').addEventListener('click', startCall);
document.querySelector('#end-call').addEventListener('click', finishCall);
document.querySelector('#close-call').addEventListener('click', finishCall);
callOverlay.addEventListener('click', event => { if (event.target === callOverlay) finishCall(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') finishCall(); });

document.querySelectorAll('.call-control').forEach(button => {
  button.addEventListener('click', () => {
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(enabled));
    button.classList.toggle('active', !enabled);
    if (button.id === 'keypad-control') {
      document.querySelector('#call-dialpad').hidden = !enabled;
      button.setAttribute('aria-expanded', String(enabled));
    }
    if (button.id === 'voice-control') button.querySelector('small').textContent = enabled ? 'Voice on' : 'Voice off';
    if (button.id === 'mute-control') button.querySelector('small').textContent = enabled ? 'Mute' : 'Muted';
    if (button.id === 'mic-control' && enabled) showToast('Microphone access requires browser permission and a connected call service.');
  });
});

document.querySelectorAll('[data-tone]').forEach(button => {
  button.addEventListener('click', () => {
    demoTones += button.dataset.tone;
    document.querySelector('#dialpad-display').textContent = demoTones;
  });
});

document.querySelector('#clear-history').addEventListener('click', () => {
  historyItems = [];
  localStorage.removeItem('voiceshift-history');
  renderHistory();
});

document.querySelector('#remember-setting').addEventListener('change', event => {
  document.querySelector('#remember-me').checked = event.target.checked;
  showToast(event.target.checked ? 'Remember this device is enabled.' : 'Remember this device is disabled.');
});

document.querySelector('#remember-me').addEventListener('change', event => {
  document.querySelector('#remember-setting').checked = event.target.checked;
});

document.querySelector('#help-button').addEventListener('click', () => showToast('Frontend prototype only: calls, voice conversion, microphone access, routing, and number verification are not connected.'));
document.querySelector('#voice-info').addEventListener('click', () => showToast('Use fictional AI voices only. Do not clone a real person without their explicit permission.'));
document.querySelector('#account-button').addEventListener('click', () => showToast('Account management will be available when authentication is connected.'));
renderHistory();
