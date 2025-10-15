import { ProcessStep } from '../lib/enums/ProcessStep'
import { SkeletonType } from '../lib/enums/SkeletonType'
import { Mesh2MotionEngine } from '../Mesh2MotionEngine'

export class MarketingBootstrap {
  private mesh2motion_engine: Mesh2MotionEngine
  private skeleton_type: SkeletonType = SkeletonType.None

  constructor () {
    this.mesh2motion_engine = new Mesh2MotionEngine()
    this.add_event_listeners()
  }

  public setup_model_buttons (): void {
    // add click events for each button type
    const human_button = document.getElementById('load-human-model-button')
    const fox_button = document.getElementById('load-fox-model-button')
    const bird_button = document.getElementById('load-bird-model-button')
    const dragon_button = document.getElementById('load-dragon-model-button')

    human_button?.addEventListener('click', () => {
      this.mesh2motion_engine.load_model_step.load_model_file('../models/model-human.glb', 'glb')
      this.skeleton_type = SkeletonType.Human
    })

    fox_button?.addEventListener('click', () => {
      this.mesh2motion_engine.load_model_step.load_model_file('../models/model-fox.glb', 'glb')
      this.skeleton_type = SkeletonType.Quadraped
    })

    bird_button?.addEventListener('click', () => {
      this.mesh2motion_engine.load_model_step.load_model_file('../models/model-bird.glb', 'glb')
      this.skeleton_type = SkeletonType.Bird
    })

    dragon_button?.addEventListener('click', () => {
      this.mesh2motion_engine.load_model_step.load_model_file('../models/model-dragon.glb', 'glb')
      this.skeleton_type = SkeletonType.Dragon
    })

    human_button?.click() // load human by default to start us out
  }

  public add_event_listeners (): void {
    // event after the DOM is fully loaded for HTML elements
    document.addEventListener('DOMContentLoaded', () => {
      this.setup_model_buttons() // automatically trigger the human once we begin for the default
    }) // end the DOMContentLoaded function

    // we are re-creating the engine, so need to manually add the event listeners again
    this.mesh2motion_engine.load_model_step.addEventListener('modelLoaded', () => {
      // this (this.skeleton_type) value contains the filename for the skeleton rig
      this.mesh2motion_engine.process_step_changed(ProcessStep.LoadSkeleton)
      this.mesh2motion_engine.load_skeleton_step.load_skeleton_file('../' + this.skeleton_type)
      this.mesh2motion_engine.load_skeleton_step.set_skeleton_type(this.skeleton_type)
    })

    // need to automatically finish the edit skeleton step and move onto the next step
    this.mesh2motion_engine.load_skeleton_step.addEventListener('skeletonLoaded', () => {
      this.mesh2motion_engine.animations_listing_step.set_animations_file_path('../animations/')
      this.mesh2motion_engine.process_step_changed(ProcessStep.BindPose)
    })
  }
}

// instantiate the class to setup event listeners
const app = new MarketingBootstrap()
