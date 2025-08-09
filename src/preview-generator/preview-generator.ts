import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { Utility } from '../lib/Utilities.ts'
import { Generators } from '../lib/Generators.ts'
import { ThemeManager } from '../lib/ThemeManager.ts'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { WebMRecorder } from './webm-recorder.ts'
import { saveAs } from 'file-saver';

export class PreviewGeneratorBootstrap {
  public readonly camera = Generators.create_camera()
  public readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  public controls: OrbitControls | undefined = undefined
  public readonly scene: THREE.Scene = new THREE.Scene()
  public readonly theme_manager = new ThemeManager()

  private environment_container: THREE.Group = new THREE.Group()

  // loading model and animation stuff
  private gltf_animation_loader: GLTFLoader = new GLTFLoader()

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
      this.start_recording()
    })

    this.animate()
  }

  private async start_recording (): Promise<void> {
    const recorder: WebMRecorder = new WebMRecorder(this.renderer)

    // TODO: play through each animation and do a recording
    // after all the animations are done zip up the results and download

    await recorder.record_webm(1, 'preview.webm').then(file => {
      console.log(file)
      saveAs(file, 'preview.webm')
    })
  }

  private load_human_model_and_animations (): void {
    // Load the human model here
    const filepath: string = '../animations/human-base-animations.glb'
    this.gltf_animation_loader.load(filepath, (gltf: any) => {
      // load the skinned mesh
      this.scene.add(...gltf.scene.children)

      // grab a list of the animations following logic of main Mesh2Motion app with cleanup
      const cloned_anims: THREE.AnimationClip[] = Utility.deep_clone_animation_clips(gltf.animations)
      console.log(cloned_anims)
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
