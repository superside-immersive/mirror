/**
 * state-manager — UI state machine
 * States: searching → found → captured
 * Drives all DOM transitions and the progress bar.
 */
(function () {
  'use strict'

  var STATES = {
    SEARCHING: 'searching',
    FOUND: 'found',
    CAPTURED: 'captured',
  }

  window.AMC = window.AMC || {}

  window.AMC.StateManager = {
    current: null,

    init: function () {
      this.els = {
        titleBlock: document.getElementById('title-block'),
        ctaSearch: document.getElementById('cta-search'),
        ctaFound: document.getElementById('cta-found'),
        captureCard: document.getElementById('capture-card'),
        foundIndicator: document.getElementById('found-indicator'),
        steps: document.querySelectorAll('#progress .step'),
        lines: document.querySelectorAll('#progress .line'),
      }

      // Start hidden and only reveal CTA once camera permission/session is ready.
      this.cameraReady = false
      this.els.ctaSearch.classList.remove('active')
      this.els.titleBlock.style.opacity = '0'

      this.setState(STATES.SEARCHING)

      window.addEventListener('couch-found', this.onCouchFound.bind(this))
      window.addEventListener('photo-captured', this.onPhotoCaptured.bind(this))

      var scene = document.querySelector('a-scene')
      if (scene) {
        scene.addEventListener('camerastatuschange', this.onCameraStatusChange.bind(this))
      }
    },

    setState: function (state) {
      if (this.current === state) return
      this.current = state

      switch (state) {
        case STATES.SEARCHING:
          this.showSearching()
          this.setStep(0)
          break
        case STATES.FOUND:
          this.showFound()
          this.setStep(1)
          break
        case STATES.CAPTURED:
          this.showCaptured()
          this.setStep(3)
          break
      }
    },

    /* ---- View transitions ---- */

    showSearching: function () {
      this.els.titleBlock.style.display = 'block'
      this.els.titleBlock.style.opacity = this.cameraReady ? '1' : '0'
      if (this.cameraReady) this.els.ctaSearch.classList.add('active')
      this.els.ctaFound.classList.remove('active')
      this.els.captureCard.classList.remove('active')
      this.els.foundIndicator.classList.remove('active')
    },

    showFound: function () {
      this.els.ctaSearch.classList.remove('active')
      this.els.titleBlock.style.opacity = '0'

      // Show lock-on indicator
      this.els.foundIndicator.classList.add('active')

      // Show manual snap button immediately once the couch is found.
      this.els.ctaFound.classList.add('active')
    },

    showCaptured: function () {
      this.els.ctaFound.classList.remove('active')
      this.els.foundIndicator.classList.remove('active')

      // Wait for flash to finish
      var self = this
      setTimeout(function () {
        self.els.captureCard.classList.add('active')
      }, 450)
    },

    /* ---- Progress bar ---- */

    setStep: function (idx) {
      var steps = this.els.steps
      var lines = this.els.lines

      for (var i = 0; i < steps.length; i++) {
        steps[i].classList.remove('active', 'completed')
        if (i < idx) {
          steps[i].classList.add('completed')
        } else if (i === idx) {
          steps[i].classList.add('active')
        }
      }

      for (var j = 0; j < lines.length; j++) {
        if (j < idx) {
          lines[j].classList.add('filled')
        } else {
          lines[j].classList.remove('filled')
        }
      }
    },

    /* ---- Event handlers ---- */

    onCouchFound: function () {
      if (!this.cameraReady) return
      this.setState(STATES.FOUND)
    },

    onCameraStatusChange: function (e) {
      var status = e && e.detail && e.detail.status
      if (!status || this.cameraReady) return

      if (status === 'hasStream' || status === 'hasVideo' || status === 'hasDesktop3D') {
        this.cameraReady = true
        if (this.current === STATES.SEARCHING) {
          this.els.ctaSearch.classList.add('active')
          this.els.titleBlock.style.opacity = '1'
        }
      }
    },

    onPhotoCaptured: function (e) {
      var data = e.detail && e.detail.imageData
      if (data) {
        document.getElementById('captured-photo').src = data
      }
      this.setState(STATES.CAPTURED)
    },
  }
})()
