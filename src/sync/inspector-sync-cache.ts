/**
 * 光标联动同步的缓存与节流
 *
 * 背景：`selectionchange` 在敲字时每个字符都会触发，而每次同步最多会向内核发起 4 次
 * getBlockAttrs 往返。大文档持续编辑时这会成为内核 CPU 的稳定背景负载。
 *
 * 三层削减：
 * 1. 内存优先（buildCompiledIalIndex）：编译模型里已有全部块的 IAL，命中即免内核调用
 * 2. 短 TTL 缓存（BlockAttrCache）：未命中编译模型时合并短时间内的重复查询
 * 3. 同块节流（InspectorSyncThrottle）：同一块的重复触发在时间窗内只处理一次
 *
 * 正确性前提：属性变更都会以 ws transaction (updateAttrs) 推送到插件并写入即时覆盖层，
 * 而覆盖层在合并时优先级高于缓存与编译模型，故缓存不会掩盖真实变更。
 */

import type { ISlidevDocument } from "../types/slidev-protocol"

export interface IBlockAttrCacheEntry {
  attrs: Record<string, string>
  at: number
}

/** 块属性查询的短 TTL 缓存 */
export class BlockAttrCache {
  private entries = new Map<string, IBlockAttrCacheEntry>()

  constructor(private ttlMs = 400) {}

  public get(id: string, now: number = Date.now()): Record<string, string> | undefined {
    if (!id) return undefined
    const entry = this.entries.get(id)
    if (!entry) return undefined
    if (now - entry.at > this.ttlMs) {
      this.entries.delete(id)
      return undefined
    }
    return entry.attrs
  }

  public set(id: string, attrs: Record<string, string>, now: number = Date.now()): void {
    if (!id || !attrs) return
    this.entries.set(id, { attrs, at: now })
  }

  public invalidate(id?: string): void {
    if (id) {
      this.entries.delete(id)
    } else {
      this.entries.clear()
    }
  }

  public get size(): number {
    return this.entries.size
  }
}

/**
 * 由编译模型构建 块 ID → IAL 索引（同一文档对象只构建一次由调用方负责）
 */
export function buildCompiledIalIndex(doc: ISlidevDocument | null | undefined): Map<string, Record<string, string>> {
  const index = new Map<string, Record<string, string>>()
  if (!doc?.slides) return index

  const collect = (blocks?: Array<{ id?: string; ial?: Record<string, string> }>) => {
    for (const block of blocks || []) {
      if (block?.id && block.ial) {
        index.set(block.id, block.ial)
      }
    }
  }

  for (const slide of doc.slides) {
    collect(slide.blocks as any)
    collect(slide.noteBlocks as any)
  }
  return index
}

/** 同一块的重复联动节流 */
export class InspectorSyncThrottle {
  private lastBlockId = ""
  private lastAt = 0

  constructor(private windowMs = 150) {}

  /** 是否应跳过本次同步（同块且仍在时间窗内） */
  public shouldSkip(blockId: string, now: number = Date.now()): boolean {
    if (blockId && blockId === this.lastBlockId && now - this.lastAt < this.windowMs) {
      return true
    }
    this.lastBlockId = blockId
    this.lastAt = now
    return false
  }

  public reset(): void {
    this.lastBlockId = ""
    this.lastAt = 0
  }
}
