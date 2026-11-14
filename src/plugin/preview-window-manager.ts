import { openTab, openWindow, getFrontend } from 'siyuan'
import { isFeatureDisabled } from '@/feature-flags/feature-flags'
import { isPreviewTabMounted } from '@/main'

export const TAB_TYPE = "slides-preview-tab"
export const PRESENTER_TAB_TYPE = "slides-presenter-tab"

export interface IPreviewWindowManagerHost {
  app: any
  name: string
  displayName?: string
  currentDocId: string
  previewTab: any
  latestCompiledDoc: any
  getActiveDocumentId(): string
  fetchDocumentTitle(docId: string): Promise<string>
  buildPreviewTabTitle(docTitle?: string): string
  updatePreviewTabHeader(docTitle?: string, targetDocId?: string): Promise<void>
  compileCurrentDocument(docId: string, options?: any): Promise<any>
}

/**
 * 演示预览与演讲者页签及独立窗口生命周期管理器
 */
export class PreviewWindowManager {
  private host: IPreviewWindowManagerHost

  constructor(host: IPreviewWindowManagerHost) {
    this.host = host
  }

  public async openBottomPreviewTab(): Promise<void> {
    if (!this.host.currentDocId) {
      this.host.currentDocId = this.host.getActiveDocumentId()
    }
    const initialDocTitle = this.host.currentDocId ? await this.host.fetchDocumentTitle(this.host.currentDocId) : ""
    const initialTitle = this.host.buildPreviewTabTitle(initialDocTitle)
    await openTab({
      app: this.host.app,
      custom: {
        id: this.host.name + TAB_TYPE,
        title: initialTitle,
        icon: "iconSlides",
        data: { docId: this.host.currentDocId },
      },
      position: "bottom",
    })
    if (this.host.currentDocId) {
      this.host.compileCurrentDocument(this.host.currentDocId)
    }
    void this.host.updatePreviewTabHeader(initialDocTitle, this.host.currentDocId)
  }

  public async openPresenterTab(): Promise<void> {
    if (isFeatureDisabled("presenterMode")) {
      return
    }
    if (!isPreviewTabMounted()) {
      await this.openBottomPreviewTab()
    }
    await openTab({
      app: this.host.app,
      custom: {
        id: this.host.name + PRESENTER_TAB_TYPE,
        title: "演讲者控制台",
        icon: "iconSlides",
        data: {},
      },
      position: "right",
    })
  }

  public async openStandalonePreviewWindow(): Promise<void> {
    if (!this.host.currentDocId) {
      this.host.currentDocId = this.host.getActiveDocumentId()
    }
    if (this.host.currentDocId && !this.host.latestCompiledDoc) {
      await this.host.compileCurrentDocument(this.host.currentDocId, { reason: "explicit" })
    }

    const frontEnd = getFrontend()
    if (frontEnd === "browser-desktop" || frontEnd === "browser-mobile") {
      if (typeof window !== "undefined" && typeof window.open === "function") {
        window.open(
          "/plugins/siyuan-live-slides/slides-client/index.html",
          "SlidesBigScreenWindow",
          "width=1280,height=760,menubar=no,toolbar=no,location=no,status=no",
        )
      }
      return
    }

    let targetTab = this.host.previewTab
    if (!targetTab) {
      const initialDocTitle = this.host.currentDocId ? await this.host.fetchDocumentTitle(this.host.currentDocId) : ""
      const initialTitle = this.host.buildPreviewTabTitle(initialDocTitle)
      const opened = await openTab({
        app: this.host.app,
        custom: {
          id: this.host.name + TAB_TYPE,
          title: initialTitle,
          icon: "iconSlides",
          data: { docId: this.host.currentDocId },
        },
        position: "bottom",
      })
      targetTab = this.host.previewTab || (opened as any)
    }

    if (targetTab) {
      if (this.host.currentDocId && (targetTab as any).model) {
        ;(targetTab as any).model.data = {
          ...((targetTab as any).model.data || {}),
          docId: this.host.currentDocId,
        }
      }
      openWindow({
        tab: targetTab,
        width: 1280,
        height: 760,
      })
    }
  }
}
