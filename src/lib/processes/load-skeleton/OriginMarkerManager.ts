import { type Object3D, Mesh, SphereGeometry, MeshBasicMaterial, type Scene, Group, Vector3 } from 'three'

const ORIGIN_MARKER_GROUP_NAME: string = 'origin_marker_group'

export function add_origin_markers (root: Scene): void {
  remove_origin_markers(root)

  // Create a group to hold all markers
  let markerGroup = root.getObjectByName(ORIGIN_MARKER_GROUP_NAME) as Group
  if (!markerGroup) {
    markerGroup = new Group()
    markerGroup.name = ORIGIN_MARKER_GROUP_NAME
    root.add(markerGroup)
  }

  // with the root scene, there is a group called "Imported Model" that contains
  // the meshes we want to put markers on
  const imported_meshes: Mesh[] = root.children.find(x => x.name === 'Imported Model')

  const meshes: Mesh[] = []
  imported_meshes.children.forEach(element => {
    if (element.type === 'Mesh') {
      meshes.push(element)
    }
  })

  for (const mesh of meshes) {
    // Get mesh world position
    const worldPos = new Vector3()
    mesh.getWorldPosition(worldPos)

    const marker = new Mesh(
      new SphereGeometry(0.02, 8, 8),
      new MeshBasicMaterial({ color: 0xff4c00 }) // orange
    )
    marker.name = 'origin_marker_' + mesh.name
    marker.position.copy(worldPos)
    markerGroup.add(marker)
  }
}

export function remove_origin_markers(root: Object3D): void {
  const markerGroup = root.getObjectByName(ORIGIN_MARKER_GROUP_NAME)
  if (markerGroup && markerGroup.parent) {
    markerGroup.parent.remove(markerGroup)
  }
}
