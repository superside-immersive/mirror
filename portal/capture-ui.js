(function () {
  var STYLE_ID = 'amc-capture-style';
  var ROOT_ID = 'amc-capture-root';
  var VIDEO_MAX_MS = 10000;
  var HOLD_DELAY_MS = 350;
  var TOAST_MS = 2600;
  var PERMISSION_SELECTORS = [
    '#requestingCameraPermissions',
    '#requestingCameraIcon',
    '#cameraPermissionsErrorApple',
    '#cameraPermissionsErrorAndroid',
    '#microphonePermissionsErrorApple',
    '#microphonePermissionsErrorAndroid',
    '#cameraSelectionWorldTrackingError',
    '.prompt-box-8w',
    '.prompt-button-8w',
    '.permission-error',
    '.permissionIcon'
  ];

  var state = {
    root: null,
    shutter: null,
    timer: null,
    timerValue: null,
    preview: null,
    previewMedia: null,
    previewTitle: null,
    shareButton: null,
    downloadButton: null,
    toast: null,
    holdTimer: null,
    recording: false,
    awaitingRecording: false,
    pendingStop: false,
    busy: false,
    ready: false,
    currentCapture: null,
    objectUrl: null,
    mutationObserver: null,
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      ':root {',
      '  --amc-blue: #003E7E;',
      '  --amc-blue-strong: #0A4F99;',
      '  --amc-white: #FFFFFF;',
      '  --amc-ink: rgba(5, 10, 22, 0.92);',
      '  --amc-glass: rgba(7, 18, 36, 0.72);',
      '  --amc-line: rgba(255, 255, 255, 0.18);',
      '  --amc-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);',
      '}',
      PERMISSION_SELECTORS.join(',\n') + ' { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }',
      '#' + ROOT_ID + ' { position: fixed; inset: 0; z-index: 60; pointer-events: none; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--amc-white); }',
      '#' + ROOT_ID + ' * { box-sizing: border-box; }',
      '.amc-brand-lockup { position: fixed; top: 16px; left: 16px; z-index: 3; width: clamp(132px, 26vw, 190px); padding: 12px 14px; border: 1px solid rgba(255,255,255,0.16); border-radius: 18px; background: rgba(0, 25, 56, 0.42); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: var(--amc-shadow); pointer-events: none; }',
      '.amc-brand-lockup img { display: block; width: 100%; height: auto; filter: brightness(0) invert(1); }',
      '.amc-capture-dock { position: fixed; left: 50%; bottom: max(22px, env(safe-area-inset-bottom, 0px) + 10px); transform: translateX(-50%); z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 12px; pointer-events: none; }',
      '.amc-capture-timer { min-width: 96px; padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.16); background: rgba(5, 10, 22, 0.58); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); text-align: center; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; opacity: 0; transform: translateY(8px); transition: opacity 180ms ease, transform 180ms ease; }',
      '.amc-capture-timer.is-visible { opacity: 1; transform: translateY(0); }',
      '.amc-shutter { position: relative; display: grid; place-items: center; width: 86px; height: 86px; border: 0; border-radius: 999px; padding: 0; background: transparent; pointer-events: auto; touch-action: manipulation; cursor: pointer; }',
      '.amc-shutter:disabled { cursor: default; }',
      '.amc-shutter__ring { position: absolute; inset: 0; border-radius: 999px; border: 3px solid rgba(255,255,255,0.95); box-shadow: 0 0 0 1px rgba(0,62,126,0.25) inset; transition: transform 120ms ease, border-color 120ms ease; }',
      '.amc-shutter__core { position: relative; width: 60px; height: 60px; border-radius: 999px; background: var(--amc-white); box-shadow: 0 8px 24px rgba(0,0,0,0.28); transition: transform 120ms ease, border-radius 120ms ease, background 120ms ease; }',
      '.amc-shutter.is-armed .amc-shutter__ring { transform: scale(0.96); }',
      '.amc-shutter.is-armed .amc-shutter__core { transform: scale(0.94); }',
      '.amc-shutter.is-recording .amc-shutter__ring { border-color: rgba(255,255,255,0.72); animation: amcPulse 1.1s ease-in-out infinite; }',
      '.amc-shutter.is-recording .amc-shutter__core { width: 34px; height: 34px; border-radius: 12px; background: #ff4d4d; }',
      '.amc-shutter.is-busy .amc-shutter__core { background: rgba(255,255,255,0.62); }',
      '.amc-preview { position: fixed; inset: 0; z-index: 8; display: none; padding: max(16px, env(safe-area-inset-top, 0px) + 6px) 16px max(16px, env(safe-area-inset-bottom, 0px) + 6px); background: rgba(4, 8, 18, 0.86); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); pointer-events: auto; }',
      '.amc-preview.is-open { display: flex; align-items: center; justify-content: center; }',
      '.amc-preview__panel { width: min(100%, 460px); max-height: 100%; display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 28px; background: linear-gradient(180deg, rgba(6, 20, 43, 0.96), rgba(5, 13, 28, 0.96)); border: 1px solid var(--amc-line); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.34); }',
      '.amc-preview__topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }',
      '.amc-preview__title { margin: 0; font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }',
      '.amc-icon-button { display: inline-flex; align-items: center; justify-content: center; min-width: 42px; height: 42px; padding: 0 14px; border: 1px solid rgba(255,255,255,0.16); border-radius: 999px; background: rgba(255,255,255,0.06); color: var(--amc-white); font: inherit; font-size: 0.85rem; font-weight: 700; text-decoration: none; cursor: pointer; }',
      '.amc-icon-button:hover { background: rgba(255,255,255,0.12); }',
      '.amc-preview__media-shell { position: relative; overflow: hidden; border-radius: 22px; background: rgba(255,255,255,0.04); aspect-ratio: 9 / 16; min-height: 320px; }',
      '.amc-preview__media-shell img, .amc-preview__media-shell video { display: block; width: 100%; height: 100%; object-fit: cover; background: #02060e; }',
      '.amc-preview__actions { display: flex; flex-wrap: wrap; gap: 10px; }',
      '.amc-preview__actions .is-primary { background: var(--amc-blue); border-color: transparent; }',
      '.amc-preview__socials { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }',
      '.amc-social { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: var(--amc-white); font-size: 0.92rem; font-weight: 700; text-decoration: none; cursor: pointer; }',
      '.amc-social:hover { background: rgba(255,255,255,0.1); }',
      '.amc-preview__note { margin: 0; color: rgba(255,255,255,0.74); font-size: 0.82rem; line-height: 1.35; }',
      '.amc-toast { position: fixed; left: 50%; bottom: calc(max(124px, env(safe-area-inset-bottom, 0px) + 112px)); transform: translateX(-50%) translateY(12px); padding: 12px 16px; border-radius: 16px; background: rgba(5, 10, 22, 0.92); border: 1px solid rgba(255,255,255,0.16); color: var(--amc-white); font-size: 0.82rem; line-height: 1.35; box-shadow: var(--amc-shadow); opacity: 0; pointer-events: none; transition: opacity 180ms ease, transform 180ms ease; }',
      '.amc-toast.is-visible { opacity: 1; transform: translateX(-50%) translateY(0); }',
      '@keyframes amcPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }',
      '@media (max-width: 600px) {',
      '  .amc-brand-lockup { width: min(158px, calc(100vw - 32px)); }',
      '  .amc-preview__panel { width: 100%; padding: 14px; border-radius: 24px; }',
      '  .amc-preview__media-shell { min-height: 280px; }',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function formatTimer(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    var minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    var seconds = String(totalSeconds % 60).padStart(2, '0');
    return minutes + ':' + seconds;
  }

  function buildShareText() {
    return 'Captured in the Albertsons portal experience';
  }

  function buildShareUrl() {
    return window.location.href;
  }

  function revokeObjectUrl() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
  }

  function clearPreviewMedia() {
    revokeObjectUrl();
    if (state.previewMedia) {
      state.previewMedia.innerHTML = '';
    }
  }

  function setBusy(nextBusy) {
    state.busy = nextBusy;
    if (state.shutter) {
      state.shutter.disabled = !state.ready || nextBusy;
      state.shutter.classList.toggle('is-busy', nextBusy);
    }
  }

  function setReady(nextReady) {
    state.ready = nextReady;
    if (state.shutter) {
      state.shutter.disabled = !nextReady || state.busy;
    }
  }

  function showToast(message) {
    if (!state.toast) {
      return;
    }

    state.toast.textContent = message;
    state.toast.classList.add('is-visible');
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(function () {
      state.toast.classList.remove('is-visible');
    }, TOAST_MS);
  }

  function fileNameForCapture(capture) {
    if (!capture) {
      return 'portal-capture';
    }

    var date = new Date().toISOString().replace(/[.:]/g, '-');
    var extension = capture.kind === 'photo' ? 'jpg' : (capture.type.indexOf('mp4') !== -1 ? 'mp4' : 'webm');
    return 'albertsons-portal-' + date + '.' + extension;
  }

  function ensureFile(capture) {
    if (!capture) {
      return null;
    }

    if (!capture.file) {
      capture.file = new File([capture.blob], fileNameForCapture(capture), {type: capture.type});
    }

    return capture.file;
  }

  function canNativeShare(capture) {
    var file = ensureFile(capture);
    return !!(navigator.share && navigator.canShare && file && navigator.canShare({files: [file]}));
  }

  function triggerDownload(capture) {
    var file = ensureFile(capture);
    if (!file) {
      return;
    }

    var url = URL.createObjectURL(file);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function blobFromBase64(base64String, mimeType) {
    var binary = atob(base64String);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], {type: mimeType});
  }

  function stopHoldTimer() {
    if (state.holdTimer) {
      window.clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }
  }

  function updateTimer(ms) {
    if (!state.timer || !state.timerValue) {
      return;
    }

    state.timerValue.textContent = formatTimer(ms) + ' / ' + formatTimer(VIDEO_MAX_MS);
    state.timer.classList.add('is-visible');
  }

  function hideTimer() {
    if (!state.timer || !state.timerValue) {
      return;
    }

    state.timer.classList.remove('is-visible');
    state.timerValue.textContent = formatTimer(0) + ' / ' + formatTimer(VIDEO_MAX_MS);
  }

  function openPopup(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openPreview(capture) {
    state.currentCapture = capture;
    clearPreviewMedia();

    state.objectUrl = URL.createObjectURL(capture.blob);
    state.previewTitle.textContent = capture.kind === 'photo' ? 'Photo ready' : 'Video ready';

    var mediaEl;
    if (capture.kind === 'photo') {
      mediaEl = document.createElement('img');
      mediaEl.alt = 'Captured Albertsons portal photo';
      mediaEl.src = state.objectUrl;
    } else {
      mediaEl = document.createElement('video');
      mediaEl.src = state.objectUrl;
      mediaEl.controls = true;
      mediaEl.autoplay = true;
      mediaEl.loop = true;
      mediaEl.muted = true;
      mediaEl.playsInline = true;
    }

    state.previewMedia.appendChild(mediaEl);
    state.preview.classList.add('is-open');
    state.shareButton.disabled = !canNativeShare(capture);
    state.downloadButton.download = fileNameForCapture(capture);
    state.downloadButton.href = state.objectUrl;
  }

  function closePreview() {
    state.preview.classList.remove('is-open');
    state.currentCapture = null;
    clearPreviewMedia();
  }

  function nativeShare(shareHint) {
    if (!state.currentCapture || !canNativeShare(state.currentCapture)) {
      showToast('Native share is not available on this device.');
      return Promise.resolve(false);
    }

    var file = ensureFile(state.currentCapture);
    return navigator.share({
      files: [file],
      title: 'Albertsons portal',
      text: buildShareText(),
    }).then(function () {
      if (shareHint) {
        showToast(shareHint);
      }
      return true;
    }).catch(function (error) {
      if (error && error.name !== 'AbortError') {
        showToast('Share did not complete.');
      }
      return false;
    });
  }

  function configureRecorder() {
    if (!window.XR8 || !window.XR8.MediaRecorder) {
      return;
    }

    // Register the pipeline module so recordVideo() can initialize its recorder.
    // Must happen before 'runreality' is emitted. Guard against double-registration.
    if (window.XR8.MediaRecorder.pipelineModule && !window.__amcMediaRecorderAttached) {
      window.__amcMediaRecorderAttached = true;
      window.XR8.addCameraPipelineModules([window.XR8.MediaRecorder.pipelineModule()]);
    }

    window.XR8.MediaRecorder.configure({
      maxDurationMs: VIDEO_MAX_MS,
      enableEndCard: false,
      requestMic: window.XR8.MediaRecorder.RequestMicOptions
        ? window.XR8.MediaRecorder.RequestMicOptions.MANUAL
        : 'manual',
    });
  }

  function capturePhoto() {
    if (!window.XR8 || !window.XR8.CanvasScreenshot || state.busy || !state.ready) {
      return;
    }

    setBusy(true);
    window.XR8.CanvasScreenshot.takeScreenshot().then(function (base64Image) {
      var blob = blobFromBase64(base64Image, 'image/jpeg');
      setBusy(false);
      openPreview({kind: 'photo', blob: blob, type: 'image/jpeg'});
    }).catch(function () {
      setBusy(false);
      showToast('Photo capture failed.');
    });
  }

  function startRecording() {
    if (!window.XR8 || !window.XR8.MediaRecorder || state.busy || !state.ready || state.recording) {
      return;
    }

    stopHoldTimer();
    state.awaitingRecording = true;
    state.pendingStop = false;
    setBusy(true);

    try {
      window.XR8.MediaRecorder.recordVideo({
        onStart: function () {
          state.awaitingRecording = false;
          state.recording = true;
          setBusy(false);
          state.shutter.classList.add('is-recording');
          updateTimer(0);
          if (state.pendingStop) {
            state.pendingStop = false;
            stopRecording();
          }
        },
        onStop: function () {
          state.shutter.classList.remove('is-recording');
        },
        onVideoReady: function (result) {
          state.awaitingRecording = false;
          state.recording = false;
          setBusy(false);
          hideTimer();
          openPreview({kind: 'video', blob: result.videoBlob, type: result.videoBlob.type || 'video/webm'});
        },
        onFinalizeProgress: function () {
          setBusy(true);
        },
        onError: function () {
          state.awaitingRecording = false;
          state.pendingStop = false;
          state.recording = false;
          state.shutter.classList.remove('is-recording');
          hideTimer();
          setBusy(false);
          showToast('Video capture failed.');
        },
        onProcessFrame: function (info) {
          updateTimer(info.elapsedTimeMs || 0);
        },
      });
    } catch (error) {
      state.awaitingRecording = false;
      state.recording = false;
      setBusy(false);
      showToast('Video capture is not ready yet.');
    }
  }

  function stopRecording() {
    if (state.awaitingRecording) {
      state.pendingStop = true;
      return;
    }

    if (!state.recording || !window.XR8 || !window.XR8.MediaRecorder) {
      return;
    }

    setBusy(true);
    try {
      window.XR8.MediaRecorder.stopRecording();
    } catch (error) {
      state.recording = false;
      state.shutter.classList.remove('is-recording');
      hideTimer();
      setBusy(false);
      showToast('Could not stop recording cleanly.');
    }
  }

  function attachShutterHandlers() {
    function armShutter() {
      if (state.busy || !state.ready || state.preview.classList.contains('is-open')) {
        return;
      }

      state.shutter.classList.add('is-armed');
      stopHoldTimer();
      state.holdTimer = window.setTimeout(function () {
        startRecording();
      }, HOLD_DELAY_MS);
    }

    function releaseShutter() {
      state.shutter.classList.remove('is-armed');
      if (state.recording) {
        stopRecording();
        return;
      }

      if (state.holdTimer) {
        stopHoldTimer();
        capturePhoto();
      }
    }

    state.shutter.addEventListener('pointerdown', armShutter);
    state.shutter.addEventListener('pointerup', releaseShutter);
    state.shutter.addEventListener('pointercancel', function () {
      state.shutter.classList.remove('is-armed');
      stopHoldTimer();
      if (state.recording) {
        stopRecording();
      }
    });
  }

  function attachPreviewHandlers() {
    state.preview.querySelector('[data-action="retake"]').addEventListener('click', function () {
      closePreview();
    });

    state.shareButton.addEventListener('click', function () {
      nativeShare();
    });

    state.preview.querySelector('[data-social="instagram"]').addEventListener('click', function () {
      if (!state.currentCapture) {
        return;
      }

      if (canNativeShare(state.currentCapture)) {
        nativeShare('Choose Instagram in the share sheet.');
        return;
      }

      triggerDownload(state.currentCapture);
      showToast('Instagram upload requires the saved file from your gallery.');
    });

    state.preview.querySelector('[data-social="whatsapp"]').addEventListener('click', function () {
      if (!state.currentCapture) {
        return;
      }

      if (canNativeShare(state.currentCapture)) {
        nativeShare('Choose WhatsApp in the share sheet.');
        return;
      }

      openPopup('https://wa.me/?text=' + encodeURIComponent(buildShareText() + ' ' + buildShareUrl()));
    });

    state.preview.querySelector('[data-social="twitter"]').addEventListener('click', function () {
      openPopup('https://twitter.com/intent/tweet?text=' + encodeURIComponent(buildShareText()) + '&url=' + encodeURIComponent(buildShareUrl()));
    });

    state.preview.querySelector('[data-social="linkedin"]').addEventListener('click', function () {
      openPopup('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(buildShareUrl()));
    });

    state.downloadButton.addEventListener('click', function (event) {
      event.preventDefault();
      if (state.currentCapture) {
        triggerDownload(state.currentCapture);
      }
    });
  }

  function createRoot() {
    if (state.root || document.getElementById(ROOT_ID)) {
      state.root = document.getElementById(ROOT_ID);
      return;
    }

    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = [
      '<div class="amc-brand-lockup">',
      '  <img src="./assets/common/amc-logo.svg" alt="Albertsons Media Collective">',
      '</div>',
      '<div class="amc-capture-dock">',
      '  <div class="amc-capture-timer"><span data-role="timer-value">00:00 / 00:10</span></div>',
      '  <button class="amc-shutter" type="button" aria-label="Take a photo or hold to record video" disabled>',
      '    <span class="amc-shutter__ring"></span>',
      '    <span class="amc-shutter__core"></span>',
      '  </button>',
      '</div>',
      '<div class="amc-preview" aria-modal="true" role="dialog">',
      '  <div class="amc-preview__panel">',
      '    <div class="amc-preview__topbar">',
      '      <h2 class="amc-preview__title">Capture ready</h2>',
      '      <button class="amc-icon-button" type="button" data-action="retake">Retake</button>',
      '    </div>',
      '    <div class="amc-preview__media-shell" data-role="preview-media"></div>',
      '    <div class="amc-preview__actions">',
      '      <button class="amc-icon-button is-primary" type="button" data-action="native-share">Share</button>',
      '      <a class="amc-icon-button" href="#" data-action="download">Download</a>',
      '    </div>',
      '    <div class="amc-preview__socials">',
      '      <button class="amc-social" type="button" data-social="instagram">Instagram</button>',
      '      <button class="amc-social" type="button" data-social="linkedin">LinkedIn</button>',
      '      <button class="amc-social" type="button" data-social="twitter">Twitter</button>',
      '      <button class="amc-social" type="button" data-social="whatsapp">WhatsApp</button>',
      '    </div>',
      '    <p class="amc-preview__note">Instagram does not support direct media posting from the browser, so that button falls back to the native share sheet or a download.</p>',
      '  </div>',
      '</div>',
      '<div class="amc-toast" aria-live="polite"></div>',
    ].join('');

    document.body.appendChild(root);

    state.root = root;
    state.shutter = root.querySelector('.amc-shutter');
    state.timer = root.querySelector('.amc-capture-timer');
    state.timerValue = root.querySelector('[data-role="timer-value"]');
    state.preview = root.querySelector('.amc-preview');
    state.previewMedia = root.querySelector('[data-role="preview-media"]');
    state.previewTitle = root.querySelector('.amc-preview__title');
    state.shareButton = root.querySelector('[data-action="native-share"]');
    state.downloadButton = root.querySelector('[data-action="download"]');
    state.toast = root.querySelector('.amc-toast');

    attachShutterHandlers();
    attachPreviewHandlers();
  }

  function scrubPermissionUi() {
    for (var i = 0; i < PERMISSION_SELECTORS.length; i += 1) {
      var nodes = document.querySelectorAll(PERMISSION_SELECTORS[i]);
      for (var index = 0; index < nodes.length; index += 1) {
        nodes[index].style.display = 'none';
        nodes[index].style.visibility = 'hidden';
        nodes[index].style.opacity = '0';
        nodes[index].style.pointerEvents = 'none';
      }
    }
  }

  function attachPermissionObserver() {
    if (state.mutationObserver || !document.body) {
      return;
    }

    state.mutationObserver = new MutationObserver(scrubPermissionUi);
    state.mutationObserver.observe(document.body, {childList: true, subtree: true});
    scrubPermissionUi();
  }

  function bindSceneEvents() {
    var scene = document.querySelector('a-scene');
    if (!scene || scene.__amcCaptureBound) {
      return;
    }

    scene.__amcCaptureBound = true;
    scene.addEventListener('camerastatuschange', function (event) {
      var status = event.detail && event.detail.status;
      setReady(status === 'hasVideo' || status === 'hasDesktop3D');
    });

    scene.addEventListener('realityready', function () {
      setReady(true);
    });
  }

  function init() {
    injectStyles();
    createRoot();
    attachPermissionObserver();
    bindSceneEvents();
    configureRecorder();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true});
  } else {
    init();
  }

  window.addEventListener('xrloaded', function () {
    configureRecorder();
    bindSceneEvents();
  });
})();