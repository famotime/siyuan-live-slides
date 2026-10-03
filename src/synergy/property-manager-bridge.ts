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
}
