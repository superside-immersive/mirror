/**
 * couch-placer — A-Frame component
 * Places the couch at ~3m height with floating + rotation animation.
 * Exposes highlight() / unhighlight() for the detector to call.
 */
(function () {
  'use strict'

  var FLOAT_RANGE = 0.3
  var FLOAT_DURATION = 2500
  var ROTATE_DURATION = 20000
  var MIN_DISTANCE = 0
  var MAX_DISTANCE = 0
  var TARGET_COUCH_WIDTH = 2.65
  var TARGET_COUCH_HEIGHT = 1.15
  var TARGET_COUCH_DEPTH = 1.1
  var TARGET_Y = 3
  var ROTATION_OFFSET_X = 0
  var ROTATION_OFFSET_Y = -82
  var ROTATION_OFFSET_Z = -57

  window.AMC = window.AMC || {}

  window.AMC.couchPlacerComponent = {
    schema: {
      height: {type: 'number', default: TARGET_Y},
      minDistance: {type: 'number', default: MIN_DISTANCE},
      maxDistance: {type: 'number', default: MAX_DISTANCE},
      targetWidth: {type: 'number', default: TARGET_COUCH_WIDTH},
      targetHeight: {type: 'number', default: TARGET_COUCH_HEIGHT},
      targetDepth: {type: 'number', default: TARGET_COUCH_DEPTH},
    },

    init: function () {
      this.placed = false
      this.revealed = false
      this.baseScale = new THREE.Vector3(1, 1, 1)
      this._cameraWorldPos = new THREE.Vector3()
      this._modelWorldPos = new THREE.Vector3()

      // Enable soft shadow maps once the renderer is ready
      var sceneEl = this.el.sceneEl
      var setupShadows = function () {
        var renderer = sceneEl.renderer
        if (renderer) {
          renderer.shadowMap.enabled = true
          renderer.shadowMap.type = THREE.PCFSoftShadowMap
        }
      }
      if (sceneEl.renderer) {
        setupShadows()
      } else {
        sceneEl.addEventListener('renderstart', setupShadows)
      }

      this.el.addEventListener('model-loaded', this.onModelLoaded.bind(this))

      if (this.el.sceneEl.hasLoaded) {
        this.placeCouch()
      } else {
        this.el.sceneEl.addEventListener('loaded', this.placeCouch.bind(this))
      }
    },

    placeCouch: function () {
      if (this.placed) return
      this.placed = true

      // Keep the couch directly above/centered over the user's start position.
      var x = 0
      var z = 0
      var y = this.data.height

      this.el.object3D.position.set(x, y, z)

      // Store base position for animations
      this._baseY = y
      this._posX = x
      this._posZ = z

      // Floating bob
      this.el.setAttribute('animation__float', {
        property: 'object3D.position.y',
        from: y,
        to: y + 0.18,
        dir: 'alternate',
        dur: FLOAT_DURATION,
        easing: 'easeInOutSine',
        loop: true,
      })

      // (no auto-rotation — tick() handles look-at-camera instead)

      // Hide until the model is loaded and normalized to real-world couch scale.
      this.el.object3D.scale.set(0.001, 0.001, 0.001)

      if (this.el.getObject3D('mesh')) {
        this.onModelLoaded()
      }

      // Add a subtle blue point light near the couch as a hint
      var glow = document.createElement('a-entity')
      glow.setAttribute('light', {
        type: 'point',
        color: '#dbe8ff',
        intensity: 1.6,
        distance: 9,
      })
      glow.setAttribute('position', '0 0.9 1.1')
      this.el.appendChild(glow)
    },

    onModelLoaded: function () {
      var mesh = this.el.getObject3D('mesh')
      if (!mesh) return

      this.prepareMaterials(mesh)

      this.baseScale.copy(this.fitModelToCouchSize(mesh))

      if (this.revealed) {
        this.el.object3D.scale.copy(this.baseScale)
        return
      }

      this.revealed = true

      var fromScale = this.baseScale.clone().multiplyScalar(0.08)
      var el = this.el
      el.object3D.scale.copy(fromScale)

      setTimeout(function () {
        el.setAttribute('visible', true)
        el.setAttribute('animation__appear', {
          property: 'scale',
          from: vectorToString(fromScale),
          to: vectorToString(el.components['couch-placer'].baseScale),
          dur: 800,
          easing: 'easeOutBack',
        })
      }, 1200)
    },

    fitModelToCouchSize: function (mesh) {
      var currentScale = this.el.object3D.scale.clone()
      this.el.object3D.scale.set(1, 1, 1)
      this.el.object3D.updateMatrixWorld(true)

      var box = new THREE.Box3().setFromObject(mesh)
      var size = new THREE.Vector3()
      box.getSize(size)

      this.el.object3D.scale.copy(currentScale)
      this.el.object3D.updateMatrixWorld(true)

      if (!size.x || !size.y || !size.z) {
        return new THREE.Vector3(1, 1, 1)
      }

      var widthScale = this.data.targetWidth / size.x
      var heightScale = this.data.targetHeight / size.y
      var depthScale = this.data.targetDepth / size.z
      var uniformScale = Math.max(widthScale, heightScale, depthScale)

      return new THREE.Vector3(uniformScale, uniformScale, uniformScale)
    },

    prepareMaterials: function (mesh) {
      mesh.traverse(function (node) {
        if (!node.isMesh) return

        node.castShadow = true
        node.receiveShadow = true

        var materials = Array.isArray(node.material) ? node.material : [node.material]

        materials.forEach(function (material) {
          if (!material) return

          if (material.color) {
            material.color.multiplyScalar(1.22)
          }

          if (material.metalness !== undefined) {
            material.metalness = 0
          }

          if (material.roughness !== undefined) {
            material.roughness = 0.72
          }

          if (material.emissive) {
            material.emissive.setRGB(0.05, 0.08, 0.14)
            material.emissiveIntensity = 0.22
          }

          if (material.envMapIntensity !== undefined) {
            material.envMapIntensity = 1.1
          }

          material.needsUpdate = true
        })
      })
    },

    highlight: function () {
      var mesh = this.el.getObject3D('mesh')
      if (mesh) {
        mesh.traverse(function (node) {
          if (node.isMesh && node.material) {
            node.material.emissive = new THREE.Color(0x028FFF)
            node.material.emissiveIntensity = 0.5
            node.material.needsUpdate = true
          }
        })
      }

      // Scale pulse
      var highlightScale = this.baseScale.clone().multiplyScalar(1.08)
      this.el.setAttribute('animation__highlight', {
        property: 'scale',
        from: vectorToString(this.baseScale),
        to: vectorToString(highlightScale),
        dir: 'alternate',
        dur: 600,
        easing: 'easeInOutSine',
        loop: true,
      })
    },

    unhighlight: function () {
      var mesh = this.el.getObject3D('mesh')
      if (mesh) {
        mesh.traverse(function (node) {
          if (node.isMesh && node.material) {
            node.material.emissive = new THREE.Color(0x000000)
            node.material.emissiveIntensity = 0
            node.material.needsUpdate = true
          }
        })
      }

      this.el.removeAttribute('animation__highlight')
      this.el.object3D.scale.copy(this.baseScale)
    },

    tick: function () {
      if (!this.revealed) return

      try {
        // Billboard: rotate Y so the couch always faces the camera.
        // We use euler + setFromEuler to avoid touching quaternion internals
        // that 8th Wall SLAM expects to own on the camera object.
        var camera = this.el.sceneEl.camera
        if (!camera) return

        camera.getWorldPosition(this._cameraWorldPos)

        var myPos = this.el.object3D.getWorldPosition(this._modelWorldPos)
        var dx = this._cameraWorldPos.x - myPos.x
        var dz = this._cameraWorldPos.z - myPos.z
        var lookY = Math.atan2(dx, dz)

        this.el.object3D.rotation.set(
          THREE.MathUtils.degToRad(ROTATION_OFFSET_X),
          lookY + THREE.MathUtils.degToRad(ROTATION_OFFSET_Y),
          THREE.MathUtils.degToRad(ROTATION_OFFSET_Z),
          'YXZ'
        )
      } catch (e) {
        // Swallow errors silently — XR init race conditions
      }
    },
  }

  function vectorToString(vector) {
    return vector.x + ' ' + vector.y + ' ' + vector.z
  }
})()
