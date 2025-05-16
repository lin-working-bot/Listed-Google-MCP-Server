import React from "react"

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          © {new Date().getFullYear()} GooSearch. 使用 AI 增强的搜索结果，由 Shadcn UI 和 Next.js 驱动
        </p>
      </div>
    </footer>
  )
}
