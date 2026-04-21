/**
 * couch-detector — A-Frame scene component
 * Checks each tick whether the camera is aimed at the couch.
 * After sustained gaze (~0.8 s), emits 'couch-found' on window.
 */
(function () {
  'use strict'

  var DETECTION_ANGLE = 25   // degrees from camera center
  var DETECTION_TIME = 800   // ms of sustained gaze required
  var CHECK_INTERVAL = 100   // ms throttle

  // Pre-allocated vectors (avoid GC in tick)
  var _camPos = new THREE.Vector3()
  var _couchPos = new THREE.Vector3()
  var _camDir = new THREE.Vector3()
  var _toCouch = new THREE.Vector3()

  window.AMC = window.AMC || {}

  window.AMC.couchDetectorComponent = {
    schema: {
      enabled: {type: 'boolean', default: true},
    },

    init: function () {
      this.camera = null
      this.couch = null
      this.lookingAtCouch = false
      this.lookStartTime = 0
      this.found = false
      this.lastCheck = 0

      var self = this
      this.el.addEventListener('loaded', function () {
        self.camera = document.getElementById('camera')
        self.couch = document.getElementById('couch')
      })
    },

    tick: function (time) {
      if (!this.data.enabled || this.found) return
      if (!this.camera || !this.couch) return
      if (!this.couch.getAttribute('visible')) return

      // Throttle
      if (time - this.lastCheck < CHECK_INTERVAL) return
      this.lastCheck = time

      var looking = this.isLookingAtCouch()

      if (looking && !this.lookingAtCouch) {
        this.lookingAtCouch = true
        this.lookStartTime = time
      } else if (!looking && this.lookingAtCouch) {
        this.lookingAtCouch = false
        this.lookStartTime = 0
      }

      if (this.lookingAtCouch && time - this.lookStartTime >= DETECTION_TIME) {
        this.triggerFound()
      }
    },

    isLookingAtCouch: function () {
      var cam3D = this.camera.object3D
      var couch3D = this.couch.object3D

      cam3D.getWorldPosition(_camPos)
      couch3D.getWorldPosition(_couchPos)
      cam3D.getWorldDirection(_camDir)

      _toCouch.subVectors(_couchPos, _camPos).normalize()

      var angleDeg = THREE.MathUtils.radToDeg(_camDir.angleTo(_toCouch))
      return angleDeg < DETECTION_ANGLE
    },

    triggerFound: function () {
      this.found = true

      // Highlight couch model
      var placer = this.couch.components['couch-placer']
      if (placer) placer.highlight()

      window.dispatchEvent(new CustomEvent('couch-found'))
    },
  }
})()
