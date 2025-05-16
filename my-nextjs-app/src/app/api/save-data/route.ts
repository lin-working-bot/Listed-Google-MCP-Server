import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 确保数据目录存在
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 设置最大文件大小限制（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 设置最大处理时间（5秒）
const MAX_PROCESSING_TIME = 5000;

export async function POST(request: NextRequest) {
  // 添加超时控制
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('处理请求超时')), MAX_PROCESSING_TIME);
  });

  try {
    // 使用 Promise.race 添加超时控制
    const result: any = await Promise.race([
      processRequest(request),
      timeoutPromise
    ]);

    return result;
  } catch (error: any) {
    console.error('保存数据时出错:', error);

    // 返回错误响应
    return NextResponse.json(
      { error: `保存数据时出错: ${error.message}` },
      { status: 500 }
    );
  }
}

async function processRequest(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { fileName, data, append = false, url = '' } = body;

    // 验证请求数据
    if (!fileName || !data) {
      return NextResponse.json(
        { error: '文件名和数据是必需的' },
        { status: 400 }
      );
    }

    // 确保文件名安全（防止目录遍历攻击）
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const filePath = path.join(DATA_DIR, safeFileName);

    // 如果文件不存在，创建一个空数组文件
    if (!fs.existsSync(filePath)) {
      console.log(`创建新文件 ${safeFileName}`);
      fs.writeFileSync(filePath, '[]');
    }

    // 解析新数据
    let newData;
    try {
      // 确保数据是有效的UTF-8编码
      const buffer = Buffer.from(data);
      const utf8Data = buffer.toString('utf8');
      // 显示更多的数据内容，但仍然限制日志长度
      const previewLength = 500; // 增加到500个字符
      const previewText = utf8Data.length > previewLength
        ? utf8Data.substring(0, previewLength) + '...(更多内容已省略)'
        : utf8Data;
      console.log(`解析JSON数据，长度: ${utf8Data.length}, 数据内容预览:\n${previewText}`);
      newData = JSON.parse(utf8Data);
    } catch (parseError) {
      console.error('解析JSON数据失败:', parseError);
      // 如果无法解析为JSON，使用原始数据
      newData = { raw: data };
    }

    // 添加时间戳
    const timestamp = new Date().toISOString();

    // 如果需要追加数据而不是覆盖
    if (append) {
      // 检查文件是否存在且大小是否超过限制
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE) {
          // 如果文件太大，创建新文件而不是追加
          const newFileName = `${safeFileName.replace('.json', '')}_${timestamp.replace(/[:.]/g, '-')}.json`;
          const newFilePath = path.join(DATA_DIR, newFileName);

          // 创建新文件，包含单个数据项
          const singleItemArray = [{
            ...newData,
            savedAt: timestamp,
            url: url || undefined
          }];

          // 确保使用UTF-8编码保存
          const jsonContent = JSON.stringify(singleItemArray, null, 2);
          fs.writeFileSync(newFilePath, jsonContent, { encoding: 'utf8' });
          console.log(`文件 ${safeFileName} 太大，已创建新文件 ${newFileName}`);

          return NextResponse.json({
            success: true,
            fileName: newFileName,
            filePath: newFilePath.replace(process.cwd(), ''),
            timestamp: timestamp,
            mode: 'new_file',
            reason: 'original_file_too_large'
          });
        }
      }

      // 使用流式处理，避免一次性加载整个文件
      let existingData: any[] = [];

      // 如果文件已存在，读取现有数据
      if (fs.existsSync(filePath)) {
        try {
          // 读取文件的前 100 字节，检查是否是有效的 JSON 数组开头
          const fd = fs.openSync(filePath, 'r');
          const buffer = Buffer.alloc(100);
          fs.readSync(fd, buffer, 0, 100, 0);
          fs.closeSync(fd);

          const fileStart = buffer.toString('utf8').trim();

          // 检查文件是否以 [ 开头（JSON 数组）
          if (fileStart.startsWith('[')) {
            // 读取整个文件
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // 尝试解析现有数据
            try {
              existingData = JSON.parse(fileContent);

              // 确保现有数据是数组
              if (!Array.isArray(existingData)) {
                existingData = [existingData];
              }

              // 限制数组大小，避免过大
              if (existingData.length > 1000) {
                // 保留最新的 1000 条记录
                existingData = existingData.slice(-1000);
                console.log(`文件 ${safeFileName} 数据过多，已截断至最新的 1000 条`);
              }
            } catch (parseError) {
              console.warn(`无法解析文件 ${safeFileName} 中的现有数据，将创建新文件`);
              existingData = [];
            }
          } else {
            console.warn(`文件 ${safeFileName} 不是有效的 JSON 数组，将创建新文件`);
            existingData = [];
          }
        } catch (readError) {
          console.warn(`读取文件 ${safeFileName} 失败，将创建新文件`);
          existingData = [];
        }
      }

      // 检查是否已存在相同URL的数据（避免重复）
      if (url) {
        // 增强去重逻辑，检查更多可能的URL字段
        const existingIndex = existingData.findIndex((item: any) => {
          // 检查直接的URL字段
          if (item.url === url || item.originalLink === url) {
            return true;
          }

          // 检查metadata中的URL字段
          if (item.metadata && item.metadata.url === url) {
            return true;
          }

          // 检查newData中的metadata.url是否与现有数据中的任何URL匹配
          if (newData.metadata && newData.metadata.url) {
            return item.url === newData.metadata.url ||
                  (item.metadata && item.metadata.url === newData.metadata.url) ||
                  item.originalLink === newData.metadata.url;
          }

          return false;
        });

        if (existingIndex >= 0) {
          // 更新现有数据而不是添加新条目
          existingData[existingIndex] = {
            ...existingData[existingIndex],
            ...newData,
            updatedAt: timestamp
          };
          console.log(`更新文件 ${safeFileName} 中URL为 ${url} 的现有数据`);
        } else {
          // 添加新数据到数组
          existingData.push({
            ...newData,
            savedAt: timestamp
          });
          console.log(`向文件 ${safeFileName} 添加URL为 ${url} 的新数据`);
        }
      } else {
        // 如果没有URL，检查newData中的metadata.url
        if (newData.metadata && newData.metadata.url) {
          const metadataUrl = newData.metadata.url;
          const existingIndex = existingData.findIndex((item: any) =>
            item.url === metadataUrl ||
            item.originalLink === metadataUrl ||
            (item.metadata && item.metadata.url === metadataUrl)
          );

          if (existingIndex >= 0) {
            // 更新现有数据而不是添加新条目
            existingData[existingIndex] = {
              ...existingData[existingIndex],
              ...newData,
              updatedAt: timestamp
            };
            console.log(`更新文件 ${safeFileName} 中metadata.url为 ${metadataUrl} 的现有数据`);
          } else {
            // 添加新数据到数组
            existingData.push({
              ...newData,
              savedAt: timestamp
            });
            console.log(`向文件 ${safeFileName} 添加metadata.url为 ${metadataUrl} 的新数据`);
          }
        } else {
          // 如果没有任何URL，直接添加新数据
          existingData.push({
            ...newData,
            savedAt: timestamp
          });
          console.log(`向文件 ${safeFileName} 添加新数据（无URL）`);
        }
      }

      // 将合并后的数据写入文件，确保使用UTF-8编码
      const jsonContent = JSON.stringify(existingData, null, 2);
      fs.writeFileSync(filePath, jsonContent, { encoding: 'utf8' });
      console.log(`文件 ${safeFileName} 已更新，现有 ${existingData.length} 条数据`);
    } else {
      // 直接写入文件（覆盖模式），确保使用UTF-8编码
      fs.writeFileSync(filePath, data, { encoding: 'utf8' });
      console.log(`文件 ${safeFileName} 已创建/覆盖`);
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      fileName: safeFileName,
      filePath: filePath.replace(process.cwd(), ''),
      timestamp: timestamp,
      mode: append ? 'append' : 'overwrite'
    });
  } catch (error: any) {
    throw error; // 重新抛出错误，由外层处理
  }
}
