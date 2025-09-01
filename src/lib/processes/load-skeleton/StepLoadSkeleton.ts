import { UI } from '../../UI.ts'
import { Object3D, type Scene, type Object3DEventMap } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SkeletonType, type HandSkeletonType } from '../../enums/SkeletonType.js'
import type GLTFResult from './interfaces/GLTFResult.ts'
import { add_origin_markers, remove_origin_markers } from './OriginMarkerManager'
import { add_preview_skeleton, remove_preview_skeleton } from './PreviewSkeletonManager.ts'
import { HandHelper } from './HandHelper.ts'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepLoadSkeleton extends EventTarget {
  private readonly loader: GLTFLoader = new GLTFLoader()
  private readonly ui: UI = UI.getInstance()
  private loaded_armature: Object3D = new Object3D()

  private _added_event_listeners: boolean = false
  private readonly _main_scene: Scene

  // used to help scale animations later
  // this is useful since position keyframes will need to be scaled
  // to prevent large offsets
  private skeleton_scale_percentage: number = 1.0

  public skeleton_type (): SkeletonType {
    return this.skeleton_file_path() // this is actually the type/filepath combo
  }

  // The edit skeleton step will use this to scale the skeleton when loading editable skeleton
  // animations listing will use this to scale all position keyframes
  public skeleton_scale (): number {
    return this.skeleton_scale_percentage
  }

  constructor (main_scene: Scene) {
    super()
    this._main_scene = main_scene
  }

  public begin (): void {
    if (this.ui.dom_current_step_index !== null) {
      this.ui.dom_current_step_index.innerHTML = '2'
    }

    if (this.ui.dom_current_step_element !== null) {
      this.ui.dom_current_step_element.innerHTML = 'Load Skeleton'
    }

    if (this.ui.dom_load_skeleton_tools !== null) {
      this.ui.dom_load_skeleton_tools.style.display = 'flex'
    }

    // if we are navigating back to this step, we don't want to add the event listeners again
    if (!this._added_event_listeners) {
      this.add_event_listeners()
      this._added_event_listeners = true
    }

    // when we come back to this step, there is a good chance we already selected a skeleton
    // so just use that and load the preview right when we enter this step
    if (!this.has_select_skeleton_ui_option()) {
      add_preview_skeleton(this._main_scene, this.skeleton_file_path(),
        this.hand_skeleton_type(), this.skeleton_scale_percentage).catch((err) => {
        console.error('error loading preview skeleton: ', err)
      })
    }

    // Initialize hand skeleton hand options visibility
    this.toggle_ui_hand_skeleton_options()

    // add origin markers for debugging model loading issues
    add_origin_markers(this._main_scene)

    // if there is a "select skeleton" option, disable proceeding
    // putting this check here helps us if we come back to this step later
    if (this.has_select_skeleton_ui_option()) {
      this.allow_proceeding_to_next_step(false)
    } else {
      this.allow_proceeding_to_next_step(true)
    }
  }

  public regenerate_origin_markers (): void {
    add_origin_markers(this._main_scene)
  }

  public dispose (): void {
    remove_origin_markers(this._main_scene)
    remove_preview_skeleton(this._main_scene)
  }

  private skeleton_file_path (): SkeletonType {
    // get currently selected option out of the model-selection drop-down
    const skeleton_selection = this.ui.dom_skeleton_drop_type.options
    const skeleton_file: string = skeleton_selection[skeleton_selection.selectedIndex].value

    // set the skeleton type. This will be used for the animations listing later
    // so it knows what animations to load
    switch (skeleton_file) {
      case 'quadraped':
        return SkeletonType.Quadraped
      case 'human':
        return SkeletonType.Human
      case 'bird':
        return SkeletonType.Bird
      case 'select-skeleton':
        return SkeletonType.None
      default:
        console.error('unknown skeleton type selected: ', skeleton_file)
        return SkeletonType.Error
    }
  }

  private hand_skeleton_type (): HandSkeletonType {
    const hand_selection = this.ui.dom_hand_skeleton_selection?.options
    return hand_selection[hand_selection.selectedIndex].value as HandSkeletonType
  }

  private add_event_listeners (): void {
    // Add event listener for skeleton type changes to show/hide hand options
    if (this.ui.dom_skeleton_drop_type !== null) {
      this.ui.dom_skeleton_drop_type.addEventListener('change', () => {
        // get selected value from skeleton options
        const skeleton_selection = this.ui.dom_skeleton_drop_type.options
        this.skeleton_t = skeleton_selection[skeleton_selection.selectedIndex].value as SkeletonType

        // hand options only apply to human skeletons, so we need to show/hide when skeleton type changes
        this.toggle_ui_hand_skeleton_options()

        // remove the "select a skeleton" option if we picked something else
        if (this.has_select_skeleton_ui_option()) {
          this.ui.dom_skeleton_drop_type?.options.remove(0)
        }

        // load the preview skeleton
        // need to get the file name for the correct skeleton
        add_preview_skeleton(this._main_scene, this.skeleton_file_path(), this.hand_skeleton_type()).then(() => {
          // enable the ability to progress to next step
          this.allow_proceeding_to_next_step(true)
        }).catch((err) => {
          console.error('error loading preview skeleton: ', err)
        })
      })
    }

    if (this.ui.dom_load_skeleton_button !== null) {
      this.ui.dom_load_skeleton_button.addEventListener('click', () => {
        if (this.ui.dom_skeleton_drop_type === null) {
          console.warn('could not find skeleton selection drop down HTML element')
          return
        }

        // load skeleton from GLB file
        this.loader.load(this.skeleton_file_path(), (gltf: GLTFResult) => {
          // traverse scene and find first bone object
          // we will go to the parent and mark that as the original armature
          let armature_found = false
          let original_armature: Object3D = new Object3D()

          gltf.scene.traverse((child: Object3D) => {
            // Note: three.js removes punctuation characters from names object names like `-` and `.` for sanitization
            // Our 3D source files will need to account fo this if we are relying on that later for parsing
            // https://discourse.threejs.org/t/avoid-dots-and-colons-being-deleted-from-models-name/15304/2
            if (child.type === 'Bone' && !armature_found) {
              armature_found = true

              if (child.parent != null) {
                original_armature = child.parent
              } else {
                console.warn('could not find armature parent while loading skeleton')
              }
            }
          })

          this.loaded_armature = original_armature.clone()
          this.loaded_armature.name = 'Loaded Armature'

          // Apply hand skeleton modifications for human skeletons
          if (this.skeleton_file_path() === SkeletonType.Human) {
            const helper = new HandHelper()
            helper.modify_hand_skeleton(this.loaded_armature, this.hand_skeleton_type())
          }

          // reset the armature to 0,0,0 in case it is off for some reason
          this.loaded_armature.position.set(0, 0, 0)
          this.loaded_armature.updateWorldMatrix(true, true)

          // scale the armature to what we picked using the scale slider/preview
          this.loaded_armature.scale.set(this.skeleton_scale(), this.skeleton_scale(), this.skeleton_scale())

          this.dispatchEvent(new CustomEvent('skeletonLoaded', { detail: this.loaded_armature }))
        })
      })
    }// end if statement

    // when hand skeleton type changes. update the preview skeleton
    this.ui.dom_hand_skeleton_selection?.addEventListener('change', () => {
      // rebuild the preview skeleton with the new hand skeleton type
      add_preview_skeleton(this._main_scene, this.skeleton_file_path(), this.hand_skeleton_type()).catch((err) => {
        console.error('error loading preview skeleton: ', err)
      })
    })

    // scale skeleton controls
    this.ui.dom_scale_skeleton_input?.addEventListener('input', (event) => {
      // range sliders have rounding errors, so we round the value to avoid issues
      this.skeleton_scale_percentage = parseFloat((event.target as HTMLInputElement).value)

      const display_value: string = Math.round(this.skeleton_scale_percentage * 100).toString() + '%'
      this.ui.dom_scale_skeleton_percentage_display!.textContent = display_value

      // re-add the preview skeleton with the new scale
      add_preview_skeleton(this._main_scene, this.skeleton_file_path(), this.hand_skeleton_type(), this.skeleton_scale_percentage).catch((err) => {
        console.error('error loading preview skeleton: ', err)
      })
    })
  }

  private has_select_skeleton_ui_option (): boolean {
    return this.ui.dom_skeleton_drop_type?.options[0].value === 'select-skeleton'
  }

  private allow_proceeding_to_next_step (allow: boolean): void {
    const btn = this.ui.dom_load_skeleton_button as HTMLButtonElement | null
    if (!btn) return
    btn.disabled = !allow // disable when not allowed
  }

  public armature (): Object3D<Object3DEventMap> {
    return this.loaded_armature
  }

  private toggle_ui_hand_skeleton_options (): void {
    if (this.ui.dom_skeleton_drop_type === null || this.ui.dom_hand_skeleton_options === null) {
      return
    }

    if (this.skeleton_file_path() === SkeletonType.Human) {
      this.ui.dom_hand_skeleton_options.style.display = 'flex'
    } else {
      this.ui.dom_hand_skeleton_options.style.display = 'none'
    }
  }
}
