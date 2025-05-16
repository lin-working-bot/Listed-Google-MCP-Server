'use client';

import { useState, useEffect } from 'react';
import { marked } from 'marked';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [responseSource, setResponseSource] = useState('');
  const [entityCount, setEntityCount] = useState(0);

  // 从 localStorage 加载保存的搜索结果
  useEffect(() => {
    // 只在客户端执行
    if (typeof window !== 'undefined') {
      const savedQuery = localStorage.getItem('lastQuery');
      const savedResult = localStorage.getItem('lastResult');
      const savedResponseSource = localStorage.getItem('lastResponseSource');
      const savedEntityCount = localStorage.getItem('lastEntityCount');

      if (savedQuery) setQuery(savedQuery);
      if (savedResult) setResult(savedResult);
      if (savedResponseSource) setResponseSource(savedResponseSource);
      if (savedEntityCount) setEntityCount(parseInt(savedEntityCount, 10) || 0);
    }
  }, []);

  // 配置 marked 库
  useEffect(() => {
    // 设置 marked 选项
    marked.use({
      gfm: true, // 启用 GitHub 风格的 Markdown
      breaks: true, // 启用换行符
      tables: true, // 确保表格支持
      headerIds: false, // 禁用标题ID生成
      mangle: false, // 禁用标题ID混淆
    });
  }, []);

  // 简单的带超时功能的fetch函数
  const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 1200000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`发送请求到 ${url}`);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`请求失败，状态码: ${response.status}, 错误信息: ${errorText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // 清除搜索结果和本地存储
  const clearResults = () => {
    setQuery('');
    setResult('');
    setResponseSource('');
    setEntityCount(0);
    setError('');

    // 清除 localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lastQuery');
      localStorage.removeItem('lastResult');
      localStorage.removeItem('lastResponseSource');
      localStorage.removeItem('lastEntityCount');
    }

    console.log('搜索结果已清除');
  };

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
      // 添加随机参数，确保不使用缓存
      const timestamp = Date.now();
      const randomParam = Math.random().toString(36).substring(2, 15);

      console.log('发起新的搜索请求，不使用缓存');

      // 使用简单的带超时功能的fetch函数，超时时间为10分钟
      const response = await fetchWithTimeout(`/api/search?_=${timestamp}&r=${randomParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({
          query: query.trim()
        })
      }, 1200000); // 超时时间设为600秒（10分钟）

      // 添加响应处理的性能监控
      console.log('开始处理响应数据...');
      const processStartTime = Date.now();

      const data = await response.json();
      console.log('JSON解析完成，耗时:', (Date.now() - processStartTime) / 1000, '秒');

      if (data.error) {
        setError(data.error);
      } else {
        // 添加调试信息
        console.log(`搜索完成，获取到结果大小:`, JSON.stringify(data).length, '字节');

        if (!data.response) {
          setError('服务器返回了空结果');
          return;
        }

        // 检查响应是否是有效的Markdown表格
        if (!data.response.includes('|') || !data.response.includes('-')) {
          console.warn('响应可能不是有效的Markdown表格格式');
        }

        // 分批处理大型响应，避免UI阻塞
        setTimeout(() => {
          // 设置搜索结果
          setResult(data.response);

          // 保存搜索结果到 localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('lastQuery', query.trim());
            localStorage.setItem('lastResult', data.response);
            localStorage.setItem('lastResponseSource', data.responseSource || 'Unknown');
            localStorage.setItem('lastEntityCount', String(data.entityCount || 0));
          }

          console.log('结果渲染完成，总耗时:', (Date.now() - processStartTime) / 1000, '秒');
          console.log('搜索结果已保存到 localStorage');
        }, 100);

        // 设置响应来源和实体数量
        setResponseSource(data.responseSource || 'Unknown');
        setEntityCount(data.entityCount || 0);

        console.log(`响应来源: ${data.responseSource}, 实体数量: ${data.entityCount}`);
      }
    } catch (error: any) {
      // 处理超时错误
      if (error.name === 'AbortError') {
        setError('搜索请求超时，请尝试简化您的搜索内容或稍后再试');
      } else {
        setError(error.message || '搜索过程中出现错误');
      }
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center" style={{
      background: `linear-gradient(135deg, rgb(var(--mint-start)), rgb(var(--mint-mid)), rgb(var(--mint-end)))`,
      backgroundSize: '200% 200%',
      animation: 'gradient 15s ease infinite'
    }}>
      {/* 背景装饰元素 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white opacity-10 rounded-full"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>
        <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-white opacity-5 rounded-full"></div>
        <div className="absolute bottom-1/4 left-1/3 w-20 h-20 bg-white opacity-5 rounded-full"></div>
      </div>

      {/* 主内容容器 */}
      <Card className="max-w-4xl w-full mx-4 my-8 glass-effect shadow-2xl overflow-hidden z-10 fade-in">
        {/* 彩色顶部边框 */}
        <div className="h-1.5 bg-gradient-to-r from-[rgb(var(--mint-start))] to-[rgb(var(--mint-end))]"></div>

        <CardHeader className="text-center">
          <CardTitle className="text-5xl font-bold bg-gradient-to-r from-[rgb(var(--mint-start))] to-[rgb(var(--mint-end))] text-transparent bg-clip-text">
            GooSearch
          </CardTitle>
          <CardDescription className="text-lg">
            AI 增强的谷歌搜索引擎
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* 搜索表单 */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:gap-0">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="输入您的搜索内容..."
                  className="w-full px-5 py-7 border-2 border-[rgba(var(--mint-mid),0.3)] rounded-lg md:rounded-r-none focus-visible:ring-[rgb(var(--mint-start))] text-center h-auto text-lg shadow-sm"
                  autoFocus
                />
                {!isLoading && query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-r from-[rgb(var(--mint-start))] to-[rgb(var(--mint-end))] text-white px-8 py-7 rounded-lg md:rounded-l-none font-medium transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px] h-auto text-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    搜索中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    搜索
                  </span>
                )}
              </Button>
            </div>

            {/* 已删除强制刷新选项 */}
          </form>

          <Separator className="my-6 bg-[rgba(var(--mint-mid),0.1)]" />

          {/* 错误提示 */}
          {error && (
            <div className="p-5 bg-[rgba(var(--accent-1),0.1)] border-l-4 border-[rgb(var(--accent-1))] text-[rgb(var(--text-primary))] rounded-lg shadow-sm fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-[rgb(var(--accent-1))]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-base font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {isLoading && (
            <div className="text-center py-10 fade-in">
              <p className="text-[rgb(var(--mint-start))] font-medium text-xl mb-4">正在搜索并分析结果</p>
              <p className="text-[rgb(var(--text-secondary))] text-base max-w-md mx-auto mb-4">
                我们正在爬取和分析相关网页，这可能需要一些时间（通常1-3分钟），取决于查询的复杂性
              </p>
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="w-16 h-16 border-4 border-[rgba(var(--mint-start),0.2)] border-t-[rgb(var(--mint-start))] rounded-full animate-spin mx-auto shadow-md"></div>
                <div className="text-[rgb(var(--mint-mid))] font-medium text-lg animate-pulse">
                  请耐心等待，系统正在处理中...
                </div>
              </div>
            </div>
          )}

          {/* 搜索结果 */}
          {result && (
            <Card className="mt-8 card-hover fade-in border border-[rgba(var(--mint-mid),0.2)] shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-[rgb(var(--mint-start))] to-[rgb(var(--mint-end))] px-6 py-4 text-center relative">
                <h2 className="text-xl font-bold text-white">搜索结果</h2>
                <div className="flex justify-center mt-2 space-x-4">
                  <span className="inline-flex items-center px-2 py-1 bg-white/20 rounded-full text-xs font-medium text-white">
                    数据来源: {responseSource === 'AI' ? 'AI生成' : responseSource === 'Cache' ? '缓存' : '自动生成'}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 bg-white/20 rounded-full text-xs font-medium text-white">
                    实体数量: {entityCount}
                  </span>
                </div>

                {/* 清除按钮 */}
                <button
                  onClick={clearResults}
                  className="absolute right-4 top-4 text-white/70 hover:text-white transition-colors"
                  title="清除结果"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <CardContent className="p-6 md:p-8">
                {/* 渲染Markdown内容 */}
                <div
                  dangerouslySetInnerHTML={{ __html: marked.parse(result) }}
                  className="prose max-w-none prose-headings:text-center prose-headings:text-[rgb(var(--text-primary))] prose-a:text-[rgb(var(--mint-start))] prose-strong:text-[rgb(var(--mint-start))] prose-table:border-collapse prose-table:mx-auto prose-table:w-full prose-td:text-center prose-th:text-center prose-th:bg-[rgb(var(--mint-start))] prose-th:text-white"
                />

                {/* 添加表格渲染状态提示 */}
                <div className="mt-8 text-center">
                  {result.includes('|') && result.includes('-') ? (
                    <div className="inline-flex items-center px-4 py-2 bg-[rgba(var(--mint-start),0.1)] text-[rgb(var(--mint-start))] rounded-full text-sm font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      表格已成功渲染
                    </div>
                  ) : (
                    <div className="inline-flex items-center px-4 py-2 bg-[rgba(var(--accent-2),0.1)] text-[rgb(var(--accent-2))] rounded-full text-sm font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      未检测到表格格式
                    </div>
                  )}
                </div>

                {/* 始终显示原始结果，确保用户能看到内容 */}
                <div className="mt-8 p-6 bg-[rgba(var(--accent-2),0.05)] border border-[rgba(var(--accent-2),0.2)] rounded-xl">
                  <h3 className="text-[rgb(var(--text-primary))] font-semibold mb-4 text-center">原始响应</h3>
                  <pre className="whitespace-pre-wrap text-sm bg-white p-5 rounded-lg border border-[rgba(var(--mint-mid),0.2)] overflow-auto max-h-96 text-[rgb(var(--text-secondary))] text-left">
                    {result}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 空状态 */}
          {!isLoading && !error && !result && (
            <div className="text-center py-16 fade-in">
              <h3 className="text-3xl font-bold mb-5 bg-gradient-to-r from-[rgb(var(--mint-start))] to-[rgb(var(--mint-end))] bg-clip-text text-transparent">欢迎使用智能搜索</h3>
              <p className="text-[rgb(var(--text-secondary))] text-lg max-w-md mx-auto">
                输入您的搜索内容，让 AI 为您提供更智能的搜索结果分析
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t border-[rgba(var(--mint-mid),0.1)] bg-[rgba(var(--mint-start),0.03)] p-6 justify-center">
          <p className="text-[rgb(var(--text-secondary))] text-sm">
            使用 AI 增强的搜索结果分析 | Powered by Next.js
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
