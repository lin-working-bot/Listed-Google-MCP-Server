'use client';

import { useState } from 'react';
import { marked } from 'marked';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TableDemo() {
  const [currentDemo, setCurrentDemo] = useState(0);

  const demoTables = [
    {
      title: "企业信息表格",
      markdown: `## 与"科技公司"相关的实体信息

| 名称 | 提供方 | 详细内容 | 数据来源 |
| ---- | ------ | -------- | -------- |
| 苹果公司 | Apple Inc. | 全球领先的科技公司，主要产品包括iPhone、iPad、Mac等 | [官方网站](https://www.apple.com) |
| 微软公司 | Microsoft | 软件巨头，Windows操作系统和Office办公套件的开发商 | [官方网站](https://www.microsoft.com) |
| 谷歌公司 | Alphabet Inc. | 搜索引擎和云服务提供商，Android系统开发者 | [官方网站](https://www.google.com) |
| 亚马逊 | Amazon | 电商平台和云计算服务提供商AWS | [官方网站](https://www.amazon.com) |
| 特斯拉 | Tesla Inc. | 电动汽车和清洁能源公司 | [官方网站](https://www.tesla.com) |`
    },
    {
      title: "产品对比表格",
      markdown: `## 智能手机产品对比

| 产品名称 | 品牌 | 价格 | 屏幕尺寸 | 存储容量 | 评分 |
| -------- | ---- | ---- | -------- | -------- | ---- |
| iPhone 15 Pro | Apple | ¥8999 | 6.1英寸 | 128GB | ⭐⭐⭐⭐⭐ |
| Galaxy S24 Ultra | Samsung | ¥9999 | 6.8英寸 | 256GB | ⭐⭐⭐⭐⭐ |
| Pixel 8 Pro | Google | ¥6999 | 6.7英寸 | 128GB | ⭐⭐⭐⭐ |
| 小米14 Ultra | Xiaomi | ¥5999 | 6.73英寸 | 256GB | ⭐⭐⭐⭐ |
| OnePlus 12 | OnePlus | ¥4999 | 6.82英寸 | 256GB | ⭐⭐⭐⭐ |`
    },
    {
      title: "数据统计表格",
      markdown: `## 2024年全球市场数据

| 地区 | 人口数量 | GDP总量 | 增长率 | 主要产业 |
| ---- | -------- | ------- | ------ | -------- |
| 中国 | 14.1亿 | $17.7万亿 | +5.2% | 制造业、科技、服务业 |
| 美国 | 3.3亿 | $26.9万亿 | +2.1% | 科技、金融、服务业 |
| 日本 | 1.25亿 | $4.9万亿 | +0.9% | 制造业、科技、汽车 |
| 德国 | 8300万 | $4.3万亿 | +1.4% | 制造业、汽车、化工 |
| 印度 | 14.2亿 | $3.7万亿 | +6.1% | IT服务、制造业、农业 |`
    },
    {
      title: "复杂数据表格",
      markdown: `## 全球顶级大学排名

| 排名 | 大学名称 | 国家/地区 | 建校年份 | 学生人数 | 知名校友 | 官方网站 |
| ---- | -------- | --------- | -------- | -------- | -------- | -------- |
| 1 | 哈佛大学 | 美国 | 1636年 | 23,000 | 奥巴马、扎克伯格 | [harvard.edu](https://www.harvard.edu) |
| 2 | 斯坦福大学 | 美国 | 1885年 | 17,000 | 拉里·佩奇、谢尔盖·布林 | [stanford.edu](https://www.stanford.edu) |
| 3 | 麻省理工学院 | 美国 | 1861年 | 11,500 | 钱学森、贝索斯 | [mit.edu](https://www.mit.edu) |
| 4 | 剑桥大学 | 英国 | 1209年 | 24,000 | 牛顿、霍金 | [cam.ac.uk](https://www.cam.ac.uk) |
| 5 | 牛津大学 | 英国 | 1096年 | 26,000 | 撒切尔夫人、托尔金 | [ox.ac.uk](https://www.ox.ac.uk) |`
    }
  ];

  const nextDemo = () => {
    setCurrentDemo((prev) => (prev + 1) % demoTables.length);
  };

  const prevDemo = () => {
    setCurrentDemo((prev) => (prev - 1 + demoTables.length) % demoTables.length);
  };

  return (
    <div className="min-h-screen flex justify-center items-center" style={{
      background: `linear-gradient(135deg, rgb(var(--mint-start)), rgb(var(--mint-mid)), rgb(var(--mint-end)))`,
      backgroundSize: '200% 200%',
      animation: 'gradient 15s ease infinite'
    }}>
      <Card className="max-w-6xl w-full mx-4 my-8 glass-effect shadow-2xl overflow-hidden z-10 fade-in">
        <div className="h-1.5 bg-gradient-to-r from-[rgb(var(--mint-start))] to-[rgb(var(--mint-end))]"></div>

        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold bg-gradient-to-r from-[rgb(var(--mint-start))] to-[rgb(var(--mint-end))] text-transparent bg-clip-text">
            表格样式演示
          </CardTitle>
          <p className="text-lg text-[rgb(var(--text-secondary))] mt-2">
            展示美化后的表格效果
          </p>
        </CardHeader>

        <CardContent className="p-6 md:p-8">
          {/* 导航按钮 */}
          <div className="flex justify-between items-center mb-6">
            <Button 
              onClick={prevDemo}
              className="bg-gradient-to-r from-[rgb(var(--mint-start))] to-[rgb(var(--mint-mid))] text-white px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              ← 上一个
            </Button>
            
            <div className="text-center">
              <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))]">
                {demoTables[currentDemo].title}
              </h3>
              <p className="text-sm text-[rgb(var(--text-secondary))]">
                {currentDemo + 1} / {demoTables.length}
              </p>
            </div>
            
            <Button 
              onClick={nextDemo}
              className="bg-gradient-to-r from-[rgb(var(--mint-mid))] to-[rgb(var(--mint-end))] text-white px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              下一个 →
            </Button>
          </div>

          {/* 表格展示区域 */}
          <div className="table-container table-success">
            <div
              dangerouslySetInnerHTML={{ __html: marked.parse(demoTables[currentDemo].markdown) }}
              className="prose max-w-none prose-headings:text-center prose-headings:text-[rgb(var(--text-primary))] prose-a:text-[rgb(var(--mint-start))] prose-strong:text-[rgb(var(--mint-start))] enhanced-table"
            />
          </div>

          {/* 状态指示器 */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[rgba(var(--mint-start),0.1)] to-[rgba(var(--mint-mid),0.1)] text-[rgb(var(--mint-start))] rounded-full text-sm font-semibold border-2 border-[rgba(var(--mint-start),0.2)] shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              ✨ 表格已成功渲染
            </div>
          </div>

          {/* 功能说明 */}
          <div className="mt-8 p-6 bg-[rgba(var(--mint-start),0.05)] border border-[rgba(var(--mint-start),0.2)] rounded-xl">
            <h3 className="text-[rgb(var(--text-primary))] font-semibold mb-4 text-center">✨ 表格美化特性</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[rgb(var(--text-secondary))]">
              <div className="space-y-2">
                <p>🎨 <strong>渐变表头</strong>：美丽的薄荷色渐变背景</p>
                <p>🌊 <strong>悬停效果</strong>：行悬停时的平滑动画</p>
                <p>🔗 <strong>链接美化</strong>：带有光泽效果的链接按钮</p>
                <p>📱 <strong>响应式设计</strong>：完美适配移动设备</p>
              </div>
              <div className="space-y-2">
                <p>✨ <strong>加载动画</strong>：表格行依次出现效果</p>
                <p>🎯 <strong>第一列强调</strong>：特殊的边框和背景</p>
                <p>🌈 <strong>交替行色</strong>：提高可读性的斑马纹</p>
                <p>💫 <strong>阴影效果</strong>：现代化的立体感设计</p>
              </div>
            </div>
          </div>

          {/* 返回主页按钮 */}
          <div className="mt-8 text-center">
            <Button 
              onClick={() => window.location.href = '/'}
              className="bg-gradient-to-r from-[rgb(var(--accent-1))] to-[rgb(var(--accent-2))] text-white px-8 py-3 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              🏠 返回主页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
