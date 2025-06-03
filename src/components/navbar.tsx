"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Search className="h-6 w-6" />
            <span className="hidden font-bold sm:inline-block">
              GooSearch
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <div className="hidden md:block">
              <p className="text-sm text-muted-foreground">
                AI 增强的谷歌搜索引擎
              </p>
            </div>
          </div>
          <nav className="flex items-center">
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
