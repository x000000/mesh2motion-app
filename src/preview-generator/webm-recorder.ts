import * as THREE from 'three'

export class WebMRecorder {
  public width: number = 160
  public height: number = 120
  public fps: number = 24
  public kbps: number = 800

  public readonly recorded_files: File[] = []

  renderer_ref: THREE.WebGLRenderer

  constructor (renderer: THREE.WebGLRenderer) {
    this.renderer_ref = renderer
  }

  public async record_webm (duration_in_sec: number, fileName: string): Promise<File> {
    // store original size of renderer temporarily to capture a certain resolution
    const old_size = this.renderer_ref.getSize(new THREE.Vector2())
    const old_pr = this.renderer_ref.getPixelRatio()

    this.renderer_ref.setPixelRatio(1)
    this.renderer_ref.setSize(this.width, this.height, false)

    const stream: MediaStream = this.renderer_ref.domElement.captureStream(this.fps)
    const recorder = new MediaRecorder(stream, {
      mimeType: this.supported_webm_mime_type(),
      videoBitsPerSecond: this.kbps * 1000
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = e => (e.data.size !== 0) && chunks.push(e.data)

    const stopped = new Promise(r => recorder.onstop = r)

    recorder.start()

    await new Promise(res => setTimeout(res, duration_in_sec * 1000))

    recorder.stop()

    await stopped

    // restore the renderer size and pixel ratio
    this.renderer_ref.setSize(old_size.x, old_size.y, false)
    this.renderer_ref.setPixelRatio(old_pr)

    return new File(chunks, fileName, { type: this.supported_webm_mime_type() })
  }

  private supported_webm_mime_type (): string {
    const prefs = ['video/webm;codecs=av01', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    return prefs.find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
  }
}
