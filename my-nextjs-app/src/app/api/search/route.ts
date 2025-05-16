import { NextRequest, NextResponse } from 'next/server';
import { googleAgent } from '@/lib/googleAgentdemo'; // 修改为使用新的googleAgentdemo
import fs from 'fs';
import path from 'path';

// API路由文件
// 使用googleAgentdemo.ts替代googleAgent.ts

// 设置请求超时时间
// 默认的 fetch 超时时间可能太短
// 增加超时时间可以减少超时错误
export const maxDuration = 12000; // 设置为 60 秒

export async function POST(request: NextRequest) {
  console.log('Received search request');

  try {
    const body = await request.json();
    const { query } = body;
    console.log('Search query:', query);

    if (!query) {
      console.log('Empty query');
      return NextResponse.json(
        { error: "查询内容不能为空" },
        { status: 400 }
      );
    }

    // 确保数据目录存在
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 强制每次都调用 googleAgent.getResponse 获取新的响应，不使用缓存
    console.log('【API】开始执行新的搜索和爬取，不使用缓存');
    console.log('【API】正在调用 googleAgent.getResponse 获取新的响应...');
    let response = await googleAgent.getResponse(query);
    const responseSource = 'AI';
    console.log('【API】googleAgent.getResponse 调用完成');

    // 打印完整的响应，用于调试
    console.log('【API】完整的响应:');
    console.log(response);

    // 确保响应不为空
    if (!response || response.trim() === '') {
      console.error('【API】AI响应为空，返回默认响应');
      response = `## 与'${query}'相关的实体信息\n\n| 名称 | 提供方 | 详细内容 | 数据来源 |\n| ---- | ------ | -------- | -------- |\n| ${query} | 未提供 | 未找到详细信息 | 未提供 |\n\n*未找到更多相关信息*`;
    }

    // 验证响应是否包含Markdown表格
    if (response && response.includes('|') && response.includes('-')) {
      console.log('【API】响应包含有效的Markdown表格格式');
    } else {
      console.warn('【API】警告：响应可能不包含有效的Markdown表格格式，但仍将使用AI返回的响应');
      console.log('【API】响应内容预览:', response.substring(0, 100) + '...');
    }

    // 读取整合后的实体数据
    console.log('【API】开始读取整合后的实体数据');
    let integratedContent = '';
    try {
      // 尝试读取integrated-entities.txt文件
      const integratedPath = path.join(dataDir, 'integrated-entities.txt');
      if (fs.existsSync(integratedPath)) {
        integratedContent = fs.readFileSync(integratedPath, 'utf8');
        console.log(`【API】成功读取integrated-entities.txt文件`);

        // 计算实体数量（粗略估计，通过计算表格行数）
        const tableRows = integratedContent.split('\n').filter(line => line.trim().startsWith('|') && !line.trim().startsWith('| --'));
        const entityCount = tableRows.length > 1 ? tableRows.length - 1 : 0; // 减去表头行

        console.log(`【API】integrated-entities.txt中大约包含 ${entityCount} 个实体`);
      } else {
        console.log('【API】未找到integrated-entities.txt文件，尝试读取entities.txt');

        // 如果没有找到整合后的文件，尝试读取原始entities.txt
        const entitiesPath = path.join(dataDir, 'entities.txt');
        if (fs.existsSync(entitiesPath)) {
          const entitiesContent = fs.readFileSync(entitiesPath, 'utf8');
          console.log(`【API】成功读取entities.txt文件`);

          // 计算实体数量（粗略估计）
          const entityCount = (entitiesContent.match(/实体\d+：/g) || []).length ||
                             (entitiesContent.match(/- 名称：/g) || []).length;

          console.log(`【API】entities.txt中大约包含 ${entityCount} 个实体`);

          // 使用原始实体内容
          integratedContent = entitiesContent;
        } else {
          console.log('【API】未找到entities.txt文件');
        }
      }
    } catch (error) {
      console.error('【API】读取实体数据失败:', error);
      integratedContent = '';
    }
    console.log('【API】返回AI生成的响应:', response.substring(0, 100) + '...');

    // 计算实体数量（粗略估计）
    let entityCount = 0;
    if (integratedContent.includes('|')) {
      // 如果是表格格式，计算表格行数
      const tableRows = integratedContent.split('\n').filter(line => line.trim().startsWith('|') && !line.trim().startsWith('| --'));
      entityCount = tableRows.length > 1 ? tableRows.length - 1 : 0; // 减去表头行
    } else {
      // 如果是原始格式，计算实体数量
      entityCount = (integratedContent.match(/实体\d+：/g) || []).length ||
                   (integratedContent.match(/- 名称：/g) || []).length;
    }

    return NextResponse.json({
      response,
      responseSource,
      extractedEntities: integratedContent, // 返回整合后的内容
      entityCount: entityCount || 0
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: `处理请求时出错: ${error.message}` },
      { status: 500 }
    );
  }
}
