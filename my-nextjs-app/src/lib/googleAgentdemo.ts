import OpenAI from 'openai';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

// 将exec转换为Promise形式
const execPromise = promisify(exec);

// API参数
const OPENAI_API_KEY = "sk-ZgmSsStO4PqVVWc9xV2blbCt4H95KhgSRX8D4Ai0Q79SfdT6";
const OPENAI_API_URL = "https://newapi.tu-zi.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

// 设置 OpenAI 客户端
const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: "https://newapi.tu-zi.com/v1", // 基础URL，不包含chat/completions部分
  defaultHeaders: {
    "Content-Type": "application/json"
  },
  defaultQuery: {},
  timeout: 30000, // 30秒超时
});

// Google搜索API配置
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX = process.env.SEARCH_ENGINE_ID;
const GOOGLE_API_URL = 'https://www.googleapis.com/customsearch/v1';

export class GoogleAgent {
  private client: OpenAI;
  private systemPrompt: string;
  private messages: Array<{ role: string; content: string }>;
  private currentQuery: string = '';
  private processedUrls: Set<string> = new Set();

  constructor() {
    this.client = client;
    this.systemPrompt = "你是一个智能助手，能够提供谷歌信息查询服务。请用户提供要求，查询并返回用户所需信息。";
    this.messages = [{ role: "system", content: this.systemPrompt }];
  }

  // URL处理方法
  private addProcessedUrl(url: string): void {
    this.processedUrls.add(url);
  }

  private isUrlProcessed(url: string): boolean {
    return this.processedUrls.has(url);
  }

  // 从数据中提取实体
  async extractEntitiesFromData(data: any[], query: string, source: string): Promise<any[]> {
    console.log(`开始从${source}提取实体，数据量: ${data.length}条`);

    if (!data || data.length === 0) {
      console.log(`${source}数据为空，跳过提取`);
      return [];
    }

    // 预处理数据，限制数据量
    const processedData = data.map((item: any) => {
      // 只保留必要的字段
      const processed: any = {};
      if (item.title) processed.title = item.title;
      if (item.snippet) processed.snippet = item.snippet;
      if (item.link) processed.link = item.link;
      if (item.content) {
        // 限制content字段的长度
        processed.content = item.content.substring(0, 1000) + (item.content.length > 1000 ? '...' : '');
      }

      // 保留metadata字段，特别是url
      if (item.metadata) {
        processed.metadata = { ...item.metadata };
      }

      // 如果searchResult中有链接信息，也保留
      if (item.searchResult) {
        processed.searchResult = { ...item.searchResult };
      }

      // 确保有URL信息
      if (!processed.link && item.metadata && item.metadata.url) {
        processed.link = item.metadata.url;
      }

      return processed;
    });

    // 构建提取实体的提示词
    const extractPrompt = `
你是一个专业的信息提取助手，擅长从文本中提取结构化信息。

请从以下内容中提取与"${query}"相关的实体信息：

${JSON.stringify(processedData, null, 2)}

请仔细思考：
1. "${query}"是什么类型的查询？它在寻找什么样的实体？
2. 在提供的数据中，哪些是"${query}"的具体实例或类型？
3. 每个实体应该具有哪些属性？

请提取所有与"${query}"直接相关的实体，每个实体应包含以下信息：
1. 名称：实体的具体名称（必须是"${query}"的一种具体实例或类型）
2. 提供方：提供该实体的组织、公司或个人（如运营商、制造商等）
3. 详细内容：关于该实体的详细描述、特点、价格等信息
4. 数据来源：信息来源的URL（可以有多个来源）

请以普通文本格式返回，每个实体占一段，格式如下：

实体1：
- 名称：[实体名称]
- 提供方：[提供方]
- 详细内容：[详细内容]
- 数据来源：[数据来源URL]

实体2：
- 名称：[实体名称]
- 提供方：[提供方]
- 详细内容：[详细内容]
- 数据来源：[数据来源URL]

注意事项：
1. 只提取与"${query}"直接相关的实体，不要提取无关实体
2. 确保每个实体的名称是具体的，不要使用通用名称
3. 如果找不到提供方，可以填写"未知"
4. 同一实体可能有多个数据来源，请将所有来源URL用逗号分隔
5. 如果没有找到任何相关实体，请直接回复"未找到相关实体"
6. 不要提取重复的实体，如果有多个来源提到同一实体，请合并信息
7. 请确保提取的实体确实是"${query}"的一种，而不是其他类型的实体
8. 对于爬取的网页内容，请务必使用数据中的metadata.url作为数据来源，不要留空或填写"无"
9. 如果数据中包含metadata字段，请确保将metadata.url作为数据来源
10. 每个实体必须有数据来源，如果找不到明确的URL，请使用item.link或metadata.url
`;

    // 调用AI提取实体
    let retryCount = 0;
    const MAX_RETRIES = 3;

    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`尝试调用AI提取实体 (尝试 ${retryCount + 1}/${MAX_RETRIES})...`);

