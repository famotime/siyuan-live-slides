import { WebSandboxBridge } from "./web-sandbox-bridge"

export type TEngineMode = "web-sandbox" | "pro-cli"

export class EngineManager {
  private mode: TEngineMode = "web-sandbox"
  public readonly webBridge: WebSandboxBridge

  constructor() {
    this.webBridge = new WebSandboxBridge()
  }

  public getMode(): TEngineMode {
    return this.mode
  }

  public setMode(mode: TEngineMode): void {
    this.mode = mode
  }

  public destroy(): void {
    this.webBridge.detach()
  }
}
