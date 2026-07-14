
import * as THREE from 'three/webgpu';

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    // Cap DPR to avoid 3×/4× fill on retina without softening the soft-office look
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);

    // Ensure the canvas is sized by CSS so physical resizing is fluid
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    // Use default shadow map (PCF) as VSM support in WebGPU/NodeMaterial can be sensitive
    this.renderer.shadowMap.enabled = true;

    // Soft high-key contrast: ACES compresses chalky whites; mild exposure keeps the scene bright.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(this.renderer.domElement);
    this.timer = new THREE.Timer();
  }

  public async init() {
    await this.renderer.init();
  }

  public onResize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer.render(scene, camera);
  }

  public dispose() {
    this.renderer.dispose();
  }
}
