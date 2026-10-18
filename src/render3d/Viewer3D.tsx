// Rendu WebGL (three.js) du modèle : matière de fil (relief des mailles, reflet « velours »),
// éclairage studio doux, ombre portée au sol, rotation à la souris / au doigt.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Model, Part } from './model'
import { cordGeometry, latheGeometry, panelGeometry } from './geometry'
import { chainMaps, stitchMaps } from './yarnTextures'
import { shade } from '../domain/colors'

export interface Viewer3DHandle {
  resetView: () => void
  screenshot: () => Promise<Blob | null>
}

interface Props {
  model: Model
  autoRotate: boolean
  /** recadrer la caméra quand le modèle change (sinon on garde le point de vue) */
  refit?: boolean
  className?: string
}

function yarnMaterial(color: string, kind: 'stitch' | 'chain', doubleSided: boolean, anisotropy: number) {
  const maps = kind === 'stitch' ? stitchMaps(anisotropy) : chainMaps(anisotropy)
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.92,
    metalness: 0,
    // reflet doux et diffus des fibres
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(shade(color, 1.35)),
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  })
}

function buildObject(part: Part, anisotropy: number): THREE.Object3D {
  let mesh: THREE.Mesh
  if (part.kind === 'lathe') {
    mesh = new THREE.Mesh(latheGeometry(part.rings), yarnMaterial(part.color, 'stitch', part.open, anisotropy))
  } else if (part.kind === 'panel') {
    mesh = new THREE.Mesh(panelGeometry(part.rows), yarnMaterial(part.color, 'stitch', true, anisotropy))
  } else if (part.kind === 'cord') {
    return Object.assign(
      new THREE.Mesh(cordGeometry(part.points, part.radius, part.stitches), yarnMaterial(part.color, 'chain', false, anisotropy)),
      { castShadow: true, receiveShadow: true, name: part.label },
    )
  } else {
    const geo = new THREE.SphereGeometry(part.radius, 32, 20)
    const mat = part.glossy
      ? new THREE.MeshPhysicalMaterial({ color: part.color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 })
      : yarnMaterial(part.color, 'stitch', false, anisotropy)
    const bead = new THREE.Mesh(geo, mat)
    bead.position.set(...part.position)
    bead.scale.set(1, part.squash, 1)
    bead.castShadow = true
    bead.name = part.label
    return bead
  }
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.name = part.label
  const group = new THREE.Group()
  group.add(mesh)
  group.position.set(...part.transform.position)
  group.rotation.set(...part.transform.rotation)
  group.scale.set(...part.transform.scale)
  return group
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.geometry.dispose()
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      // les textures de fil sont partagées : seules les matières sont libérées
      mats.forEach((mat) => mat.dispose())
    }
  })
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const Viewer3D = forwardRef<Viewer3DHandle, Props>(function Viewer3D({ model, autoRotate, refit = true, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    content: THREE.Group
    ground: THREE.Mesh
    key: THREE.DirectionalLight
    fit: () => void
  } | null>(null)
  const [failed] = useState(() => !webglAvailable())

  // initialisation de la scène (une fois)
  useEffect(() => {
    const host = hostRef.current
    if (!host || failed) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.className = 'viewer3d-canvas'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.5

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.autoRotateSpeed = 1.1

    const hemi = new THREE.HemisphereLight(0xfff4e8, 0xb9a48c, 0.55)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xfff1e0, 2.1)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.radius = 6
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.04
    scene.add(key, key.target)
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.7)
    rim.position.set(-8, 6, -10)
    scene.add(rim)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.2 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const content = new THREE.Group()
    scene.add(content)

    const fit = () => {
      const box = new THREE.Box3().setFromObject(content)
      if (box.isEmpty()) return
      const sphere = box.getBoundingSphere(new THREE.Sphere())
      const r = Math.max(sphere.radius, 1)
      // champ le plus étroit (vertical, ou horizontal sur un écran en portrait)
      const vfov = THREE.MathUtils.degToRad(camera.fov)
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
      const dist = (r / Math.sin(Math.min(vfov, hfov) / 2)) * 0.88
      const dir = new THREE.Vector3(0.62, 0.42, 1).normalize()
      controls.target.copy(sphere.center)
      camera.position.copy(sphere.center).addScaledVector(dir, dist)
      camera.near = dist / 50
      camera.far = dist * 20
      camera.updateProjectionMatrix()
      controls.minDistance = r * 0.9
      controls.maxDistance = dist * 3
      controls.update()
      // sol sous le modèle et ombre cadrée sur lui
      ground.position.set(sphere.center.x, box.min.y - 0.02, sphere.center.z)
      ground.scale.setScalar(r * 8)
      key.position.copy(sphere.center).add(new THREE.Vector3(r * 1.2, r * 3, r * 1.6))
      key.target.position.copy(sphere.center)
      const cam = key.shadow.camera
      cam.left = cam.bottom = -r * 1.6
      cam.right = cam.top = r * 1.6
      cam.near = r * 0.5
      cam.far = r * 8
      cam.updateProjectionMatrix()
    }

    let lastAspect = 0
    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      // recadrage si la forme de la zone change nettement (rotation d'un téléphone…)
      if (lastAspect && Math.abs(Math.log(camera.aspect / lastAspect)) > 0.15) fit()
      lastAspect = camera.aspect
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
    io.observe(host)
    renderer.setAnimationLoop(() => {
      if (!visible || document.hidden) return
      controls.update()
      renderer.render(scene, camera)
    })

    ctx.current = { renderer, scene, camera, controls, content, ground, key, fit }
    return () => {
      renderer.setAnimationLoop(null)
      ro.disconnect()
      io.disconnect()
      controls.dispose()
      disposeTree(content)
      env.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      ctx.current = null
    }
  }, [failed])

  // contenu (à chaque changement de modèle)
  useEffect(() => {
    const c = ctx.current
    if (!c) return
    const old = [...c.content.children]
    old.forEach((o) => {
      c.content.remove(o)
      disposeTree(o)
    })
    const aniso = Math.min(8, c.renderer.capabilities.getMaxAnisotropy())
    for (const part of model.parts) c.content.add(buildObject(part, aniso))
    if (refit || old.length === 0) c.fit()
  }, [model, refit])

  useEffect(() => {
    if (ctx.current) ctx.current.controls.autoRotate = autoRotate
  }, [autoRotate])

  useImperativeHandle(ref, () => ({
    resetView: () => ctx.current?.fit(),
    screenshot: () => new Promise((resolve) => {
      const c = ctx.current
      if (!c) return resolve(null)
      c.renderer.render(c.scene, c.camera)
      c.renderer.domElement.toBlob((b) => resolve(b), 'image/png')
    }),
  }), [])

  if (failed) {
    return (
      <div className="viewer3d-fallback">
        L'aperçu 3D nécessite WebGL, indisponible sur cet appareil ou ce navigateur.
      </div>
    )
  }
  return <div ref={hostRef} className={`viewer3d ${className ?? ''}`} />
})

export default Viewer3D
