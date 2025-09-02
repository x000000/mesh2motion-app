import { Group, type Object3D, type Object3DEventMap, SkeletonHelper, type Scene } from 'three'
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import type GLTFResult from './interfaces/GLTFResult'
import { type HandSkeletonType, SkeletonType } from '../../enums/SkeletonType'
import { HandHelper } from './HandHelper'


const skeleton_group_name: string = 'preview_skeleton_group'

// need a function that will add a preview skeleton to the scene
// this will remove any existing preview skeleton first
// and then add the new one based on the selected type
export async function add_preview_skeleton (root: Scene, skeleton_file_path: SkeletonType, 
  hand_skeleton_type: HandSkeletonType, skeleton_scale: number = 1.0): Promise<Object3D<Object3DEventMap>> {
  remove_preview_skeleton(root)

  // create new group for the preview skeleton
  let preview_skeleton_group = root.getObjectByName(skeleton_group_name) as Group
  if (!preview_skeleton_group) {
    preview_skeleton_group = new Group()
    preview_skeleton_group.name = skeleton_group_name
    root.add(preview_skeleton_group)
  }

  // need some logic to load the actual skeleton based on the type
  // we can only see the skeleton helper, so jwe will add that to the group
  const loaded_scene: Object3D<Object3DEventMap> = await load_skeleton(skeleton_file_path)

  // console.log('loaded skeleton file path: ', loaded_scene, hand_skeleton_type)

  // skeleton customization options here. Right now only for humans and hands
  if (skeleton_file_path === SkeletonType.Human) {
    // apply hand skeleton modifications for human skeletons
    const helper = new HandHelper()
    helper.modify_hand_skeleton(loaded_scene, hand_skeleton_type)
  }

  // need to convert the loaded scene into a custom skeleton helper
  const skeleton_helper = new SkeletonHelper(loaded_scene.children[0])
  skeleton_helper.name = 'preview_skeleton'
  preview_skeleton_group.add(skeleton_helper)

  // apply skeleton scaling
  preview_skeleton_group.scale.set(skeleton_scale, skeleton_scale, skeleton_scale)

  // finally add the preview skeleton group to the final scene
  root.add(preview_skeleton_group)
  return loaded_scene
}

async function load_skeleton (file_path: string): Promise<Object3D<Object3DEventMap>> {
  const loader = new GLTFLoader()
  const gltf: GLTF | GLTFResult = await loader.loadAsync(file_path)
  // If your GLTFResult extends GLTF and has `.scene`, this is fine:
  return gltf.scene as Object3D<Object3DEventMap>
}

// need a function that will remove the preview skeleton from the scene
export function remove_preview_skeleton (root: Scene): void {
  const skeleton_group = root.getObjectByName(skeleton_group_name)
  if (skeleton_group !== undefined && skeleton_group.parent) {
    skeleton_group.parent.remove(skeleton_group)
  }
}
