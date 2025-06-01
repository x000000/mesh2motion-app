import { UI } from '../UI.ts'
import { Object3D, type Object3DEventMap } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SkeletonType } from '../enums/SkeletonType.js'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepLoadSkeleton extends EventTarget {
  private readonly loader: GLTFLoader = new GLTFLoader()
  private readonly ui: UI = new UI()
  private loaded_armature: Object3D = new Object3D()
  private skeleton_t: SkeletonType = SkeletonType.Human

  public skeleton_type (): SkeletonType {
    return this.skeleton_t
  }

  begin (): void {
    if (this.ui.dom_current_step_index !== null) {
      this.ui.dom_current_step_index.innerHTML = '2'
    }

    if (this.ui.dom_current_step_element !== null) {
      this.ui.dom_current_step_element.innerHTML = 'Load Skeleton'
    }

    if (this.ui.dom_load_skeleton_tools !== null) {
      this.ui.dom_load_skeleton_tools.style.display = 'flex'
    }

    this.add_event_listeners()
  }

  private add_event_listeners (): void {
    if (this.ui.dom_load_skeleton_button !== null) {
      this.ui.dom_load_skeleton_button.addEventListener('click', () => {
        if (this.ui.dom_skeleton_drop_type === null) {
          console.warn('could not find skeleton selection drop down HTML element')
          return
        }

        // get currently selected option out of the model-selection drop-down
        const skeleton_selection = this.ui.dom_skeleton_drop_type.options

        const skeleton_file: string = skeleton_selection[skeleton_selection.selectedIndex].value

        // set the skeleton type. This will be used for the animations listing later
        // so it knows what animations to load
        switch (skeleton_file) {
          case 'quadraped':
            this.skeleton_t = SkeletonType.Quadraped
            break
          case 'human':
            this.skeleton_t = SkeletonType.Human
            break
          case 'bird':
            this.skeleton_t = SkeletonType.Bird
            break
        }

        // load skeleton from GLB file
        console.log('trying to load skeleton', this.skeleton_t)
        this.loader.load(this.skeleton_t, (gltf) => {
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

          console.log('loaded GLTF file with data: ', gltf)

          this.loaded_armature = original_armature.clone()
          this.loaded_armature.name = 'Loaded Armature'

          // reset the armature to 0,0,0 in case it is off for some reason
          this.loaded_armature.position.set(0, 0, 0)
          this.loaded_armature.updateWorldMatrix(true, true)

          this.dispatchEvent(new CustomEvent('skeletonLoaded', { detail: this.loaded_armature }))
        })
      })
    }// end if statement
  }

  public armature (): Object3D<Object3DEventMap> {
    return this.loaded_armature
  }
}
