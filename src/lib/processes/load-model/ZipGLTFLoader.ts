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

  /**
   * Main entry: Loads a GLTF (with BIN and textures) from a ZIP file buffer, using in-memory URLs for all assets.
   */
  async load_from_zip (zipData: ArrayBuffer,
    onLoad: (scene: Scene) => void,
    onError?: (err: any) => void
  ): Promise<void> {
    try {
      // 1. Load and scan the ZIP for GLTF and BIN files
      const zip = await JSZip.loadAsync(zipData)
      const { gltfFile, binFile, gltfFilename, binFilename } = this.find_gltf_files(zip)
      if (!gltfFile) throw new Error('No GLTF file found in ZIP')

      // 2. Parse GLTF JSON and patch buffer URI if needed
      const gltf_json: any = await this.parse_gltf_json(gltfFile, binFile, binFilename)

      // 3. Build a map of all relevant files (textures, bin, gltf) by filename
      const file_map: Record<string, Uint8Array> = await this.build_file_map(zip)

      // 4. Patch loader to use in-memory blobs for all referenced files
      this.loader.manager.setURLModifier(this.make_url_modifier(file_map))

      // 5. Load the GLTF from the in-memory JSON blob
      const gltf_blob = new Blob([JSON.stringify(gltf_json)], { type: 'application/json' })
      const gltf_url = URL.createObjectURL(gltf_blob)
      this.loader.load(
        gltf_url,
        (gltf) => {
          const loaded_scene: Scene = gltf.scene
          onLoad(loaded_scene)
          URL.revokeObjectURL(gltf_url)
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

  /**
   * Scans the ZIP for .gltf and .bin files and returns their file objects and names.
   */
  private find_gltf_files (zip: JSZip): {
    gltfFile: any, binFile: any, gltfFilename: string, binFilename: string
  } {
    let gltfFile: any = null
    let binFile: any = null
    let gltfFilename = ''
    let binFilename = ''
    zip.forEach((relativePath, file) => {
      const lower = relativePath.toLowerCase()
      if (lower.endsWith('.gltf')) {
        gltfFile = file
        gltfFilename = relativePath
      } else if (lower.endsWith('.bin')) {
        binFile = file
        binFilename = relativePath
      }
    })
    return { gltfFile, binFile, gltfFilename, binFilename }
  }

  /**
   * Reads and parses the GLTF JSON, patching the buffer URI if a BIN file is present.
   */
  private async parse_gltf_json (gltfFile: any, binFile: any, binFilename: string): Promise<any> {
    const gltf_text = await gltfFile.async('text')
    const gltf_json = JSON.parse(gltf_text)
    if (binFile && gltf_json.buffers && gltf_json.buffers[0]) {
      const binNameOnly = binFilename.split('/').pop()
      gltf_json.buffers[0].uri = binNameOnly
    }
    return gltf_json
  }

  /**
   * Builds a map of all relevant files (textures, bin, gltf) by filename (case-insensitive, handles spaces).
   */
  private async build_file_map (zip: JSZip): Promise<Record<string, Uint8Array>> {
    const fileMap: Record<string, Uint8Array> = {}
    const filePromises = Object.keys(zip.files).map(async (filename) => {
      const file = zip.files[filename]
      if (!file.dir) {
        const nameOnly = filename.split('/').pop() ?? filename
        if (/\.(bin|gltf|png|jpg|jpeg|webp)$/i.test(nameOnly)) {
          const buffer = new Uint8Array(await file.async('arraybuffer'))
          // Map by original, lowercased, and decoded name
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
    return fileMap
  }

  /**
   * Returns a URL modifier function for the loader, serving in-memory blobs for referenced files.
   */
  private make_url_modifier (file_map: Record<string, Uint8Array>): (url: string) => string {
    return (url: string) => {
      // Remove query/hash, get filename
      const clean_url = url.split(/[?#]/)[0]
      const name_only: string = clean_url.split('/').pop() ?? clean_url
      // Try original, lowercased, and decoded
      let buffer: Uint8Array | undefined = file_map[name_only]

      if (!buffer) buffer = file_map[name_only.toLowerCase()]
      if (!buffer) {
        try {
          const decoded = decodeURIComponent(name_only)
          buffer = file_map[decoded] || file_map[decoded.toLowerCase()]
        } catch {}
      }
      
      if (buffer) {
        // Guess MIME type
        let mime = 'application/octet-stream'
        if (/\.png$/i.test(name_only)) mime = 'image/png'
        else if (/\.jpe?g$/i.test(name_only)) mime = 'image/jpeg'
        else if (/\.webp$/i.test(name_only)) mime = 'image/webp'
        else if (/\.gltf$/i.test(name_only)) mime = 'application/json'
        const blob = new Blob([buffer], { type: mime })
        return URL.createObjectURL(blob)
      }

      return url
    }
  }
}
