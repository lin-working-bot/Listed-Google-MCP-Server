'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestConnectivity() {
  const [results, setResults] = useState<{[key: string]: string}>({});
  const [testing, setTesting] = useState(false);

  const testServices = async () => {
    setTesting(true);
    setResults({});

    const services = [
      {
        name: 'Google Search API',
        url: 'https://www.googleapis.com/customsearch/v1',
        method: 'GET'
      },
      {
        name: 'OpenAI Proxy',
        url: 'https://newapi.tu-zi.com/v1/models',
        method: 'GET'
      },
      {
        name: 'Local API',
        url: '/api/search',
        method: 'POST',
        body: JSON.stringify({ query: 'test' })
      }
    ];

    for (const service of services) {
      try {
        console.log(`Testing ${service.name}...`);
        
        const options: RequestInit = {
          method: service.method,
          headers: {
            'Content-Type': 'application/json',
          },
          ...(service.body && { body: service.body })
        };

        const response = await fetch(service.url, options);
        
        if (response.ok) {
          setResults(prev => ({
            ...prev,
            [service.name]: `✅ 成功 (${response.status})`
          }));
        } else {
          setResults(prev => ({
            ...prev,
            [service.name]: `❌ 失败 (${response.status}: ${response.statusText})`
          }));
        }
      } catch (error: any) {
        setResults(prev => ({
          ...prev,
          [service.name]: `❌ 网络错误: ${error.message}`
        }));
      }
    }

    setTesting(false);
  };

  return (
    <div className="min-h-screen flex justify-center items-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-center">网络连接测试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testServices} 
            disabled={testing}
            className="w-full"
          >
            {testing ? '测试中...' : '开始测试'}
          </Button>

          {Object.keys(results).length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">测试结果：</h3>
              {Object.entries(results).map(([service, result]) => (
                <div key={service} className="p-3 bg-gray-50 rounded">
                  <strong>{service}:</strong> {result}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded">
            <h4 className="font-semibold mb-2">说明：</h4>
            <ul className="text-sm space-y-1">
              <li>• Google Search API - 用于搜索功能</li>
              <li>• OpenAI Proxy - 用于AI分析</li>
              <li>• Local API - 本地API接口</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
