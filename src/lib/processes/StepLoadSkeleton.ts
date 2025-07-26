import { UI } from '../UI.ts'
import { Object3D, type Object3DEventMap } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SkeletonType, HandSkeletonType } from '../enums/SkeletonType.js'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepLoadSkeleton extends EventTarget {
  private readonly loader: GLTFLoader = new GLTFLoader()
  private readonly ui: UI = new UI()
  private loaded_armature: Object3D = new Object3D()
  private skeleton_t: SkeletonType = SkeletonType.Human
  private hand_skeleton_t: HandSkeletonType = HandSkeletonType.AllFingers

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

    // Initialize hand skeleton options visibility
    this.toggle_hand_skeleton_options()
  }

  private add_event_listeners (): void {
    // Add event listener for skeleton type changes to show/hide hand options
    if (this.ui.dom_skeleton_drop_type !== null) {
      this.ui.dom_skeleton_drop_type.addEventListener('change', () => {
        this.toggle_hand_skeleton_options()
      })
    }

    if (this.ui.dom_load_skeleton_button !== null) {
      this.ui.dom_load_skeleton_button.addEventListener('click', () => {
        if (this.ui.dom_skeleton_drop_type === null) {
          console.warn('could not find skeleton selection drop down HTML element')
          return
        }

        // get currently selected option out of the model-selection drop-down
        const skeleton_selection = this.ui.dom_skeleton_drop_type.options

        const skeleton_file: string = skeleton_selection[skeleton_selection.selectedIndex].value

        // Get hand skeleton selection for human skeletons
        let hand_skeleton_selection = HandSkeletonType.AllFingers
        if (skeleton_file === 'human' && this.ui.dom_hand_skeleton_selection !== null) {
          const hand_selection = this.ui.dom_hand_skeleton_selection.options
          hand_skeleton_selection = hand_selection[hand_selection.selectedIndex].value as HandSkeletonType
          this.hand_skeleton_t = hand_skeleton_selection
        }

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
        this.loader.load(this.skeleton_t, (gltf: any) => {
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

          // Apply hand skeleton modifications for human skeletons
          if (this.skeleton_t === SkeletonType.Human) {
            this.modify_hand_skeleton(this.loaded_armature, hand_skeleton_selection)
          }

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

  private toggle_hand_skeleton_options (): void {
    if (this.ui.dom_skeleton_drop_type === null || this.ui.dom_hand_skeleton_options === null) {
      return
    }

    const skeleton_selection = this.ui.dom_skeleton_drop_type.options
    const skeleton_file: string = skeleton_selection[skeleton_selection.selectedIndex].value

    if (skeleton_file === 'human') {
      this.ui.dom_hand_skeleton_options.style.display = 'flex'
    } else {
      this.ui.dom_hand_skeleton_options.style.display = 'none'
    }
  }

  private modify_hand_skeleton (armature: Object3D, hand_type: HandSkeletonType): void {
    const bones_to_remove: any[] = []

    armature.traverse((child: any) => {
      if (child.type === 'Bone') {
        const bone = child
        const bone_name = (bone.name ?? '').toLowerCase() as string

        // remove bones on mesh based on hand type selected on UI
        switch (hand_type) {
          case HandSkeletonType.ThumbAndIndex:
            // Remove all finger bones except thumb and index finger
            if (this.is_finger_bone(bone_name) &&
                !this.is_thumb_bone(bone_name) &&
                !this.is_middle_finger_bone(bone_name)) {
              bones_to_remove.push(bone)
            }

            // also remove tip bones since we want something simplified
            if (this.is_end_tip_bone(bone_name)) {
              bones_to_remove.push(bone)
            }
            break

          case HandSkeletonType.SimplifiedHand:
            // Remove all finger/feet tip bones (bones ending with 'tip')
            if (this.is_end_tip_bone(bone_name)) {
              bones_to_remove.push(bone)
            }
            break
        }
      }
    })

    // Remove the identified bones
    bones_to_remove.forEach(bone => {
      if (bone.parent != null) {
        bone.parent.remove(bone)
      }
    })

    console.log(`Modified hand skeleton: ${hand_type}, removed ${bones_to_remove.length} bones`)
  }

  private is_finger_bone (bone_name: string): boolean {
    const finger_patterns = ['finger', 'thumb', 'index', 'middle', 'ring', 'pinky']
    return finger_patterns.some(pattern => bone_name.includes(pattern))
  }

  private is_thumb_bone (bone_name: string): boolean {
    return bone_name.includes('thumb')
  }

  private is_index_finger_bone (bone_name: string): boolean {
    return bone_name.includes('index')
  }

  private is_middle_finger_bone (bone_name: string): boolean {
    return bone_name.includes('middle')
  }

  // "tip" bones are the last bone at the end of the fingers and feet
  // they have the word 'tip' in the bone name
  private is_end_tip_bone (bone_name: string): boolean {
    // Look for bones that are finger tips - usually end with 'tip', 'end', or numbers like '3'
    return bone_name.toLowerCase().includes('tip')
  }
}
