/**
 * app.js — Entry point
 * Registers all A-Frame components and initialises the UI modules.
 * Loaded AFTER 8th Wall + component scripts, BEFORE the <a-scene> element.
 */
(function () {
  'use strict'

  var xrRuntimeStarted = false

  // Register A-Frame components
  AFRAME.registerComponent('couch-placer', AMC.couchPlacerComponent)
  AFRAME.registerComponent('couch-detector', AMC.couchDetectorComponent)

  // Shadow-only floor: transparent plane that only shows cast shadows in AR passthrough
  AFRAME.registerComponent('shadow-floor', {
    init: function () {
      var apply = function (mesh) {
        mesh.material = new THREE.ShadowMaterial({ opacity: 0.45, transparent: true })
        mesh.receiveShadow = true
      }
      var mesh = this.el.getObject3D('mesh')
      if (mesh) {
        apply(mesh)
      } else {
        this.el.addEventListener('object3dset', function (e) {
          if (e.detail.type === 'mesh') apply(e.detail.object)
        })
      }
    },
  })

  // Initialise UI when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  function boot() {
    initXRRuntime()
    AMC.StateManager.init()
    AMC.ScreenCapture.init()
  }

  function initXRRuntime() {
    var startRuntime = function () {
      if (xrRuntimeStarted) return

      var scene = document.querySelector('a-scene')
      if (!scene) return
      if (!window.XR8 || !window.XR8.XrController) return

      xrRuntimeStarted = true

      // Ensure open-source SLAM world tracking is enabled before starting reality.
      window.XR8.XrController.configure({ disableWorldTracking: false })

      if (scene.hasLoaded) {
        scene.emit('runreality')
      } else {
        scene.addEventListener('loaded', function () {
          scene.emit('runreality')
        }, { once: true })
      }
    }

    if (window.XR8) {
      startRuntime()
    } else {
      window.addEventListener('xrloaded', startRuntime, { once: true })
    }
  }
})()
