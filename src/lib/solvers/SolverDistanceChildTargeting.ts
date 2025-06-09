import {
  Vector3, Group, Raycaster, type Bone, Mesh,
  MeshBasicMaterial, DoubleSide
} from 'three'

import { Utility } from '../Utilities.js'
import { SkeletonType } from '../enums/SkeletonType.js'
import { AbstractAutoSkinSolver } from './AbstractAutoSkinSolver.js'
import { Generators } from '../Generators.js'


/**
 * SolverDistanceChildTargeting
 * This works very similar to the normal distance + child solver
  * This adds extra logic to target ares in the arms and hips to help with assigning weights
 */
export default class SolverDistanceChildTargeting extends AbstractAutoSkinSolver {
  private readonly points_to_show_for_debugging: Vector3[] = []

  // cache objects to help speed up calculations
  private cached_bone_positions: Vector3[] = [] // bone positions don't change
  private cached_median_child_bone_positions: Vector3[] = [] // position between bone and its child

  private readonly bone_object_to_index = new Map<Bone, number>() // map to get the index of the bone object
  private distance_to_bottom_of_hip: number = 0 // distance to the bottom of the hip bone

  // each index will be a bone index. the value will be a list of vertex indices that belong to that bone
  private readonly bones_vertex_segmentation: number[][] = []

  public calculate_indexes_and_weights (): number[][] {
    // There can be multiple objects that need skinning, so
    // this will make sure we have a clean slate by putting it in function
    const skin_indices: number[] = []
    const skin_weights: number[] = []

    // create cached items for all the vertex calculations later
    this.cached_bone_positions = this.get_bone_master_data().map(b => Utility.world_position_from_object(b))
    this.cached_median_child_bone_positions = this.get_bone_master_data().map(b => this.midpoint_to_child(b))

    this.get_bone_master_data().forEach((b, idx) => this.bone_object_to_index.set(b, idx))
    this.distance_to_bottom_of_hip = this.calculate_distance_to_bottom_of_hip()

    // mutates (assigns) skin_indices and skin_weights
    console.time('calculate_closest_bone_weights')
    this.calculate_median_bone_weights(skin_indices, skin_weights)
    console.timeEnd('calculate_closest_bone_weights')

    console.time('calculate_weight_distribution')
    //this.calculate_bone_segment_weights(skin_indices, skin_weights)
    console.timeEnd('calculate_weight_distribution')

    if (this.show_debug) {
      this.debugging_scene_object.add(this.objects_to_show_for_debugging(skin_indices))
      this.points_to_show_for_debugging.length = 0 // Clear the points after adding to the scene
    }

    return [skin_indices, skin_weights]
  }

  private calculate_bone_segment_weights (skin_indices: number[], skin_weights: number[]): void {
    this.bones_vertex_segmentation.forEach((vertex_indices, bone_index) => {
      // TODO: we have a smaller list of the vertices that belong to this bone
      // we need to calculate some weights if the vertices is close to the bone
      // we will give some weight to the parent bone if the vertex is close to bone joint position
      const bone_position: Vector3 = this.cached_bone_positions[bone_index]

      vertex_indices.forEach(vertex_index => {
        const vertex_position: Vector3 = new Vector3().fromBufferAttribute(this.geometry.attributes.position, vertex_index)

        // Calculate distance to the bone position
        // const distance_to_bone: number = vertex_position.distanceTo(bone_position)

        // get a vector from the bone position to the first child bone position
        // This is used to determine if the vertex is in the direction of the bone
        const child_position: Vector3 = this.cached_median_child_bone_positions[bone_index]
        const bone_to_child_vector: Vector3 = child_position.clone().sub(bone_position).normalize()

        // get bone to vertex vector
        const bone_to_vertex_vector: Vector3 = vertex_position.clone().sub(bone_position).normalize()

        // get dot product between bone position and vertex position
        const bone_direction_similarity: number = bone_to_child_vector.dot(bone_to_vertex_vector)

        // -1 to 1 range. 0 is perpendicular, 1 is same direction, -1 is opposite direction
        const similarity_threshold: number = 0.2

        // If the vertex is close to the bone, replace weight to the bone, and some weight to the parent bone
        if (bone_direction_similarity < similarity_threshold) { // arbitrary threshold to determine closeness
          // assign 50% weight to the bone and 50% to the parent bone
          const parent_bone_index: number = this.bone_object_to_index.get(this.get_bone_master_data()[bone_index].parent as Bone) ?? -1
          if (parent_bone_index !== -1) {
            // Assign 50% weight to the bone and 50% to the parent bone
            const offset = vertex_index * 4
            skin_indices[offset + 0] = bone_index
            skin_indices[offset + 1] = parent_bone_index
            skin_indices[offset + 2] = 0
            skin_indices[offset + 3] = 0

            skin_weights[offset + 0] = 0.5
            skin_weights[offset + 1] = 0.5
            skin_weights[offset + 2] = 0
            skin_weights[offset + 3] = 0
          }
        }
      }) // end vertex_indices forEach
    }) // end bones_vertex_segmentation forEach
  } // end calculate_bone_segment_weights()

