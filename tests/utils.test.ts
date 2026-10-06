import { describe, expect, it } from "vitest"
import {
  extractImageUrl,
  cleanCardListItemMarkdown,
  isListItemNode,
  getDomByVueComponent,
} from "../src/utils"

describe("Utils Layer & Markdown Helpers (RF-010)", () => {
  describe("1. extractImageUrl", () => {
    it("提取 Markdown 标准图片语法链接", () => {
      expect(extractImageUrl("![封面](assets/demo.png)")).toBe("assets/demo.png")
      expect(extractImageUrl("![标题](https://slidev.io/hero.jpg 'Slidev Cover')")).toBe("https://slidev.io/hero.jpg")
      expect(extractImageUrl("![参数](assets/cover.webp =400x300)")).toBe("assets/cover.webp")
    })

    it("提取 HTML <img> 标签中的图片地址", () => {
      expect(extractImageUrl('<img src="assets/bg.svg" alt="背景" />')).toBe("assets/bg.svg")
      expect(extractImageUrl('<img width="100%" class="rounded" src="https://cdn.example.com/photo.avif" />')).toBe("https://cdn.example.com/photo.avif")
    })

    it("提取直接图片文件路径或网络图片 URL", () => {
      expect(extractImageUrl("assets/illustration.png")).toBe("assets/illustration.png")
      expect(extractImageUrl("./assets/slide1.jpeg")).toBe("./assets/slide1.jpeg")
      expect(extractImageUrl("https://images.unsplash.com/sample.jpg?q=80")).toBe("https://images.unsplash.com/sample.jpg?q=80")
    })

    it("非图片文本或无效输入返回 null", () => {
      expect(extractImageUrl("")).toBeNull()
      expect(extractImageUrl("普通纯文本内容")).toBeNull()
      expect(extractImageUrl("https://slidev.org/docs")).toBeNull()
      expect(extractImageUrl(undefined, undefined)).toBeNull()
    })
  })

  describe("2. cleanCardListItemMarkdown", () => {
    it("清洗首行无序列表标记 (- / * / +)", () => {
      expect(cleanCardListItemMarkdown("- 核心特性一")).toBe("核心特性一")
      expect(cleanCardListItemMarkdown("* 核心特性二")).toBe("核心特性二")
      expect(cleanCardListItemMarkdown("+ 核心特性三")).toBe("核心特性三")
    })

    it("清洗首行有序列表标记 (1. / 10.)", () => {
      expect(cleanCardListItemMarkdown("1. 步骤第一步")).toBe("步骤第一步")
      expect(cleanCardListItemMarkdown("10. 步骤第十步")).toBe("步骤第十步")
    })

    it("处理多行嵌套卡片并准确去除首层缩进", () => {
      const input = "- 卡片主标题\n  - 子要点 1\n  - 子要点 2\n    说明文字"
      const expected = "卡片主标题\n- 子要点 1\n- 子要点 2\n  说明文字"
      expect(cleanCardListItemMarkdown(input)).toBe(expected)
    })

    it("非列表格式文本保持原样", () => {
      expect(cleanCardListItemMarkdown("## 章节标题")).toBe("## 章节标题")
      expect(cleanCardListItemMarkdown("普通文本段落")).toBe("普通文本段落")
      expect(cleanCardListItemMarkdown("")).toBe("")
    })
  })

  describe("3. isListItemNode", () => {
    it("识别类型为 i 或 nodelistitem 的列表项块", () => {
      expect(isListItemNode({ type: "i", markdown: "项目内容" })).toBe(true)
      expect(isListItemNode({ type: "NodeListItem", content: "项目" })).toBe(true)
    })

    it("识别类型为 l 或 nodelist 的列表容器块", () => {
      expect(isListItemNode({ type: "l" })).toBe(true)
      expect(isListItemNode({ type: "NodeList" })).toBe(true)
    })

    it("通过 Markdown 语法识别普通块中的列表前缀", () => {
      expect(isListItemNode({ type: "p", markdown: "- 列表文本" })).toBe(true)
      expect(isListItemNode({ type: "p", rawMarkdown: "1. 序号文本" } as any)).toBe(true)
    })

    it("非列表项与空值安全返回 false", () => {
      expect(isListItemNode({ type: "p", markdown: "普通段落" })).toBe(false)
      expect(isListItemNode({ type: "h", markdown: "# 标题" })).toBe(false)
      expect(isListItemNode(null)).toBe(false)
      expect(isListItemNode(undefined)).toBe(false)
    })
  })

  describe("4. getDomByVueComponent", () => {
    it("在缺少 DOM 环境时抛出友好异常", () => {
      const dummyComponent = { template: "<div>test</div>" }
      if (typeof document === "undefined") {
        expect(() => getDomByVueComponent(dummyComponent)).toThrow("getDomByVueComponent can only be run in DOM environments")
      }
    })
  })
})
