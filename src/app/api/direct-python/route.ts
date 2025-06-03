import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

// 将 exec 转换为 Promise 版本
const execPromise = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const url = request.nextUrl.searchParams.get('url') || 'https://www.example.com';
    const query = request.nextUrl.searchParams.get('query') || '分析网页内容';

    console.log(`直接调用 Python 脚本`);
    console.log(`URL: ${url}, 查询: ${query}`);

    // 确保脚本路径正确 - 使用绝对路径
    const scriptPath = path.join(process.cwd(), 'scripts', 'scrape.py');
    
    console.log(`脚本路径: ${scriptPath}`);

    // 调用 Python 脚本
    const { stdout, stderr } = await execPromise(`python "${scriptPath}" --url "${url}" --prompt "${query}"`, {
      env: {
        ...process.env,
        API_KEY: process.env.API_KEY || '',
        OPENAI_API_KEY: process.env.API_KEY || '' // 设置 OpenAI API 密钥
      },
      // 设置最大缓冲区大小，避免输出过大导致截断
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });

    // 如果有错误输出，记录但不中断流程
    if (stderr && stderr.trim()) {
      console.error(`Python 脚本错误输出: ${stderr}`);
    }

    // 分析输出结果
    const outputLines = stdout.trim().split('\n');
    
    // 查找最后一个有效的 JSON 行
    let lastJsonLine = '';
    for (let i = outputLines.length - 1; i >= 0; i--) {
      const line = outputLines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        lastJsonLine = line;
        break;
      }
    }

    // 如果找不到 JSON 行，使用最后一行
    if (!lastJsonLine && outputLines.length > 0) {
      lastJsonLine = outputLines[outputLines.length - 1];
    }

    try {
      // 尝试解析 JSON 结果
      if (lastJsonLine) {
        const result = JSON.parse(lastJsonLine);
        return NextResponse.json({ success: true, result });
      } else {
        return NextResponse.json({ 
          success: false, 
          error: '未找到有效的 JSON 输出',
          stdout: stdout
        });
      }
    } catch (parseError: any) {
      console.error('无法解析 Python 脚本输出的 JSON:', parseError.message);
      
      // 返回错误信息
      return NextResponse.json({ 
        success: false, 
        error: '无法解析爬取结果',
        details: parseError.message,
        lastLine: lastJsonLine || '(空)',
        stdout: stdout
      });
    }
  } catch (error: any) {
    console.error('API 错误:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
