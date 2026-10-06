import { DEFAULT_STARTER_SNIPPETS } from "../engine/workspace-scaffolder"

export interface IImportSnippetOptions {
  virtualFiles?: Record<string, string>
  baseDir?: string
}

export interface IRawSlideData {
  frontmatter: Record<string, any>
  content: string
}

/**
 * 跨环境（Node/Electron 桌面宿主）安全尝试读取本地磁盘文件
 */
export function tryReadFsFile(targetPath: string): string | null {
  try {
    if (typeof process !== "undefined" && typeof require !== "undefined") {
      const fs = require("fs")
      if (fs.existsSync(targetPath)) {
        return fs.readFileSync(targetPath, "utf-8")
      }
    }
  } catch {
    // 浏览器沙箱环境安全跳过
  }
  return null
}

/**
 * 解析并展开 Slidev 外部代码切片语法: <<< @/snippets/external.ts#snippet 或 <<< ./snippets/foo.ts
 */
export function resolveCodeSnippet(
  rawSnippetDirective: string,
  options?: IImportSnippetOptions,
): string | null {
  const match = rawSnippetDirective.match(/^[ \t]*<<<[ \t]+([^\s]+)/)
  if (!match) return null

  const targetExpr = match[1].trim()
  const hashIdx = targetExpr.indexOf("#")
  const targetPath = hashIdx !== -1 ? targetExpr.slice(0, hashIdx) : targetExpr
  const regionName = hashIdx !== -1 ? targetExpr.slice(hashIdx + 1) : ""

  const cleanPath = targetPath.replace(/^@\//, "").replace(/^\.\//, "")
  const virtualFiles = options?.virtualFiles || {}

  let codeContent = virtualFiles[targetPath]
    || virtualFiles[cleanPath]
    || virtualFiles[`./${cleanPath}`]
    || virtualFiles[`@/${cleanPath}`]

  if (!codeContent && Object.keys(virtualFiles).length > 0) {
    const filename = cleanPath.split("/").pop()
    for (const [k, v] of Object.entries(virtualFiles)) {
      if (k.endsWith(`/${cleanPath}`) || (filename && k.endsWith(`/${filename}`))) {
        codeContent = v
        break
      }
    }
  }

  // 尝试从磁盘读取
  if (!codeContent) {
    const candidatePaths: string[] = []
    if (options?.baseDir) {
      try {
        const path = require("path")
        candidatePaths.push(path.resolve(options.baseDir, cleanPath))
        candidatePaths.push(path.resolve(options.baseDir, targetPath))
      } catch {}
    }
    try {
      const path = require("path")
      candidatePaths.push(path.resolve(process.cwd(), cleanPath))
    } catch {}

    for (const cp of candidatePaths) {
      const diskContent = tryReadFsFile(cp)
      if (diskContent !== null) {
        codeContent = diskContent
        break
      }
    }
  }

  // 尝试从内置 Slidev Starter 经典代码片段回退 (保证直接粘贴导入或离线时体验一致)
  if (!codeContent) {
    const starterSnippets = DEFAULT_STARTER_SNIPPETS || {}
    codeContent = starterSnippets[targetPath]
      || starterSnippets[cleanPath]
      || starterSnippets[`snippets/${cleanPath}`]
    if (!codeContent) {
      const filename = cleanPath.split("/").pop()
      for (const [k, v] of Object.entries(starterSnippets)) {
        if (k.endsWith(`/${cleanPath}`) || (filename && k.endsWith(`/${filename}`))) {
          codeContent = v
          break
        }
      }
    }
  }

  if (!codeContent) {
    return null
  }

  // 提取 region 区域代码
  let extractedCode = codeContent
  if (regionName) {
    const regionRegex = new RegExp(
      `(?:\\/\\/|\\/\\*|#)?\\s*#(?:region|REGION)\\s+${regionName}[^\\r\\n]*\\r?\\n([\\s\\S]*?)(?:\\/\\/|\\/\\*|#)?\\s*#(?:endregion|ENDREGION)\\s+${regionName}`,
      "i"
    )
    const rMatch = codeContent.match(regionRegex)
    if (rMatch) {
      const leadingCommentMatch = codeContent.match(/^(\/\/\s*Inside[^\r\n]+\r?\n)/i)
      const lead = leadingCommentMatch ? leadingCommentMatch[1] : ""
      extractedCode = lead + rMatch[1].trimEnd()
    }
  }

  // 推导代码块语言后缀
  const extMatch = cleanPath.match(/\.([a-zA-Z0-9]+)$/)
  const lang = extMatch ? extMatch[1] : ""

  return `\`\`\`${lang}\n${extractedCode}\n\`\`\``
}

/**
 * 剥离引号外的行内注释 #
 */
export function stripInlineComment(val: string): string {
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < val.length; i++) {
    const char = val[i]
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
    } else if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return val.slice(0, i).trim()
    }
  }
  return val.trim()
}

/**
 * 健壮轻量 YAML Frontmatter 解析器，支持多行块标量（含空行）、嵌套对象字典、引号剥离与行内注释
 */
