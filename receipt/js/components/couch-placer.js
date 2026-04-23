/**
 * couch-placer — A-Frame component
 * Places the couch at ~3m height with floating + rotation animation.
 * Exposes highlight() / unhighlight() for the detector to call.
 */
(function () {
  'use strict'

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
      this.el.object3D.rotation.set(
        THREE.MathUtils.degToRad(ROTATION_OFFSET_X),
        THREE.MathUtils.degToRad(ROTATION_OFFSET_Y),
        THREE.MathUtils.degToRad(ROTATION_OFFSET_Z),
        'YXZ'
      )

      // Store base position for animations
      this._baseY = y
      this._posX = x
      this._posZ = z

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
        intensity: 1.05,
        distance: 7,
      })
      glow.setAttribute('position', '0 0.75 0.95')
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
            material.color.multiplyScalar(1.12)
          }

          if (material.metalness !== undefined) {
            material.metalness = 0
          }

          if (material.roughness !== undefined) {
            material.roughness = 0.76
          }

          if (material.emissive) {
            material.emissive.setRGB(0.03, 0.05, 0.08)
            material.emissiveIntensity = 0.12
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
  }

  function vectorToString(vector) {
    return vector.x + ' ' + vector.y + ' ' + vector.z
  }
})()