        // 打印请求参数（不包含敏感信息）
        console.log('API请求参数:', {
          model: OPENAI_MODEL,
          temperature: 0.1,
          max_tokens: 4000,
          baseURL: "https://newapi.tu-zi.com/v1", // 显示正确的baseURL
          apiURL: OPENAI_API_URL // 显示完整的API URL
        });

        const extractResponse = await this.client.chat.completions.create({
          model: OPENAI_MODEL, // 使用定义的模型名称
          messages: [
            { role: "system", content: "你是一个专业的信息提取助手，擅长从文本中提取结构化信息。你的任务是从提供的数据中提取与查询相关的实体信息。" },
            { role: "user", content: extractPrompt }
          ],
          temperature: 0.1, // 使用较低的温度以获得更确定性的结果
          max_tokens: 4000
          // 移除response_format参数，不再强制要求JSON格式
        });

        console.log('API响应状态:', extractResponse ? '成功' : '失败');

        const extractContent = extractResponse?.choices[0]?.message?.content || '';

        if (extractContent && extractContent.trim() !== '') {
          console.log(`成功从${source}获取AI响应`);

          // 不再尝试解析JSON，直接使用文本内容

          // 保存提取的实体到entities.txt文件
          try {
            // 确保data目录存在
            const dataDir = path.join(process.cwd(), 'data');
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }

            // 构建文件路径
            const filePath = path.join(dataDir, 'entities.txt');

            // 添加查询信息和时间戳
            const header = `查询: ${query}\n数据来源: ${source}\n时间: ${new Date().toISOString()}\n\n`;

            // 写入文件（追加模式，确保不同来源的实体都被保存）
            fs.appendFileSync(filePath, header + extractContent + '\n\n---\n\n', 'utf8');

            console.log(`成功保存实体数据到entities.txt文件`);
          } catch (saveError) {
            console.error('保存实体数据到文件失败:', saveError);
          }

