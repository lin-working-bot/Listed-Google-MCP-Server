'use client';

import { useState } from 'react';
import { marked } from 'marked';
import { Search, Sparkles } from 'lucide-react'; // 添加 Sparkles 图标
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function SearchForm() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setError('请输入搜索内容');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        throw new Error('搜索请求失败');
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.response);
      }
    } catch (error: any) {
      setError(error.message || '搜索过程中出现错误');
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-pink-500/5 via-background to-blue-500/5">
      <Card className="w-full max-w-4xl mx-auto shadow-xl border-primary/20 dark:border-primary/30 backdrop-blur-sm bg-background/95 relative overflow-hidden">
        {/* 彩色顶部边框 */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"></div>
        {/* 背景装饰 */}
        <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full bg-gradient-to-br from-pink-500/10 to-blue-500/10 blur-3xl"></div>
        <div className="absolute -left-24 -bottom-24 w-64 h-64 rounded-full bg-gradient-to-br from-blue-500/10 to-pink-500/10 blur-3xl"></div>
        <CardHeader className="text-center space-y-6 pt-8">
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-pink-500/20 blur-sm"></div>
                <Sparkles className="w-10 h-10 text-pink-500 relative z-10 animate-pulse" />
              </div>
              <CardTitle className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                GooSearch
              </CardTitle>
            </div>
            <CardDescription className="text-xl font-medium px-4 py-2 rounded-full bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 max-w-max mx-auto">
              AI 增强的谷歌搜索引擎
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4 max-w-2xl mx-auto">
            <div className="flex space-x-2 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入您的搜索内容..."
                className="flex-1 pr-28 transition-all duration-300 border-transparent focus-visible:ring-pink-500/30 group-hover:border-transparent h-14 text-lg rounded-lg relative z-10 bg-background/80 backdrop-blur-sm"
                autoFocus
              />
              <Button
                type="submit"
                disabled={isLoading}
                className="absolute right-0.5 top-0.5 bottom-0.5 h-[calc(100%-4px)] px-6 rounded-l-none rounded-r-md transition-all duration-300 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:shadow-lg hover:shadow-pink-500/20 hover:scale-[1.02] z-20"
              >
                {isLoading ? (
                  <>
                    <svg className="mr-2 h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-medium">搜索中...</span>
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    <span className="font-medium">搜索</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md animate-in slide-in-from-top-2">
              <p className="flex items-center">
                <span className="mr-2">⚠️</span>
                {error}
              </p>
            </div>
          )}

          {isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-20 w-20 animate-ping rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20 blur-sm"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-r-2 border-pink-500"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-70 blur-sm"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white animate-pulse" />
                </div>
              </div>
              <p className="mt-8 text-lg font-medium text-center text-muted-foreground animate-pulse max-w-xs">
                正在搜索并分析结果，请稍候...
              </p>
              <div className="mt-4 h-1.5 w-48 bg-gray-200 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 animate-gradient-x"></div>
                <div className="absolute inset-0 w-1/3 bg-white/30 animate-loading rounded-full"></div>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-8 animate-in fade-in-50 duration-500">
              <div className="relative py-4">
                <Separator className="absolute left-0 right-0" />
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-background px-4">
                  <div className="h-8 flex items-center justify-center space-x-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-pink-500"></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-purple-500"></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-6 rounded-xl bg-gradient-to-br from-pink-500/5 via-background to-blue-500/5 border border-pink-500/10 dark:border-blue-500/10 relative overflow-hidden">
                {/* 闪光效果 */}
                <div className="absolute inset-0 w-full h-full bg-[linear-gradient(to_right,theme(colors.transparent)_0%,theme(colors.white/10)_20%,theme(colors.white/5)_60%,theme(colors.transparent)_100%)] animate-shimmer"></div>
                <div className="relative z-10">
                  <div className="prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none prose-headings:text-center prose-headings:bg-gradient-to-r prose-headings:from-pink-500 prose-headings:via-purple-500 prose-headings:to-blue-500 prose-headings:bg-clip-text prose-headings:text-transparent prose-a:text-pink-500 hover:prose-a:text-pink-600 prose-img:rounded-lg prose-img:shadow-md prose-pre:bg-muted/50 prose-pre:shadow-sm prose-table:mx-auto prose-table:border-collapse prose-th:bg-pink-500/10 prose-th:text-pink-600 dark:prose-th:text-pink-400 prose-td:border-pink-200/20 dark:prose-td:border-pink-700/20">
                    <div dangerouslySetInnerHTML={{ __html: marked(result) }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && !result && (
            <div className="py-16 text-center">
              <div className="relative mx-auto mb-8">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-28 w-28 rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20 blur-xl animate-pulse"></div>
                </div>
                <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-pink-500/30 animate-[spin_20s_linear_infinite]"></div>
                  <Search className="h-12 w-12 text-pink-500" />
                </div>
              </div>
              <h3 className="mb-4 text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent inline-block">开始探索</h3>
              <p className="text-muted-foreground max-w-md mx-auto text-lg">
                输入您的搜索内容，让 AI 为您提供更智能的搜索结果分析
              </p>
              <div className="mt-6 flex justify-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-pink-500 animate-bounce"></div>
                <div className="h-2 w-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]"></div>
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col items-center pt-6 pb-8 relative">
          {/* 彩色分隔线 */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/50 to-transparent"></div>

          <div className="w-full max-w-md mx-auto text-center">
            <p className="text-base font-medium bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent inline-block mb-2">
              使用 AI 增强的搜索结果分析
            </p>
            <div className="flex items-center justify-center space-x-2 mt-2">
              <div className="px-3 py-1 rounded-full bg-pink-500/10 text-xs font-medium text-pink-500 flex items-center">
                <span className="mr-1">✨</span>
                <span>Shadcn UI</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-purple-500/10 text-xs font-medium text-purple-500 flex items-center">
                <span className="mr-1">⚡</span>
                <span>Next.js</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-blue-500/10 text-xs font-medium text-blue-500 flex items-center">
                <span className="mr-1">🤖</span>
                <span>AI 增强</span>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

