/**
 * Copyright (c) 2023 frostime. All rights reserved.
 * https://github.com/frostime/sy-plugin-template-vite
 *
 * See API Document in [API.md](https://github.com/siyuan-note/siyuan/blob/master/docs/API.md)
 * API 文档见 [API_zh_CN.md](https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md)
 *
 * RF-020: 已清理官方模板残留的零引用导出，仅保留本插件实际使用的内核 API 封装。
 */

import {
  fetchSyncPost,
  IWebSocketData,
} from "siyuan"

async function request(url: string, data: any) {
  const response: IWebSocketData = await fetchSyncPost(url, data)
  const res = response.code === 0 ? response.data : null
  return res
}

// **************************************** Noteboook ****************************************

export async function lsNotebooks(): Promise<IReslsNotebooks> {
  const url = "/api/notebook/lsNotebooks"
  return request(url, "")
}

// **************************************** File Tree ****************************************
export async function createDocWithMd(
  notebook: NotebookId,
  path: string,
  markdown: string,
): Promise<DocumentId> {
  const data = {
    notebook,
    path,
    markdown,
  }
  const url = "/api/filetree/createDocWithMd"
  return request(url, data)
}

// **************************************** Asset Files ****************************************

export async function upload(
  assetsDirPath: string,
  files: any[],
): Promise<IResUpload> {
  const form = new FormData()
  form.append("assetsDirPath", assetsDirPath)
  for (const file of files) {
    form.append("file[]", file)
  }
  const url = "/api/asset/upload"
  return request(url, form)
}

// **************************************** Block ****************************************
type DataType = "markdown" | "dom"
export async function insertBlock(
  dataType: DataType,
  data: string,
  nextID?: BlockId,
  previousID?: BlockId,
  parentID?: BlockId,
): Promise<IResdoOperations[]> {
  const payload = {
    dataType,
    data,
    nextID,
    previousID,
    parentID,
  }
  const url = "/api/block/insertBlock"
  return request(url, payload)
}

export async function appendBlock(
  dataType: DataType,
  data: string,
  parentID: BlockId | DocumentId,
): Promise<IResdoOperations[]> {
  const payload = {
    dataType,
    data,
    parentID,
  }
  const url = "/api/block/appendBlock"
  return request(url, payload)
}

export async function updateBlock(
  dataType: DataType,
  data: string,
  id: BlockId,
): Promise<IResdoOperations[]> {
  const payload = {
    dataType,
    data,
    id,
  }
  const url = "/api/block/updateBlock"
  return request(url, payload)
}

export async function deleteBlock(id: BlockId): Promise<IResdoOperations[]> {
  const data = {
    id,
  }
  const url = "/api/block/deleteBlock"
  return request(url, data)
}

export async function getBlockKramdown(
  id: BlockId,
): Promise<IResGetBlockKramdown> {
  const data = {
    id,
  }
  const url = "/api/block/getBlockKramdown"
  return request(url, data)
}

export async function getChildBlocks(
  id: BlockId,
): Promise<IResGetChildBlock[]> {
  const data = {
    id,
  }
  const url = "/api/block/getChildBlocks"
  return request(url, data)
}

/**
 * 获取文档内所有块 id 的**文档顺序**列表
 *
 * 内核实现见 kernel/model/blockinfo.go 的 getDocBlocksOrdersInTree：以 ast.Walk 前序遍历实时块树，
 * 因而结果是权威的文档序。注意 SQL blocks 表的 sort 列并非位置（kernel/sql/database.go 的 nSort
 * 返回的是块类型权重），不可用于排序。
 */
export async function getDocBlocksOrders(id: BlockId): Promise<string[]> {
  const url = "/api/block/getDocBlocksOrders"
  return request(url, { id })
}

// **************************************** Attributes ****************************************
export async function setBlockAttrs(
  id: BlockId,
  attrs: { [key: string]: string },
) {
  const data = {
    id,
    attrs,
  }
  const url = "/api/attr/setBlockAttrs"
  return request(url, data)
}

export async function getBlockAttrs(
  id: BlockId,
): Promise<{ [key: string]: string }> {
  const data = {
    id,
  }
  const url = "/api/attr/getBlockAttrs"
  return request(url, data)
}

// **************************************** SQL ****************************************

export async function sql(sql: string): Promise<any[]> {
  const sqldata = {
    stmt: sql,
  }
  const url = "/api/query/sql"
  return request(url, sqldata)
}

// **************************************** File ****************************************

export async function putFile(path: string, isDir: boolean, file: any) {
  const form = new FormData()
  form.append("path", path)
  form.append("isDir", isDir.toString())
  // Copyright (c) 2023, terwer.
  // https://github.com/terwer/siyuan-plugin-importer/blob/v1.4.1/src/api/kernel-api.ts
  form.append("modTime", Math.floor(Date.now() / 1000).toString())
  form.append("file", file)
  const url = "/api/file/putFile"
  return request(url, form)
}

// **************************************** AI (v3.8+) ****************************************

export async function chatAI(prompt: string): Promise<string | null> {
  const url = "/api/ai/chatGPT"
  try {
    const res = await request(url, { msg: prompt })
    if (typeof res === "string" && res.trim().length > 0) return res.trim()
    if (res && typeof (res as any).content === "string" && (res as any).content.trim().length > 0) {
      return (res as any).content.trim()
    }
    return null
  } catch {
    return null
  }
}

// **************************************** Storage / Inline Styles ****************************************

export async function getInlineStyles(): Promise<any> {
  const url = "/api/storage/getInlineStyles"
  return request(url, "")
}
