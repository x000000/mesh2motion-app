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
    this.calculate_bone_segment_weights(skin_indices, skin_weights)
    console.timeEnd('calculate_weight_distribution')

    if (this.show_debug) {
      this.debugging_scene_object.add(this.objects_to_show_for_debugging(skin_indices))
      this.points_to_show_for_debugging.length = 0 // Clear the points after adding to the scene
    }

    return [skin_indices, skin_weights]
  }

  private calculate_bone_segment_weights (skin_indices: number[], skin_weights: number[]): void {
    const amount_of_indices: number = skin_indices.length / 4
    for (let i = 0; i < amount_of_indices; i++) {
      const bone_index: number = skin_indices[i * 4 + 0] // get the bone index from the skin_indices array
      const index_base = i * 4 // calculate the value to use for skin_indices and skin_weights
      const bone: Bone = this.get_bone_master_data()[bone_index]

      // if the bone has no parent, we can skip the bone as there won't be weight blending
      const parent_index: number = this.get_bone_master_data().findIndex(b => b === bone.parent)
      if (parent_index === -1) {
        // if the bone has no parent, we can skip this bone
        continue
      }

      // get vertex position from the geometry
      const vertex_position: Vector3 = new Vector3().fromBufferAttribute(this.geometry.attributes.position, i)

      // create vector between the bone position and the vertex position
      const bone_position: Vector3 = this.cached_bone_positions[bone_index]
      const bone_to_vertex_vector: Vector3 = vertex_position.clone().sub(bone_position)

      // create vector between the bone position and the child bone position
      if (bone.children[0] === undefined) {
        // if the bone has no children, we can skip this bone
        continue
      }

      const child_position: Vector3 = bone.children[0].position as Vector3
      const bone_to_child_vector: Vector3 = child_position.clone().sub(bone_position)
      const bone_to_child_length: number = bone_to_child_vector.length()
      const bone_to_child_dir: Vector3 = bone_to_child_vector.clone().normalize()

      // calculate the angle between the two vectors
      const angle: number = bone_to_vertex_vector.angleTo(bone_to_child_vector)

      // calculate x component using trigonometry
      // the x component will be the "true" distance  that will disregard perpendicular distance
      const hypotenuse: number = bone_to_vertex_vector.length()
      let x_component_length: number = Math.cos(angle) * hypotenuse

      // if x_component length is less than 50% of the bone to child vector length,
      // we will assign the vertex to the bone and its parent
      if (x_component_length > (bone_to_child_length * 0.5)) {
        continue // skip this vertex, it is too far away from the bone
      }

      // do weight assignment here
      // create a falloff effect based on the distance to the child bone
      // Prevent negative projection (behind the bone)
      x_component_length = Math.max(0, x_component_length)

      // calculate the weight based on the distance to the child bone
      const weight: number = 1.0 - (x_component_length / bone_to_child_length)
      if (weight > 0.9) {
        continue // skip this vertex, most of the weight is on the normal bone
      }
  
      // if the bone is the root bone, we don't need to do anything
      skin_indices[index_base + 0] = bone_index
      skin_indices[index_base + 1] = parent_index
      skin_weights[index_base + 0] = weight
      skin_weights[index_base + 1] = 1 - weight
    }
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
