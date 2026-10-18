// Rendu WebGL (three.js) du modèle : matière de fil (relief des mailles, reflet « velours »),
// éclairage studio doux, ombre portée au sol, rotation à la souris, au doigt ou au clavier,
// sélection d'un point de la surface (placement manuel des pièces).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Model, Part, Vec3 } from './model'
import { cordGeometry, latheGeometry, panelGeometry } from './geometry'
import { chainMaps, stitchMaps } from './yarnTextures'
import { shade } from '../domain/colors'
import { t } from '../i18n'

export interface Viewer3DHandle {
  resetView: () => void
  screenshot: () => Promise<Blob | null>
}

export interface PickEvent {
  point: Vec3
  normal: Vec3
  label: string
}

interface Props {
  model: Model
  autoRotate: boolean
  /** recadrer la caméra quand le modèle change (sinon on garde le point de vue) */
  refit?: boolean
  /** mode sélection : un clic sur la surface appelle onPick */
  picking?: boolean
  onPick?: (e: PickEvent) => void
  /** pièce mise en évidence (libellé) */
  highlight?: string | null
  className?: string
}

function yarnMaterial(color: string, kind: 'stitch' | 'chain', doubleSided: boolean, anisotropy: number, vertexColors: boolean) {
  const maps = kind === 'stitch' ? stitchMaps(anisotropy) : chainMaps(anisotropy)
  return new THREE.MeshPhysicalMaterial({
    // avec des changements de fil, la couleur vient des sommets
    color: new THREE.Color(vertexColors ? '#ffffff' : color),
    vertexColors,
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

/** Géométries réutilisées d'un rendu à l'autre (le curseur « construction » ne change qu'une pièce). */
type GeoCache = Map<object, THREE.BufferGeometry>

function geometryFor(part: Part, cache: GeoCache, next: GeoCache): THREE.BufferGeometry {
  const key: object = part.kind === 'lathe' ? part.rings : part.kind === 'panel' ? part.rows : part.kind === 'cord' ? part.points : part
  let g = cache.get(key) ?? next.get(key)
  if (!g) {
    g = part.kind === 'lathe' ? latheGeometry(part.rings, part.color)
      : part.kind === 'panel' ? panelGeometry(part.rows, part.color)
        : part.kind === 'cord' ? cordGeometry(part.points, part.radius, part.stitches)
          : new THREE.SphereGeometry(part.radius, 32, 20)
  }
  next.set(key, g)
  return g
}

function buildObject(part: Part, anisotropy: number, cache: GeoCache, next: GeoCache): THREE.Object3D {
  const geo = geometryFor(part, cache, next)
  const colored = !!geo.getAttribute('color')
  let mesh: THREE.Mesh
  if (part.kind === 'lathe') {
    mesh = new THREE.Mesh(geo, yarnMaterial(part.color, 'stitch', part.open, anisotropy, colored))
  } else if (part.kind === 'panel') {
    mesh = new THREE.Mesh(geo, yarnMaterial(part.color, 'stitch', true, anisotropy, colored))
  } else if (part.kind === 'cord') {
    mesh = new THREE.Mesh(geo, yarnMaterial(part.color, 'chain', false, anisotropy, false))
  } else {
    const mat = part.glossy
      ? new THREE.MeshPhysicalMaterial({ color: part.color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 })
      : yarnMaterial(part.color, 'stitch', false, anisotropy, false)
    mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(...part.position)
    mesh.scale.set(1, part.squash, 1)
  }
  mesh.castShadow = true
  mesh.receiveShadow = part.kind !== 'bead'
  mesh.name = part.label
  mesh.userData = { label: part.label, kind: part.kind }
  if (part.kind !== 'lathe' && part.kind !== 'panel') return mesh
  const group = new THREE.Group()
  group.add(mesh)
  group.position.set(...part.transform.position)
  group.rotation.set(...part.transform.rotation)
  group.scale.set(...part.transform.scale)
  return group
}

function disposeMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    // les textures de fil sont partagées, les géométries sont gérées par le cache
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    mats.forEach((mat) => mat.dispose())
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

interface Ctx {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  content: THREE.Group
  fit: () => void
  geometries: GeoCache
}

const Canvas3D = forwardRef<Viewer3DHandle, Props & { onLost: () => void }>(function Canvas3D(
  { model, autoRotate, refit = true, picking = false, onPick, highlight, className, onLost }, ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const ctx = useRef<Ctx | null>(null)
  const pickRef = useRef({ picking, onPick })
  useEffect(() => { pickRef.current = { picking, onPick } })
  const lostRef = useRef(onLost)
  useEffect(() => { lostRef.current = onLost })

  // initialisation de la scène (une fois)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    } catch {
      lostRef.current()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    const canvas = renderer.domElement
    canvas.className = 'viewer3d-canvas'
    canvas.tabIndex = 0
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', t('Aperçu 3D. Flèches : tourner, + et − : zoomer, 0 : recentrer.'))
    host.appendChild(canvas)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.5

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.autoRotateSpeed = 1.1

    scene.add(new THREE.HemisphereLight(0xfff4e8, 0xb9a48c, 0.55))
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

    // clavier : flèches = tourner, +/− = zoom, 0 = recentrer
    const onKey = (e: KeyboardEvent) => {
      const offset = camera.position.clone().sub(controls.target)
      const sph = new THREE.Spherical().setFromVector3(offset)
      const step = e.shiftKey ? 0.35 : 0.12
      if (e.key === 'ArrowLeft') sph.theta -= step
      else if (e.key === 'ArrowRight') sph.theta += step
      else if (e.key === 'ArrowUp') sph.phi = Math.max(0.15, sph.phi - step)
      else if (e.key === 'ArrowDown') sph.phi = Math.min(Math.PI - 0.15, sph.phi + step)
      else if (e.key === '+' || e.key === '=') sph.radius = Math.max(controls.minDistance, sph.radius * 0.88)
      else if (e.key === '-' || e.key === '_') sph.radius = Math.min(controls.maxDistance, sph.radius / 0.88)
      else if (e.key === '0' || e.key === 'Home') {
        e.preventDefault()
        fit()
        return
      } else return
      e.preventDefault()
      controls.autoRotate = false
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph))
      controls.update()
    }
    canvas.addEventListener('keydown', onKey)

    // sélection d'un point (placement manuel) : un clic sans glisser
    const raycaster = new THREE.Raycaster()
    let down: { x: number, y: number } | null = null
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      const { picking: on, onPick: cb } = pickRef.current
      if (!on || !cb || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
      const rect = canvas.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(content.children, true).find((h) => h.face && (h.object.userData.kind === 'lathe' || h.object.userData.kind === 'panel'))
      if (!hit || !hit.face) return
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      cb({ point: hit.point.toArray() as Vec3, normal: n.toArray() as Vec3, label: String(hit.object.userData.label) })
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)

    // contexte WebGL perdu (mémoire graphique saturée, appareil en veille…) : on prévient le parent
    const onContextLost = (e: Event) => {
      e.preventDefault()
      lostRef.current()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)

    let visible = true
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting })
    io.observe(host)
    renderer.setAnimationLoop(() => {
      if (!visible || document.hidden) return
      controls.update()
      renderer.render(scene, camera)
    })

    ctx.current = { renderer, scene, camera, controls, content, fit, geometries: new Map() }
    return () => {
      renderer.setAnimationLoop(null)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      controls.dispose()
      disposeMaterials(content)
      ctx.current?.geometries.forEach((g) => g.dispose())
      env.dispose()
      pmrem.dispose()
      // renderer.dispose() ne libère ni la carte d'ombre, ni la pièce d'éclairage, ni le sol :
      // sans cela chaque ouverture de l'onglet 3D garde un contexte WebGL (le navigateur en limite le nombre)
      room.dispose()
      key.shadow.dispose()
      ground.geometry.dispose()
      ground.material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      ctx.current = null
    }
  }, [])

  // contenu (à chaque changement de modèle)
  useEffect(() => {
    const c = ctx.current
    if (!c) return
    const old = [...c.content.children]
    old.forEach((o) => {
      c.content.remove(o)
      disposeMaterials(o)
    })
    const aniso = Math.min(8, c.renderer.capabilities.getMaxAnisotropy())
    const next: GeoCache = new Map()
    for (const part of model.parts) c.content.add(buildObject(part, aniso, c.geometries, next))
    // libère les géométries qui ne servent plus
    c.geometries.forEach((g, k) => { if (!next.has(k)) g.dispose() })
    c.geometries = next
    if (refit || old.length === 0) c.fit()
  }, [model, refit])

  // mise en évidence d'une pièce (placement)
  useEffect(() => {
    const c = ctx.current
    if (!c) return
    c.content.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !(m.material instanceof THREE.MeshPhysicalMaterial)) return
      const on = !!highlight && m.userData.label === highlight
      m.material.emissive.set(on ? '#ff9a5c' : '#000000')
      m.material.emissiveIntensity = on ? 0.35 : 0
    })
  }, [highlight, model])

  useEffect(() => {
    if (ctx.current) ctx.current.controls.autoRotate = autoRotate && !picking
  }, [autoRotate, picking])

  useImperativeHandle(ref, () => ({
    resetView: () => ctx.current?.fit(),
    screenshot: () => new Promise((resolve) => {
      const c = ctx.current
      if (!c) return resolve(null)
      c.renderer.render(c.scene, c.camera)
      c.renderer.domElement.toBlob((b) => resolve(b), 'image/png')
    }),
  }), [])

  return <div ref={hostRef} className={`viewer3d ${picking ? 'picking' : ''} ${className ?? ''}`} />
})

/** Aperçu 3D avec reprise après perte du contexte WebGL. */
const Viewer3D = forwardRef<Viewer3DHandle, Props>(function Viewer3D(props, ref) {
  const [supported] = useState(() => webglAvailable())
  const [generation, setGeneration] = useState(0)
  const [lost, setLost] = useState(false)

  if (!supported) {
    return <div className="viewer3d-fallback">{t('L\'aperçu 3D nécessite WebGL, indisponible sur cet appareil ou ce navigateur.')}</div>
  }
  if (lost) {
    return (
      <div className="viewer3d-fallback" role="alert">
        <p>{t('L\'aperçu 3D a été interrompu par le navigateur (mémoire graphique).')}</p>
        <button type="button" className="btn primary" onClick={() => { setLost(false); setGeneration((g) => g + 1) }}>
          {t('Relancer l\'aperçu')}
        </button>
      </div>
    )
  }
  return <Canvas3D key={generation} ref={ref} {...props} onLost={() => setLost(true)} />
})

export default Viewer3D
