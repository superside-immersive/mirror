/**
 * app.js — Entry point
 * Registers all A-Frame components and initialises the UI modules.
 * Loaded AFTER 8th Wall + component scripts, BEFORE the <a-scene> element.
 */
(function () {
  'use strict'

  // Register A-Frame components
  AFRAME.registerComponent('couch-placer', AMC.couchPlacerComponent)
  AFRAME.registerComponent('couch-detector', AMC.couchDetectorComponent)

  // Initialise UI when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  function boot() {
    AMC.StateManager.init()
    AMC.ScreenCapture.init()
  }
})()