  private midpoint_to_child (bone: Bone): Vector3 {
    const bonePosition = Utility.world_position_from_object(bone)
    if (bone.children.length === 0) {
      return bonePosition.clone()
    }
    // Assume first child is the relevant one
    const child = bone.children[0] as Bone
    const childPosition = Utility.world_position_from_object(child)
    return new Vector3().lerpVectors(bonePosition, childPosition, 0.5)
  }

  // every vertex checks to see if it is below the hips area,
  // so do this calculation once and cache it for the lookup later
  private calculate_distance_to_bottom_of_hip (): number {
    const hip_bone_object: Bone | undefined = this.get_bone_master_data().find(b => b.name.toLowerCase().includes('hips'))
    if (hip_bone_object === undefined) {
      throw new Error('Hip bone not found')
    }
    const intesection_point: Vector3 | null = this.cast_intersection_ray_down_from_bone(hip_bone_object)

    // get the distance from the bone point to the intersection point
    const bone_index = this.get_bone_master_data().findIndex(b => b === hip_bone_object)
    const bone_position: Vector3 = this.cached_median_child_bone_positions[bone_index]

    let distance_to_bottom: number = intesection_point?.distanceTo(bone_position) ?? 0
    distance_to_bottom *= 1.1 // buffer zone to make sure to include vertices at intersection

    return distance_to_bottom
  }

  /**
   * This function will assign the closest bone to each vertex
   * It returns void, but it will modify the skin_indices and skin_weights arrays
   * This function mutates the arrays passed in as arguments
   * @param skin_indices
   * @param skin_weights
   */
  private calculate_median_bone_weights (skin_indices: number[], skin_weights: number[]): void {
    for (let i = 0; i < this.geometry_vertex_count(); i++) {
      const vertex_position: Vector3 = new Vector3().fromBufferAttribute(this.geometry.attributes.position, i)
      let closest_bone_distance: number = 1000 // arbitrary large number to start with
      let closest_bone_index: number = 0

      this.get_bone_master_data().forEach((bone, idx) => {
        // The root bone is only for global transform changes, so we won't assign it to any vertices
        if (bone.name === 'root') {
          return // skip the root bone and continue to the next bone
        }

        // hip bones should have custom logic for distance. If the distance is too far away we should ignore it
        // This will help with hips when left/right legs could be closer than knee bones
        if (this.skeleton_type === SkeletonType.Human && bone.name.includes('hips') === true) {
          // if the intersection point is lower than the vertex position, that means the vertex is below
          // the hips area, and is part of the left or right leg...ignore that result
          if (this.distance_to_bottom_of_hip !== null && this.distance_to_bottom_of_hip < vertex_position.y) {
            return// this vertex is below our crotch area, so it cannot be part of our hips
          }
        }

        const distance: number = this.cached_median_child_bone_positions[idx].distanceTo(vertex_position)
        if (distance < closest_bone_distance) {
          // closest_bone = bone.bone_object
          closest_bone_distance = distance
          closest_bone_index = idx
        }
      })

      this.bones_vertex_segmentation[closest_bone_index] ??= [] // Initialize the array if it doesn't exist
      this.bones_vertex_segmentation[closest_bone_index].push(i)

      // assign to final weights. closest bone is always 100% weight
      skin_indices.push(closest_bone_index, 0, 0, 0)
      skin_weights.push(1.0, 0, 0, 0)
    }
  }

  private objects_to_show_for_debugging (skin_indices: number[]): Group {
    const weight_painted_mesh = Generators.create_weight_painted_mesh(skin_indices, this.geometry)
    const wireframe_mesh = Generators.create_wireframe_mesh_from_geometry(this.geometry)

    const group = new Group()
    group.add(weight_painted_mesh)
    group.add(wireframe_mesh)
    group.name = 'DebuggingNormalGroup'

    return group
  }

  private cast_intersection_ray_down_from_bone (bone: Bone): Vector3 | null {
    const raycaster = new Raycaster()

    // Set the ray's origin to the bone's world position
    const bone_index = this.get_bone_master_data().findIndex(b => b === bone)
    const bone_position = this.cached_median_child_bone_positions[bone_index]

    // Direction is straight down to find the pevlis "gap"
    raycaster.set(bone_position, new Vector3(0, -1, 0))

    // Create a temporary mesh from this.geometry for raycasting
    const temp_mesh = new Mesh(this.geometry, new MeshBasicMaterial())
    temp_mesh.material.side = DoubleSide // DoubleSide is a THREE.js constant

    // Perform the intersection test
    const recursive_check_child_objects: boolean = false
    const intersections = raycaster.intersectObject(temp_mesh, recursive_check_child_objects)

    if (intersections.length > 0) {
      // Return the position of the first intersection
      return intersections[0].point
    }

    // Return null if no intersection is found
    return null
  }
}
