import { Group, Object3D, Object3DEventMap, SkeletonHelper, type Scene } from 'three'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import type GLTFResult from './interfaces/GLTFResult'
import { type SkeletonType } from '../../enums/SkeletonType'

const skeleton_group_name: string = 'preview_skeleton_group'

// need a function that will add a preview skeleton to the scene
// this will remove any existing preview skeleton first
// and then add the new one based on the selected type
export async function add_preview_skeleton (root: Scene, skeleton_file_path: SkeletonType): Promise<Object3D<Object3DEventMap>> {
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
  loaded_scene.name = 'preview_skeleton'
  preview_skeleton_group.add(loaded_scene)
  root.add(preview_skeleton_group)
  console.log('loaded skeleton: ', loaded_scene)
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