          // 返回一个空数组，因为我们不再使用JSON格式的实体
          return [];
        } else {
          console.warn(`AI返回的响应为空`);
          retryCount++;

          if (retryCount >= MAX_RETRIES) {
            console.error(`达到最大重试次数，放弃提取`);
            return [];
          }
        }
      } catch (error: any) {
        console.error(`调用AI提取实体失败:`, error);

        // 打印更详细的错误信息
        console.error('错误详情:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: error.code,
          status: error.status,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          } : 'No response'
        });

        // 打印请求配置
        console.error('请求配置:', {
          baseURL: this.client.baseURL,
          apiKey: this.client.apiKey ? '已设置(长度:' + this.client.apiKey.length + ')' : '未设置',
          model: OPENAI_MODEL,
          apiURL: OPENAI_API_URL
        });

        retryCount++;

        const isConnectionError =
          error.message.includes('Connection') ||
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET');

        const isAuthError =
          error.message.includes('auth') ||
          error.message.includes('key') ||
          error.message.includes('token') ||
          error.message.includes('permission');

        const isModelError =
          error.message.includes('model') ||
          error.message.includes('not found') ||
          error.message.includes('not supported');

        if (isAuthError) {
          console.error('认证错误，请检查API密钥');
        } else if (isModelError) {
          console.error('模型错误，请检查模型名称');
        } else if (isConnectionError && retryCount < MAX_RETRIES) {
          const waitTime = 2000 * retryCount;
          console.log(`连接错误，${waitTime/1000}秒后重试 (${retryCount}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (retryCount >= MAX_RETRIES) {
          console.error(`达到最大重试次数，放弃提取`);
          return [];
        }
      }
    }

    return [];
  }

  // 整合实体数据，生成表格
  async integrateEntities(entitiesContent: string, query: string): Promise<string> {
    console.log('开始整合实体数据...');

    if (!entitiesContent || entitiesContent.trim() === '') {
      console.log('实体内容为空，无法整合');
      return `## 与"${query}"相关的实体信息\n\n未找到相关实体信息。请尝试使用其他搜索词或检查网络连接。`;
    }

    // 构建整合提示词
    const integratePrompt = `
你是一个专业的数据整理助手，擅长整合和归纳信息。

请整合以下与"${query}"相关的实体信息，并以Markdown表格形式输出：

${entitiesContent}

请按照以下要求整合：
1. 合并相同或高度相似的实体，避免重复
2. 确保每个实体的信息尽可能完整
3. 如果同一实体有多个来源，请保留所有来源链接
4. 以Markdown表格格式输出，表头为：名称、提供方、详细内容、数据来源

表格格式示例：
| 名称 | 提供方 | 详细内容 | 数据来源 |
| ---- | ------ | -------- | -------- |
| 实体名称 | 提供方 | 详细内容 | [链接](URL) |

注意事项：
1. 数据来源列应该使用Markdown链接格式：[链接](URL)
2. 如果有多个链接，用逗号分隔
3. 确保表格格式正确，便于在Markdown中显示
4. 如果没有找到任何相关实体，请返回"未找到相关实体信息"
5. 请确保整合后的实体信息与"${query}"直接相关
`;

    // 调用AI整合实体
    try {
      console.log('调用AI整合实体...');

      // 打印请求参数（不包含敏感信息）
      console.log('整合API请求参数:', {
        model: OPENAI_MODEL,
        temperature: 0.1,
        max_tokens: 4000,
        baseURL: "https://newapi.tu-zi.com/v1", // 显示正确的baseURL
        apiURL: OPENAI_API_URL // 显示完整的API URL
      });

      const integrateResponse = await this.client.chat.completions.create({
        model: OPENAI_MODEL, // 使用定义的模型名称
        messages: [
          { role: "system", content: "你是一个专业的数据整理助手，擅长整合和归纳信息。你的任务是整合提供的实体信息，并以表格形式输出。" },
          { role: "user", content: integratePrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const integrateContent = integrateResponse?.choices[0]?.message?.content || '';

      if (integrateContent && integrateContent.trim() !== '') {
        console.log('成功整合实体数据');

        // 保存整合后的实体到integrated-entities.txt文件
        try {
          const dataDir = path.join(process.cwd(), 'data');
          const filePath = path.join(dataDir, 'integrated-entities.txt');

          // 添加查询信息和时间戳
          const header = `# 整合后的实体信息\n\n查询: ${query}\n时间: ${new Date().toISOString()}\n\n`;

          // 写入文件（覆盖模式）
          fs.writeFileSync(filePath, header + integrateContent, 'utf8');

          console.log('成功保存整合后的实体数据到integrated-entities.txt文件');
        } catch (saveError) {
          console.error('保存整合后的实体数据到文件失败:', saveError);
        }

        return integrateContent;
      } else {
        console.warn('AI返回的整合响应为空');
        return `## 与"${query}"相关的实体信息\n\n整合实体时出错，未能获取有效响应。请尝试使用其他搜索词或检查网络连接。`;
      }
    } catch (error: any) {
      console.error('调用AI整合实体失败:', error);

      // 打印更详细的错误信息
      console.error('整合错误详情:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.code,
        status: error.status,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : 'No response'
      });

      // 打印请求配置
      console.error('整合请求配置:', {
        baseURL: this.client.baseURL,
        apiKey: this.client.apiKey ? '已设置(长度:' + this.client.apiKey.length + ')' : '未设置',
        model: OPENAI_MODEL,
        apiURL: OPENAI_API_URL
      });

      // 判断错误类型
      if (error.message.includes('auth') || error.message.includes('key') || error.message.includes('token')) {
        console.error('认证错误，请检查API密钥');
        return `## 与"${query}"相关的实体信息\n\n整合实体时出错: API认证失败。请检查API密钥。`;
      } else if (error.message.includes('model') || error.message.includes('not found')) {
        console.error('模型错误，请检查模型名称');
        return `## 与"${query}"相关的实体信息\n\n整合实体时出错: 模型不可用。请检查模型名称。`;
      } else {
        return `## 与"${query}"相关的实体信息\n\n整合实体时出错: ${error.message}。请尝试使用其他搜索词或检查网络连接。`;
      }
    }
  }

  // 合并实体数据，去除重复项（保留但不再使用）
  mergeEntities(existingEntities: any[], newEntities: any[]): any[] {
    if (!newEntities || newEntities.length === 0) {
      return existingEntities || [];
    }

    if (!existingEntities || existingEntities.length === 0) {
      return newEntities;
    }

    // 创建一个Map来存储已有的实体，以name和provider为键
    const entityMap = new Map();

    // 添加现有实体到Map
    existingEntities.forEach(entity => {
      const key = `${entity.name}|${entity.provider}`;
      entityMap.set(key, entity);
    });

    // 处理新实体，合并或添加
    newEntities.forEach(newEntity => {
      const key = `${newEntity.name}|${newEntity.provider}`;

      if (entityMap.has(key)) {
        // 合并现有实体和新实体
        const existingEntity = entityMap.get(key);

        // 合并details（如果新实体有更多信息）
        if (newEntity.details && newEntity.details.length > existingEntity.details.length) {
          existingEntity.details = newEntity.details;
        }

        // 合并sources（添加新的来源）
        if (newEntity.sources && Array.isArray(newEntity.sources)) {
          if (!existingEntity.sources) {
            existingEntity.sources = [];
          }

          newEntity.sources.forEach((source: string) => {
            if (!existingEntity.sources.includes(source)) {
              existingEntity.sources.push(source);
            }
          });
        }

        // 更新Map
        entityMap.set(key, existingEntity);
      } else {
        // 添加新实体
        entityMap.set(key, newEntity);
      }
    });

    // 将Map转换回数组
    return Array.from(entityMap.values());
  }

  // 调用Python脚本爬取网页
  private async callPythonScraper(url: string, query: string): Promise<any> {
    try {
      // 确保脚本路径正确
      const scriptPath = path.join(process.cwd(), 'scripts', 'scrape.py');

      // 检查脚本是否存在
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Python脚本不存在: ${scriptPath}`);
      }

      console.log(`调用Python脚本爬取网页: ${url}`);
      console.log(`查询关键词: ${query}`);

      // 构建命令行参数
      const command = `python "${scriptPath}" --url "${url}" --prompt "${query}"`;

      // 设置环境变量
      const env = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8', // 确保Python使用UTF-8编码
        PYTHONLEGACYWINDOWSSTDIO: 'utf-8', // 修复Windows上的编码问题
        PYTHONUTF8: '1' // 强制使用UTF-8
      };

      // 设置超时时间（100秒）
      const timeout = 100 * 1000;

      // 执行命令
      console.log(`执行命令: ${command}`);
      const { stdout, stderr } = await Promise.race([
        execPromise(command, {
          env,
          maxBuffer: 1024 * 1024 * 10, // 10MB
          encoding: 'utf8',
          windowsHide: true
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Python脚本执行超时（100秒）')), timeout)
        )
      ]) as { stdout: string, stderr: string };

      // 检查是否有错误输出
      if (stderr && stderr.trim() !== '') {
        console.warn(`Python脚本错误输出: ${stderr}`);
      }

      // 查找最后一行JSON输出
      const lines = stdout.split('\n');
      let lastJsonLine = '';

      // 从后向前查找，找到第一个有效的JSON行
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          lastJsonLine = line;
          break;
        }
      }

      // 如果没有找到JSON输出，返回错误
      if (!lastJsonLine) {
        console.error('Python脚本没有返回有效的JSON输出');
        console.error('完整输出:', stdout);
        return {
          error: 'Python脚本没有返回有效的JSON输出',
          details: stdout,
          timestamp: new Date().toISOString(),
          url: url
        };
      }

      // 解析JSON结果
      try {
        const result = JSON.parse(lastJsonLine);

        // 添加元数据
        if (!result.metadata) {
          result.metadata = {};
        }

        result.metadata.url = url;
        result.metadata.query = query;
        result.metadata.timestamp = result.metadata.timestamp || new Date().toISOString();

        return result;
      } catch (jsonError: any) {
        console.error(`解析JSON输出失败: ${jsonError.message}`);
        return {
          error: `解析JSON输出失败: ${jsonError.message}`,
          details: lastJsonLine,
          timestamp: new Date().toISOString(),
          url: url
        };
      }
    } catch (error: any) {
      console.error(`调用Python脚本时出错: ${error.message}`);
      return {
        error: `调用Python脚本时出错: ${error.message}`,
        details: error.stack || '',
        timestamp: new Date().toISOString(),
        url: url
      };
    }
  }

  // 爬取搜索结果中的链接
  async crawlSearchResults(searchResults: any[], query: string): Promise<any[]> {
    console.log(`开始爬取搜索结果，共 ${searchResults.length} 个链接`);

    // 创建一个数组，用于存储爬取结果
    const crawlResults: any[] = [];

    // 创建一个对象，用于存储已爬取的URL，避免重复爬取
    const crawledUrls: {[key: string]: boolean} = {};

    // 遍历搜索结果
    for (let i = 0; i < searchResults.length; i++) {
      const item = searchResults[i];
      const url = item.link;

      // 跳过已爬取的URL
      if (crawledUrls[url] || this.isUrlProcessed(url)) {
        console.log(`跳过已爬取的URL: ${url}`);
        continue;
      }

      console.log(`[${i+1}/${searchResults.length}] 爬取URL: ${url}`);

      try {
        // 调用Python脚本爬取网页
        const result = await this.callPythonScraper(url, query);

        // 标记URL为已爬取
        crawledUrls[url] = true;
        this.addProcessedUrl(url);

        // 添加爬取结果到数组
        if (result) {
          // 添加原始搜索结果信息
          result.searchResult = {
            title: item.title,
            snippet: item.snippet
          };

          crawlResults.push(result);
          console.log(`成功爬取URL: ${url}`);
        } else {
          console.error(`爬取URL失败: ${url}`);
        }
      } catch (error: any) {
        console.error(`爬取URL时出错: ${url}, 错误: ${error.message}`);
      }
    }

    console.log(`爬取完成，共爬取 ${crawlResults.length} 个URL`);
    return crawlResults;
  }

  // 获取多页搜索结果
  async getMultiPageSearchResults(query: string, pageStarts: number[] = [1, 11]): Promise<any[]> {
    console.log(`获取多页搜索结果，查询: "${query}"`);
    const resultsPerPage = 10;
    let allItems: any[] = [];

    // 遍历每个起始位置，获取对应页的搜索结果
    for (let i = 0; i < pageStarts.length; i++) {
      const start = pageStarts[i];
      const pageNum = i + 1;

      try {
        console.log(`获取第 ${pageNum} 页搜索结果 (start=${start})...`);
        const pageResults = await this.searchGoogle(query, start, resultsPerPage);

        // 检查是否有搜索结果
        if (pageResults && pageResults.items && pageResults.items.length > 0) {
          // 将当前页的结果添加到总结果中
          allItems = [...allItems, ...pageResults.items];
          console.log(`第 ${pageNum} 页找到 ${pageResults.items.length} 条结果`);
        } else {
          console.log(`第 ${pageNum} 页没有找到结果`);
          // 如果后续页没有结果，说明已经到达最后一页，可以停止获取
          break;
        }
      } catch (pageError: any) {
        console.error(`获取第 ${pageNum} 页时出错:`, pageError.message);
        // 如果第一页就失败，整个搜索可能失败
        if (i === 0) {
          throw pageError; // 重新抛出错误，让外层catch处理
        }
        // 如果后续页失败，至少我们有一些结果，可以继续处理
        break;
      }
    }

    console.log(`总共找到 ${allItems.length} 条搜索结果`);
    return allItems;
  }

  // 谷歌搜索功能
  async searchGoogle(query: string, start: number = 1, num: number = 10): Promise<any> {
    // 添加重试机制
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`尝试连接到 Google API... (尝试 ${retryCount + 1}/${maxRetries}, 第 ${Math.floor(start/10) + 1} 页)`);

        // 打印环境变量值（不包含敏感信息）
        console.log(`GOOGLE_API_KEY 长度: ${GOOGLE_API_KEY ? GOOGLE_API_KEY.length : 0}`);
        console.log(`GOOGLE_CX 值: ${GOOGLE_CX}`);

        // 设置请求参数
        const params = {
          key: GOOGLE_API_KEY,
          cx: GOOGLE_CX,
          q: query,
          start: start,
          num: num,
        };

        // 打印完整请求参数（不包含敏感信息）
        console.log('请求参数:', {
          ...params,
          key: params.key ? '已设置' : '未设置'
        });

        // 设置请求超时时间和代理
        const axiosConfig = {
          timeout: 30000, // 30秒超时
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          // 使用代理服务器
          httpsAgent: new HttpsProxyAgent('http://127.0.0.1:7890')
        };

        // 发送请求
        console.log(`发送请求到 ${GOOGLE_API_URL}`);
        try {
          const response = await axios.get(GOOGLE_API_URL, { params, ...axiosConfig });
          console.log('Google API 响应状态码:', response.status);
          return response.data;
        } catch (axiosError: any) {
          // 打印详细的错误信息
          console.error('Axios 错误详情:');
          if (axiosError.response) {
            // 服务器返回了错误状态码
            console.error('状态码:', axiosError.response.status);
            console.error('响应头:', axiosError.response.headers);
            console.error('响应数据:', axiosError.response.data);

            // 如果是400错误，可能是API密钥或搜索引擎ID问题，不再重试
            if (axiosError.response.status === 400) {
              throw axiosError;
            }
          } else if (axiosError.request) {
            // 请求已发送但没有收到响应
            console.error('请求已发送但没有收到响应');
          } else {
            // 设置请求时发生错误
            console.error('设置请求时发生错误:', axiosError.message);
          }

          // 增加重试计数
          retryCount++;

          // 如果还有重试次数，等待后重试
          if (retryCount < maxRetries) {
            const waitTime = 2000 * retryCount; // 递增等待时间
            console.log(`连接错误，${waitTime/1000}秒后重试 (${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // 如果已达到最大重试次数，抛出错误
            throw axiosError;
          }
        }
      } catch (error: any) {
        // 如果是最后一次重试，或者是不应该重试的错误，直接抛出
        if (retryCount >= maxRetries - 1 || (error.response && error.response.status === 400)) {
          console.error(`调用 Google API 时出错:`, error.message);
          throw error;
        }

        // 增加重试计数
        retryCount++;
      }
    }

    // 这行代码永远不会执行，但添加它以满足TypeScript的返回类型检查
    throw new Error('无法连接到Google API');
  }

  // 保存搜索结果到JSON文件
  private async saveToJsonFile(data: any, fileName: string): Promise<void> {
    try {
      // 确保data目录存在
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`创建目录: ${dataDir}`);
      }

      // 构建文件路径
      const filePath = path.join(dataDir, fileName);

      // 将数据转换为JSON字符串
      const jsonData = JSON.stringify(data, null, 2);

      // 写入文件（覆盖模式）
      fs.writeFileSync(filePath, jsonData, 'utf8');

      console.log(`成功保存数据到文件: ${filePath}`);
    } catch (error: any) {
      console.error(`保存数据到文件失败: ${error.message}`);
      throw error;
    }
  }

  // 处理用户查询
  async getResponse(userInput: string): Promise<string> {
    console.log('开始处理查询:', userInput);

    try {
      // 添加用户消息到对话历史
      this.messages.push({ role: "user", content: userInput });

      // 清除之前的处理记录，确保每次都是新的搜索
      this.processedUrls.clear();

      // 更新当前查询
      this.currentQuery = userInput;

      // 不使用模拟数据，如果谷歌搜索API不可用，直接返回错误信息

      let formattedResults = [];
      let allItems: any[] = [];

      try {
        // 获取多页搜索结果
        const pageStarts = [1,11,21,31,41,51]; // 每页10条结果，起始索引分别为1, 11

        // 使用新的方法获取多页搜索结果
        allItems = await this.getMultiPageSearchResults(userInput, pageStarts);

        // 格式化搜索结果
        formattedResults = allItems.map((item: any) => {
          return {
            title: item.title,
            link: item.link,
            snippet: item.snippet
          };
        });

        console.log(`成功格式化 ${formattedResults.length} 条搜索结果`);

        // 保存搜索结果到allItems.json文件（覆盖模式）
        try {
          await this.saveToJsonFile(formattedResults, 'allItems.json');
          console.log('成功保存搜索结果到allItems.json文件');
        } catch (saveError) {
          console.error('保存搜索结果到文件失败:', saveError);
          // 保存失败不影响后续处理
        }

        // 爬取搜索结果中的链接
        try {
          console.log('开始爬取搜索结果中的链接...');

          // 调用爬取方法，处理搜索结果中的链接
          const crawlResults = await this.crawlSearchResults(formattedResults, userInput);

          // 检查爬取结果
          if (crawlResults && crawlResults.length > 0) {
            console.log(`成功爬取 ${crawlResults.length} 个链接的内容`);

            // 保存爬取结果到crawl-data.json文件（覆盖模式）
            await this.saveToJsonFile(crawlResults, 'crawl-data.json');
            console.log('成功保存爬取结果到crawl-data.json文件');
          } else {
            console.warn('没有成功爬取任何链接内容');

            // 创建一个空数组保存到文件，确保覆盖之前的内容
            await this.saveToJsonFile([], 'crawl-data.json');
            console.log('已保存空的爬取结果到crawl-data.json文件');
          }
        } catch (crawlError) {
          console.error('爬取或保存爬取结果失败:', crawlError);

          // 即使爬取失败，也创建一个空文件，确保覆盖之前的内容
          try {
            await this.saveToJsonFile([], 'crawl-data.json');
            console.log('已保存空的爬取结果到crawl-data.json文件');
          } catch (saveError) {
            console.error('保存空的爬取结果失败:', saveError);
          }

          // 爬取失败不影响后续处理
        }
      } catch (searchError: any) {
        console.error('获取谷歌搜索结果失败:', searchError);

        // 创建空文件，确保覆盖之前的内容
        try {
          await this.saveToJsonFile([], 'allItems.json');
          console.log('已保存空的搜索结果到allItems.json文件');

          await this.saveToJsonFile([], 'crawl-data.json');
          console.log('已保存空的爬取结果到crawl-data.json文件');
        } catch (saveError) {
          console.error('保存空文件失败:', saveError);
        }

        // 直接返回错误信息
        const errorMessage = searchError.message || '未知错误';
        return `## 搜索错误\n\n谷歌搜索API不可用或发生错误: ${errorMessage}\n\n请检查网络连接或API配置，稍后再试。`;
      }

      // 读取搜索结果和爬取结果
      let allItemsData: any[] = [];
      let crawlData: any[] = [];

      try {
        // 读取allItems.json文件
        const dataDir = path.join(process.cwd(), 'data');
        const allItemsPath = path.join(dataDir, 'allItems.json');

        if (fs.existsSync(allItemsPath)) {
          const allItemsContent = fs.readFileSync(allItemsPath, 'utf8');
          allItemsData = JSON.parse(allItemsContent);
          console.log(`成功读取搜索结果，共 ${allItemsData.length} 条数据`);
        } else {
          console.log('搜索结果文件不存在，将使用内存中的搜索结果');
          allItemsData = formattedResults;
        }

        // 读取crawl-data.json文件
        const crawlDataPath = path.join(dataDir, 'crawl-data.json');

        if (fs.existsSync(crawlDataPath)) {
          const crawlDataContent = fs.readFileSync(crawlDataPath, 'utf8');
          crawlData = JSON.parse(crawlDataContent);
          console.log(`成功读取爬取结果，共 ${crawlData.length} 条数据`);
        } else {
          console.log('爬取结果文件不存在');
        }
      } catch (readError) {
        console.error('读取数据文件失败:', readError);
        // 读取失败不影响后续处理，使用内存中的数据
        allItemsData = formattedResults;
      }

      // 提取实体数据
      console.log('开始提取实体数据...');

      // 清空entities.txt文件
      try {
        const dataDir = path.join(process.cwd(), 'data');
        const entitiesPath = path.join(dataDir, 'entities.txt');

        // 创建空文件（覆盖模式）
        fs.writeFileSync(entitiesPath, '', 'utf8');
        console.log('成功清空entities.txt文件');
      } catch (clearError) {
        console.error('清空entities.txt文件失败:', clearError);
      }

      // 从搜索结果中提取实体
      console.log('从搜索结果中提取实体...');
      await this.extractEntitiesFromData(allItemsData, userInput, 'allItems');

      // 从爬取结果中提取实体
      console.log('从爬取结果中提取实体...');
      await this.extractEntitiesFromData(crawlData, userInput, 'crawlData');

      // 读取entities.txt文件
      let entitiesContent = '';
      try {
        const dataDir = path.join(process.cwd(), 'data');
        const entitiesPath = path.join(dataDir, 'entities.txt');

        if (fs.existsSync(entitiesPath)) {
          entitiesContent = fs.readFileSync(entitiesPath, 'utf8');
          console.log('成功读取entities.txt文件');
        } else {
          console.log('entities.txt文件不存在');
        }
      } catch (readError) {
        console.error('读取entities.txt文件失败:', readError);
      }

      // 如果没有提取到实体，返回提示信息
      if (!entitiesContent || entitiesContent.trim() === '') {
        return `## 与"${userInput}"相关的实体信息\n\n未找到相关实体信息。请尝试使用其他搜索词或检查网络连接。`;
      }

      // 调用整合实体的方法，生成表格
      console.log('开始调用整合实体的方法...');
      const integratedResponse = await this.integrateEntities(entitiesContent, userInput);

      // 构建最终响应
      const markdownResponse = `## 与"${userInput}"相关的实体信息\n\n${integratedResponse}`;

      return markdownResponse;
    } catch (error: any) {
      console.error('处理查询时出错:', error);
      return `## 与'${userInput}'相关的实体信息\n\n处理查询时出错: ${error.message}\n\n请尝试简化查询或稍后再试。`;
    } finally {
      console.log('查询处理完成');
    }
  }
}

// 创建单例实例
export const googleAgent = new GoogleAgent();