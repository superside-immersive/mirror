/**
 * screen-capture — captures the AR canvas and triggers flash effect
 */
(function () {
  'use strict'

  window.AMC = window.AMC || {}

  window.AMC.ScreenCapture = {
    hasCaptured: false,

    init: function () {
      var snap = document.getElementById('btn-snap')
      var claim = document.getElementById('btn-claim')

      if (snap) snap.addEventListener('click', this.capture.bind(this))
      if (claim) claim.addEventListener('click', this.onClaim.bind(this))
    },

    capture: function () {
      if (this.hasCaptured) return

      var scene = document.querySelector('a-scene')
      if (!scene || !scene.canvas) return

      this.hasCaptured = true

      var snap = document.getElementById('btn-snap')
      if (snap) {
        snap.disabled = true
        snap.classList.add('is-saving')
      }

      this.flash()

      try {
        // Force render so the buffer is current
        scene.renderer.render(scene.object3D, scene.camera)
        var imageData = scene.canvas.toDataURL('image/jpeg', 0.9)

        window.dispatchEvent(new CustomEvent('photo-captured', {
          detail: {imageData: imageData},
        }))
      } catch (err) {
        console.warn('[AMC] Canvas capture failed:', err)
        this.hasCaptured = false
        if (snap) {
          snap.disabled = false
          snap.classList.remove('is-saving')
        }
      }
    },

    flash: function () {
      var el = document.getElementById('flash')
      if (!el) return

      el.classList.remove('active')
      void el.offsetWidth // force reflow
      el.classList.add('active')

      setTimeout(function () {
        el.classList.remove('active')
      }, 500)
    },

    onClaim: function () {
      var img = document.getElementById('captured-photo')
      if (!img || !img.src) return

      var a = document.createElement('a')
      a.download = 'amc-couch-hunt.jpg'
      a.href = img.src
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    },
  }
})()
