import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { Utility } from '../lib/Utilities.ts'
import { Generators } from '../lib/Generators.ts'
import { ThemeManager } from '../lib/ThemeManager.ts'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { WebMRecorder } from './webm-recorder.ts'

import { saveAs } from 'file-saver'
import JSZip from 'jszip'

export class PreviewGeneratorBootstrap {
  public readonly camera = Generators.create_camera()
  public readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  public controls: OrbitControls | undefined = undefined
  public readonly scene: THREE.Scene = new THREE.Scene()
  public readonly theme_manager = new ThemeManager()

  private readonly recorder: WebMRecorder = new WebMRecorder(this.renderer)
  private readonly zip = new JSZip()

  private environment_container: THREE.Group = new THREE.Group()

  // loading model and animation stuff

  private readonly gltf_animation_loader: GLTFLoader = new GLTFLoader()
  private animation_clips: THREE.AnimationClip[] = []
  private readonly mixers: THREE.AnimationMixer[] = []
  private readonly skinned_meshes: THREE.SkinnedMesh[] = []

  private current_animation_index_processing: number = 0

  constructor () {
    this.animate = this.animate.bind(this)
    this.gltf_animation_loader = new GLTFLoader()
  }

  public initialize (): void {
    this.setup_environment()

    // for now, let's load the human model
    this.load_human_model_and_animations()

    // setup event listener for record button
    const record_button = document.getElementById('record-button')
    record_button?.addEventListener('click', () => {
      void this.start_recording()
    })

    this.animate()
  }

  private async start_recording (): Promise<void> {
    if (this.skinned_meshes.length === 0 || this.animation_clips.length === 0) {
      alert('Animation or animations not loaded yet.')
      return
    }

    await this.process_animation_clip()
  }

  private async process_animation_clip (): Promise<void> {
    // if we have processed all animations, we can stop
    const temp_limit = 4 // this.animation_clips.length
    if (this.current_animation_index_processing >= temp_limit) {
      console.log('All animations processed.')
      return
    }

    const clip = this.animation_clips[this.current_animation_index_processing]

    console.log('processing', clip.name)

    // Stop all previous actions
    this.mixers.forEach(mixer => {
      mixer.stopAllAction()
    })

    // go through each mixer and play clip
    this.mixers.forEach(mixer => {
      const action = mixer.clipAction(clip)
      action.reset()
      action.setLoop(THREE.LoopOnce, 1) // Play only once
      action.clampWhenFinished = true // Hold the last frame
      action.play()
    })

    // Wait for a short moment to ensure animation is visible
    // before we start recording
    // await new Promise(resolve => setTimeout(resolve, 200))

    // wait for animation to complete
    await new Promise(resolve => {
      this.mixers[0].addEventListener('finished', resolve)
    })

    // Record for the duration of the clip (or a max duration)
    // const duration = Math.min(clip.duration, 10) // max 10s per clip
    // const file = await recorder.record_webm(duration, `${clip.name}.webm`)
    // zip.file(`${clip.name}.webm`, file)

    // stop each mixer
    this.mixers.forEach(mixer => {
      mixer.stopAllAction()
    })

    // increment animation index
    this.current_animation_index_processing += 1
    await this.process_animation_clip()
  }

  // Generate zip and trigger download
  private async generate_zip (): Promise<void> {
    const blob = await this.zip.generateAsync({ type: 'blob' })
    saveAs(blob, 'animation-previews.zip')
  }

  private load_human_model_and_animations (): void {
    // Load the human model here
    const filepath: string = '../animations/human-base-animations.glb'
    this.gltf_animation_loader.load(filepath, (gltf: any) => {
      // grabbed all the skinned meshes in the scene
      gltf.scene.traverse((child: any) => {
        if (child.isSkinnedMesh) {
          this.skinned_meshes.push(child)
        }
      })

      // load the skinned mesh into the scene to see
      // some models have multiple skinned meshes
      this.scene.add(...this.skinned_meshes)

      console.log(this.skinned_meshes)

      // grab a list of the animations from file
      // these are stored outside the mesh at the root level on a GLTF file
      this.animation_clips = gltf.animations

      if (this.skinned_meshes.length === 0) {
        console.warn('No SkinnedMesh found. Cannot proceed with animations.')
        return
      }

      // create a mixer for each skinned mesh
      // each mixer can only control one skinned mesh
      this.skinned_meshes.forEach(skin_mesh => {
        const mixer = new THREE.AnimationMixer(skin_mesh)
        this.mixers.push(mixer)
      })
    })
  }

  private setup_environment (): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true

    // Set default camera position for front view
    // this will help because we first want the user to rotate the model to face the front
    this.camera.position.set(0, 1.7, 15) // X:0 (centered), Y:1.7 (eye-level), Z:5 (front view)

    Generators.create_window_resize_listener(this.renderer, this.camera)
    document.body.appendChild(this.renderer.domElement)

    // center orbit controls around mid-section area with target change
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.9, 0)

    // Set zoom limits to prevent excessive zooming in or out
    this.controls.minDistance = 5 // Minimum zoom (closest to model)
    this.controls.maxDistance = 30 // Maximum zoom (farthest from model)

    this.controls.update()

    // basic things in another group, to better isolate what we are working on
    this.regenerate_floor_grid()
  }

  private animate (): void {
    requestAnimationFrame(this.animate)

    // update each mixer
    this.mixers.forEach(mixer => {
      mixer.update(1 / 30)
    })

    this.renderer.render(this.scene, this.camera)
  }

  public regenerate_floor_grid (): void {
    // remove previous setup objects from scene if they exist
    const setup_container = this.scene.getObjectByName('Setup objects')
    if (setup_container !== null) {
      this.scene.remove(setup_container)
    }

    // change color of grid based on theme
    let grid_color = 0x4b6368
    let floor_color = 0x2d4353
    let light_strength: number = 10
    if (this.theme_manager.get_current_theme() === 'light') {
      grid_color = 0xcccccc // light theme color
      floor_color = 0xecf0f1 // light theme color
      light_strength = 14
    }

    this.scene.fog = new THREE.Fog(floor_color, 20, 80)

    this.environment_container = new THREE.Group()
    this.environment_container.name = 'Setup objects'
    this.environment_container.add(...Generators.create_default_lights(light_strength))
    this.environment_container.add(...Generators.create_grid_helper(grid_color, floor_color))
    this.scene.add(this.environment_container)
  }
}

// Create an instance of the Bootstrap class when the script is loaded
const app = new PreviewGeneratorBootstrap()
app.initialize()
