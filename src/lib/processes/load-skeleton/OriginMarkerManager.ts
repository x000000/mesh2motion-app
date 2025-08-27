import { type Object3D, Mesh, SphereGeometry, MeshBasicMaterial, type Scene } from 'three'

export function add_origin_markers (root: Scene): void {
  remove_origin_markers(root)

  const meshes: Mesh[] = []
  root.traverse((child: Object3D) => {
    if ((child as Mesh).isMesh) {
      meshes.push(child as Mesh)
    }
  })

  for (const mesh of meshes) {
    const marker = new Mesh(
      new SphereGeometry(0.02, 8, 8),
      new MeshBasicMaterial({ color: 0xff4c00 }) // orange
    )
    marker.name = 'origin_marker'
    marker.position.set(0, 0, 0)
    mesh.add(marker)
  }
}

export function remove_origin_markers (root: Object3D): void {
  const markers: Object3D[] = []
  root.traverse((child: Object3D) => {
    for (const c of child.children) {
      if (c.name === 'origin_marker') {
        markers.push(c)
      }
    }
  })

  for (const marker of markers) {
    if (marker.parent) {
      marker.parent.remove(marker)
    }
  }
}
