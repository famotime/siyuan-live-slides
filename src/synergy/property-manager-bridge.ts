import {
  ATTR_PAGE_TRANSITION,
} from "../types/slidev-protocol"
import type { ISlidevPresetTemplate } from "./preset-templates"
import { SLIDEV_PRESET_TEMPLATES } from "./preset-templates"

export class PropertyManagerBridge {
  /**
   * 获取预设 Slidev 属性模板列表
   */
  public getPresetTemplates(): ISlidevPresetTemplate[] {
    return SLIDEV_PRESET_TEMPLATES
  }

  /**
   * 生成检索全库所有包含 Slidev 属性的块 SQL
   */
  public buildScanSlidevBlocksSql(attrKeyPrefix = "custom-slidev-"): string {
    return `SELECT block_id, name, value FROM attributes WHERE name LIKE '${attrKeyPrefix}%' ORDER BY block_id ASC`
  }

  /**
   * 生成统计全库 Slidev 转场效果分布的 SQL
   */
  public buildTransitionStatsSql(): string {
    return `SELECT value, count(1) as count FROM attributes WHERE name = '${ATTR_PAGE_TRANSITION}' GROUP BY value ORDER BY count DESC`
  }

  /**
   * 批量将全库从旧转场替换为新转场
   */
  public async batchUpdateTransitions(
    fromTrans: string,
    toTrans: string,
    sqlExecutor: (sqlStr: string) => Promise<any[]>,
    setAttrsFn: (blockId: string, attrs: Record<string, string>) => Promise<any>,
  ): Promise<{ updatedCount: number }> {
    const findSql = `SELECT block_id FROM attributes WHERE name = '${ATTR_PAGE_TRANSITION}' AND value = '${fromTrans}'`
    const rows = await sqlExecutor(findSql)
    let updatedCount = 0

    if (Array.isArray(rows)) {
      for (const row of rows) {
        const blockId = row.block_id || row.blockId
        if (blockId) {
          await setAttrsFn(blockId, { [ATTR_PAGE_TRANSITION]: toTrans })
          updatedCount++
        }
      }
    }

    return { updatedCount }
  }

  /**
   * 批量将全库从旧版式替换为新版式
   */
  public async batchUpdateLayout(
    fromLayout: string,
    toLayout: string,
    sqlExecutor: (sqlStr: string) => Promise<any[]>,
    setAttrsFn: (blockId: string, attrs: Record<string, string>) => Promise<any>,
  ): Promise<{ updatedCount: number }> {
    const findSql = `SELECT block_id FROM attributes WHERE name = 'custom-slidev-layout' AND value = '${fromLayout}'`
    const rows = await sqlExecutor(findSql)
    let updatedCount = 0

    if (Array.isArray(rows)) {
      for (const row of rows) {
        const blockId = row.block_id || row.blockId
        if (blockId) {
          await setAttrsFn(blockId, { "custom-slidev-layout": toLayout })
          updatedCount++
        }
      }
    }

    return { updatedCount }
  }

  /**
   * 导出可直接供属性管家导入的标准 templates.json 格式数据
   */
  public exportTemplatesJson(): string {
    const templates = this.getPresetTemplates()
    return JSON.stringify({
      templates,
      counter: templates.length,
    }, null, 2)
  }

  /**
   * 格式化转场统计数据为易读的简报文本
   */
  public formatTransitionSummary(statsRows: Array<{ value: string; count: number | string }>): string {
    if (!statsRows || statsRows.length === 0) {
      return "全库目前暂无已设置 Slidev 转场效果的块"
    }
    const items = statsRows.map(r => `${r.value}: ${r.count} 个`).join("，")
    return `全库 Slidev 转场分布统计：${items}`
  }
}

