import { computed, type ComputedRef, type Ref } from "vue"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { isDividerBlockType } from "@/sync/inspector-slide-resolver"

export interface IPageAttrSource {
  activeBlockId: Ref<string>
  activeBlockType: Ref<string>
  activeBlockAttrs: Ref<Record<string, string>>
  currentPageDividerId: Ref<string>
}

export interface IPageAttrResolveOptions {
  /** 目标属性常量 (custom-slidev-*) */
  attrKey: string
  /** 覆写层也缺失时的取值函数（通常读取目标页 frontmatter 并带默认值） */
  fallback: () => string
  /**
   * 前两级查找的匹配模式：
   * - defined：值存在即生效（空串也算，如 mask 系列）
   * - truthy：非空才生效（如 layout-ratio）
   */
  mode?: "defined" | "truthy"
}

/**
 * 分页符页面属性三级查找工厂：
 * 1. 激活块本身是分页符时，读取其直接属性字典；
 * 2. 读取编译器内存覆写层（前置分页符 ID 优先，激活分页符自身兜底）；
 * 3. 回退到调用方提供的目标页 frontmatter 取值函数。
 */
export function createPageAttrResolver(source: IPageAttrSource) {
  const isDivider = computed(() => isDividerBlockType(source.activeBlockType.value))

  function resolvePageAttr(options: IPageAttrResolveOptions): ComputedRef<string> {
    const { attrKey, fallback, mode = "defined" } = options
    const matches = (value: string | undefined) => (mode === "truthy" ? value : value !== undefined)
    return computed(() => {
      if (isDivider.value) {
        const direct = source.activeBlockAttrs.value[attrKey]
        if (matches(direct)) {
          return direct as string
        }
      }
      const divId = source.currentPageDividerId.value || (isDivider.value ? source.activeBlockId.value : "")
      if (divId) {
        const override = globalDocumentCompiler.getBlockAttrOverride(divId)
        if (matches(override?.[attrKey])) {
          return override![attrKey]
        }
      }
      return fallback()
    })
  }

  return { isDivider, resolvePageAttr }
}
