const drafts = {};
let updateCallback = () => {};

const recorderState = {
  status: 'idle',
  artistId: '',
  seconds: 0,
  error: '',
  recorder: null,
  stream: null,
  chunks: [],
  timer: null
};

function notifyUpdate() {
  updateCallback();
}

function setReviewUpdateCallback(callback) {
  updateCallback = typeof callback === 'function' ? callback : () => {};
}

function ensureDraft(artistId) {
  if (!drafts[artistId]) {
    drafts[artistId] = {
      rating: 0,
      text: '',
      voiceNote: null
    };
  }
  return drafts[artistId];
}

function getDraft(artistId) {
  return ensureDraft(artistId);
}

function updateDraft(artistId, patch = {}) {
  const draft = ensureDraft(artistId);
  drafts[artistId] = Object.assign({}, draft, patch);
  return drafts[artistId];
}

function clearDraft(artistId) {
  drafts[artistId] = {
    rating: 0,
    text: '',
    voiceNote: null
  };
  if (recorderState.artistId === artistId && recorderState.status !== 'idle') {
    discardVoiceDraft(artistId);
  }
  notifyUpdate();
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el audio grabado.'));
    reader.readAsDataURL(blob);
  });
}

function pickMimeType() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return options.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

function stopRecorderTimer() {
  clearInterval(recorderState.timer);
  recorderState.timer = null;
}

function cleanupRecorderState() {
  stopRecorderTimer();
  recorderState.chunks = [];
  recorderState.seconds = 0;
  if (recorderState.stream) {
    recorderState.stream.getTracks().forEach((track) => track.stop());
  }
  recorderState.stream = null;
  recorderState.recorder = null;
  recorderState.status = 'idle';
  recorderState.artistId = '';
  recorderState.error = '';
}

async function startVoiceRecording(artistId) {
  const draft = ensureDraft(artistId);
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    draft.voiceNote = null;
    recorderState.error = 'Tu navegador no soporta grabación de voz en esta demo.';
    recorderState.status = 'error';
    recorderState.artistId = artistId;
    notifyUpdate();
    return false;
  }
  if (recorderState.status === 'recording') {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderState.stream = stream;
    recorderState.recorder = recorder;
    recorderState.chunks = [];
    recorderState.seconds = 0;
    recorderState.error = '';
    recorderState.artistId = artistId;
    recorderState.status = 'recording';

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size) {
        recorderState.chunks.push(event.data);
      }
    });

    recorder.addEventListener('stop', async () => {
      if (!recorderState.chunks.length) {
        cleanupRecorderState();
        notifyUpdate();
        return;
      }
      const duration = recorderState.seconds;
      const blob = new Blob(recorderState.chunks, { type: recorder.mimeType || 'audio/webm' });
      const dataUrl = await readBlobAsDataUrl(blob);
      updateDraft(artistId, {
        voiceNote: {
          dataUrl,
          duration
        }
      });
      cleanupRecorderState();
      notifyUpdate();
    });

    recorder.start();
    recorderState.timer = setInterval(() => {
      recorderState.seconds += 1;
      if (recorderState.seconds >= 30) {
        stopVoiceRecording();
      }
      notifyUpdate();
    }, 1000);

    notifyUpdate();
    return true;
  } catch (error) {
    recorderState.error = 'No se pudo acceder al micrófono.';
    recorderState.status = 'error';
    recorderState.artistId = artistId;
    notifyUpdate();
    return false;
  }
}

function stopVoiceRecording() {
  if (recorderState.status !== 'recording' || !recorderState.recorder) return;
  recorderState.status = 'processing';
  stopRecorderTimer();
  recorderState.recorder.stop();
  notifyUpdate();
}

function discardVoiceDraft(artistId) {
  const draft = ensureDraft(artistId);
  draft.voiceNote = null;
  if (recorderState.artistId === artistId) {
    if (recorderState.status === 'recording' && recorderState.recorder) {
      recorderState.recorder.onstop = null;
      recorderState.recorder.stop();
    }
    cleanupRecorderState();
  }
  notifyUpdate();
}

function buildDraftReview(artistId, profileId) {
  const draft = ensureDraft(artistId);
  const rating = Math.max(0, Math.min(5, Number(draft.rating || 0)));
  const comment = typeof draft.text === 'string' ? draft.text.trim().slice(0, 220) : '';
  const voiceNote = draft.voiceNote?.dataUrl ? {
    dataUrl: draft.voiceNote.dataUrl,
    duration: Math.max(0, Number(draft.voiceNote.duration || 0))
  } : null;
  if (!rating && !comment && !voiceNote) return null;
  return {
    id: `review-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    profileId,
    rating,
    comment,
    voiceNote,
    createdAt: new Date().toISOString()
  };
}


function resetReviewDrafts() {
  Object.keys(drafts).forEach((artistId) => {
    delete drafts[artistId];
  });
  if (recorderState.status === 'recording' && recorderState.recorder) {
    recorderState.recorder.onstop = null;
    recorderState.recorder.stop();
  }
  cleanupRecorderState();
  notifyUpdate();
}

function getRecorderSnapshot(artistId) {
  if (recorderState.artistId !== artistId) {
    return {
      status: 'idle',
      seconds: 0,
      error: '',
      isCurrentArtist: false
    };
  }
  return {
    status: recorderState.status,
    seconds: recorderState.seconds,
    error: recorderState.error,
    isCurrentArtist: true
  };
}

export {
  buildDraftReview,
  clearDraft,
  discardVoiceDraft,
  getDraft,
  getRecorderSnapshot,
  resetReviewDrafts,
  setReviewUpdateCallback,
  startVoiceRecording,
  stopVoiceRecording,
  updateDraft
};
