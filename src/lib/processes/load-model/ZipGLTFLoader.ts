import JSZip from 'jszip'
import { type GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { type Scene } from 'three/src/scenes/Scene.js'

/**
 * Loads a GLTF (with BIN and textures) from a ZIP file buffer, using in-memory URLs for all assets.
 * Usage: new ZipGLTFLoader(gltfLoaderInstance).loadFromZip(zipBuffer, (scene) => { ... })
 */
export class ZipGLTFLoader {
  private readonly loader: GLTFLoader

  constructor (loader: GLTFLoader) {
    this.loader = loader
  }

  async loadFromZip (zipData: ArrayBuffer, onLoad: (scene: Scene) => void, onError?: (err: any) => void): Promise<void> {
    try {
      const zip = await JSZip.loadAsync(zipData)
      let gltf_file: any = null
      let bin_file: any = null
      let gltf_filename = ''
      let bin_filename = ''
      zip.forEach((relativePath, file) => {
        const lower = relativePath.toLowerCase()
        if (lower.endsWith('.gltf')) {
          gltf_file = file
          gltf_filename = relativePath
        } else if (lower.endsWith('.bin')) {
          bin_file = file
          bin_filename = relativePath
        }
      })
      if (!gltf_file) {
        throw new Error('No GLTF file found in ZIP')
      }
      const gltf_text = await gltf_file.async('text')
      const gltf_json = JSON.parse(gltf_text)
      if (bin_file && gltf_json.buffers && gltf_json.buffers[0]) {
        const binNameOnly = bin_filename.split('/').pop()
        gltf_json.buffers[0].uri = binNameOnly
      }
      // Map all relevant files by filename only (case-insensitive, handle spaces)
      const fileMap: Record<string, Uint8Array> = {}
      const filePromises = Object.keys(zip.files).map(async (filename) => {
        const file = zip.files[filename]
        if (!file.dir) {
          const nameOnly = filename.split('/').pop() ?? filename
          if (/\.(bin|gltf|png|jpg|jpeg|webp)$/i.test(nameOnly)) {
            // Map by original, lowercased, and decoded name
            const buffer = new Uint8Array(await file.async('arraybuffer'))
            fileMap[nameOnly] = buffer
            fileMap[nameOnly.toLowerCase()] = buffer
            try {
              const decoded = decodeURIComponent(nameOnly)
              fileMap[decoded] = buffer
              fileMap[decoded.toLowerCase()] = buffer
            } catch {}
          }
        }
      })
      await Promise.all(filePromises)
      // Patch loader to use in-memory blobs for all referenced files
      this.loader.manager.setURLModifier((url: string) => {
        const cleanUrl = url.split(/[?#]/)[0]
        let nameOnly = cleanUrl.split('/').pop() ?? cleanUrl
        // Try original, lowercased, and decoded
        let buffer = fileMap[nameOnly]
        if (!buffer) buffer = fileMap[nameOnly.toLowerCase()]
        if (!buffer) {
          try {
            const decoded = decodeURIComponent(nameOnly)
            buffer = fileMap[decoded] || fileMap[decoded.toLowerCase()]
          } catch {}
        }
        if (buffer) {
          let mime = 'application/octet-stream'
          if (/\.png$/i.test(nameOnly)) mime = 'image/png'
          else if (/\.jpe?g$/i.test(nameOnly)) mime = 'image/jpeg'
          else if (/\.webp$/i.test(nameOnly)) mime = 'image/webp'
          else if (/\.gltf$/i.test(nameOnly)) mime = 'application/json'
          const blob = new Blob([buffer], { type: mime })
          return URL.createObjectURL(blob)
        }
        return url
      })
      // Load the GLTF from the in-memory JSON
      const gltfBlob = new Blob([JSON.stringify(gltf_json)], { type: 'application/json' })
      const gltfUrl = URL.createObjectURL(gltfBlob)
      this.loader.load(
        gltfUrl,
        (gltf) => {
          const loaded_scene: Scene = gltf.scene
          onLoad(loaded_scene)
          URL.revokeObjectURL(gltfUrl)
        },
        undefined,
        (err) => {
          if (onError != null) onError(err)
        }
      )
    } catch (err) {
      if (onError != null) onError(err)
    }
  }
}