export function parseYamlFrontmatter(yamlStr: string): Record<string, any> {
  const result: Record<string, any> = {}
  const lines = yamlStr.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      i++
      continue
    }

    const colonIdx = rawLine.indexOf(":")
    if (colonIdx > 0) {
      const key = rawLine.slice(0, colonIdx).trim()
      let val: any = rawLine.slice(colonIdx + 1).trim()

      // 1. 多行标量 (| 逐行保留, > 折叠为空格)
      if (val === "|" || val === ">") {
        i++
        const buffer: string[] = []
        let baseIndent = -1

        while (i < lines.length) {
          const mLine = lines[i]
          const mTrimmed = mLine.trim()

          if (!mTrimmed) {
            // 空行属于多行标量内部
            buffer.push("")
            i++
            continue
          }

          const indentMatch = mLine.match(/^(\s+)/)
          const currentIndent = indentMatch ? indentMatch[1].length : 0

          if (baseIndent === -1) {
            baseIndent = currentIndent
          }

          if (currentIndent < baseIndent) {
            // 缩进减小，多行块结束，交由外层循环继续解析
            break
          }

          buffer.push(mLine.slice(baseIndent))
          i++
        }

        while (buffer.length > 0 && buffer[buffer.length - 1] === "") {
          buffer.pop()
        }
        result[key] = val === ">" ? buffer.join(" ") : buffer.join("\n")
        continue
      }

      val = stripInlineComment(val)

      // 2. 嵌套对象 (key: 后面无标量值，下一行具有更大缩进)
      if (!val) {
        let j = i + 1
        const childLines: string[] = []
        let childBaseIndent = -1

        while (j < lines.length) {
          const cLine = lines[j]
          const cTrimmed = cLine.trim()

          if (!cTrimmed || cTrimmed.startsWith("#")) {
            if (childBaseIndent !== -1) {
              childLines.push("")
            }
            j++
            continue
          }

          const indentMatch = cLine.match(/^(\s+)/)
          const currentIndent = indentMatch ? indentMatch[1].length : 0

          if (childBaseIndent === -1) {
            if (currentIndent > 0) {
              childBaseIndent = currentIndent
            } else {
              break
            }
          }

          if (currentIndent < childBaseIndent) {
            break
          }

          childLines.push(cLine.slice(childBaseIndent))
          j++
        }

        if (childLines.length > 0) {
          result[key] = parseYamlFrontmatter(childLines.join("\n"))
          i = j
          continue
        }
      }

      // 3. 常规标量值
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      } else {
        if (val === "true") val = true
        else if (val === "false") val = false
        else if (val === "null") val = null
        else if (/^-?\d+(?:\.\d+)?$/.test(val)) val = Number(val)
      }

      result[key] = val
    }

    i++
  }

  return result
}

const RE_YAML_BLOCK = /^\s*```ya?ml([\s\S]*?)```/

/**
 * 从原始幻灯片 Markdown 中提取 Frontmatter 与主体正文
 */
export function extractSlideMatter(raw: string): IRawSlideData {
  let frontmatter: Record<string, any> = {}
  let content = raw.trim()

  const fmMatch = content.match(/^---[^\n\r]*\r?\n([\s\S]*?)\r?\n---(?=[ \t]*(?:\r?\n|$))/)
  if (fmMatch && !fmMatch[1].includes("```")) {
    const parsed = parseYamlFrontmatter(fmMatch[1])
    if (Object.keys(parsed).length > 0 || !fmMatch[1].trim()) {
      frontmatter = parsed
      content = content.slice(fmMatch[0].length).trim()
      return { frontmatter, content }
    }
  }

  // 若开头只是一行单独的 ---（段落分割线），剥离前导 --- 保持后续正文完好
  if (content.startsWith("---")) {
    const singleDividerMatch = content.match(/^---[^\n\r]*(?:\r?\n|$)/)
    if (singleDividerMatch) {
      content = content.slice(singleDividerMatch[0].length).trim()
    }
  }

  const ymlMatch = content.match(RE_YAML_BLOCK)
  if (ymlMatch) {
    frontmatter = parseYamlFrontmatter(ymlMatch[1])
    content = content.slice(ymlMatch[0].length).trim()
  } else {
    // 容错: 无闭合 --- 的单行/多行 key: val
    const lines = content.split(/\r?\n/)
    const yamlLines: string[] = []
    let bodyStart = 0
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim()
      if (!line) {
        if (yamlLines.length > 0) {
          bodyStart = idx + 1
          break
        }
        continue
      }
      if (/^[a-zA-Z0-9_-]+\s*:\s*.*/.test(line) && !line.startsWith("<") && !line.startsWith("#")) {
        yamlLines.push(line)
      } else {
        bodyStart = idx
        break
      }
    }
    if (yamlLines.length > 0) {
      frontmatter = parseYamlFrontmatter(yamlLines.join("\n"))
      content = lines.slice(bodyStart).join("\n").trim()
    }
  }

  return { frontmatter, content }
}
