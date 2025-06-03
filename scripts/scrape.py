#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
使用 ScrapegraphAI 和 GPT-4o 模型进行网页爬取和信息提取
增强版：添加重试机制和更好的错误处理
"""

import os
import sys
import json
import time
import argparse
import requests
from bs4 import BeautifulSoup
import traceback
from datetime import datetime
import random
import threading
import concurrent.futures
import re

# 导入 ScrapegraphAI
try:
    # 使用正确的导入路径
    from scrapegraphai.graphs import SmartScraperGraph
    SCRAPEGRAPHAI_AVAILABLE = True
    print("成功导入 ScrapegraphAI 库")
except ImportError:
    print("警告: ScrapegraphAI 库未安装，尝试安装...")
    try:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "scrapegraphai"])
        try:
            from scrapegraphai.graphs import SmartScraperGraph
            SCRAPEGRAPHAI_AVAILABLE = True
            print("成功安装并导入 ScrapegraphAI 库")
        except ImportError:
            print(f"无法导入 SmartScraperGraph，即使安装了 scrapegraphai 库")
            SCRAPEGRAPHAI_AVAILABLE = False
    except Exception as e:
        print(f"无法安装 ScrapegraphAI 库: {e}")
        SCRAPEGRAPHAI_AVAILABLE = False

# 设置最大重试次数
MAX_RETRIES = 3  # 增加重试次数到3次
# 设置重试间隔（秒）
RETRY_DELAY = [1, 3, 5]  # 重试等待时间递增
# 设置超时时间（秒）
FETCH_TIMEOUT = 30  # 增加获取网页的超时时间到30秒
API_TIMEOUT = 60  # API的超时时间
TOTAL_TIMEOUT = 180  # 增加整个脚本的超时时间到180秒
# 内容限制
MAX_HTML_SIZE = 1000000  # 增加HTML大小限制到1MB
MAX_TEXT_SIZE = 50000  # 增加提取的文本大小到50000字符

# GPT-4o API 配置
API_KEY = "sk-ZgmSsStO4PqVVWc9xV2blbCt4H95KhgSRX8D4Ai0Q79SfdT6"
API_URL = "https://newapi.tu-zi.com/v1/chat/completions"
MODEL = "gpt-4o"

# ScrapegraphAI 配置
SCRAPEGRAPH_CONFIG = {
    "provider": "openai",  # 使用OpenAI API
    "model": MODEL,
    "api_key": API_KEY,
    "api_base": API_URL,
    "max_tokens_limit": 100000,  # 不限制响应大小
    "max_items": 100,  # 不限制爬取项目数量
    "temperature": 0.1,  # 低温度，确保输出更确定性
}

# 初始化变量
SCRAPEGRAPHAI_AVAILABLE = False
LANGCHAIN_AVAILABLE = False

# OpenAI 配置
OPENAI_CONFIG = {
    "model": MODEL,
    "api_key": API_KEY,
    "base_url": API_URL,
    "temperature": 0.1,  # 低温度，确保输出更确定性
    "max_tokens": 4000,  # 响应的最大长度
}

# 初始化默认值
url = ""
query = ""

# 参数将在 main_with_timeout 函数中通过 argparse 解析

# 确保最后一行输出是有效的JSON，用于Node.js解析
def ensure_json_output(result):
    """确保最后输出的是有效的JSON字符串"""
    try:
        # 如果已经是字典，直接转为JSON字符串
        if isinstance(result, dict):
            return json.dumps(result, ensure_ascii=False)
        # 如果是字符串，尝试解析为JSON，然后再转回字符串
        # 这样可以确保格式正确
        json_obj = json.loads(result)
        return json.dumps(json_obj, ensure_ascii=False)
    except:
        # 如果无法解析为JSON，则包装为JSON对象
        return json.dumps({"text": result, "status": "success"}, ensure_ascii=False)

def check_ollama_service():
    """检查 Ollama 服务是否正常运行"""
    print("\n检查 Ollama 服务状态...")
    for retry in range(MAX_RETRIES):
        try:
            if retry > 0:
                delay = RETRY_DELAY[min(retry-1, len(RETRY_DELAY)-1)]
                print(f"第 {retry} 次重试，等待 {delay} 秒...")
                time.sleep(delay)

            response = requests.get("http://localhost:11434/api/tags", timeout=10)
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [model.get("name") for model in models]
                print(f"Ollama 服务正常运行，可用模型: {', '.join(model_names)}")
                return True, model_names
            else:
                print(f"Ollama 服务返回错误: {response.status_code} - {response.text}")
                if retry < MAX_RETRIES - 1:
                    print("将尝试重新连接...")
                    continue
                return False, []
        except Exception as e:
            print(f"Ollama 服务连接失败: {e}")
            if retry < MAX_RETRIES - 1:
                print("将尝试重新连接...")
                continue

            print("\n请确保 Ollama 服务正在运行。可以使用以下命令启动 Ollama:")
            print(r"Windows: & \"C:\Users\ASUS\AppData\Local\Programs\Ollama\ollama.exe\" serve")
            print("Linux/Mac: ollama serve")

            # 尝试自动启动 Ollama 服务（支持 Windows 和 Linux）
            try:
                print("\n尝试自动启动 Ollama 服务...")
                # 检测操作系统类型
                import platform
                system = platform.system()

                if system == "Windows":
                    # Windows 系统
                    os.system(r"start /B \"\" \"C:\Users\ASUS\AppData\Local\Programs\Ollama\ollama.exe\" serve")
                elif system == "Linux":
                    # Linux 系统
                    os.system("ollama serve > /dev/null 2>&1 &")
                else:
                    # macOS 或其他系统
                    os.system("ollama serve &")

                print("已尝试启动 Ollama 服务，请等待几秒钟...")
                time.sleep(5)  # 等待服务启动

                # 再次检查服务
                try:
                    response = requests.get("http://localhost:11434/api/tags", timeout=10)
                    if response.status_code == 200:
                        models = response.json().get("models", [])
                        model_names = [model.get("name") for model in models]
                        print(f"Ollama 服务已成功启动，可用模型: {', '.join(model_names)}")
                        return True, model_names
                except:
                    pass
            except Exception as e:
                print(f"启动 Ollama 服务失败: {e}")
                pass

            return False, []

def fetch_webpage_with_timeout(url, timeout=FETCH_TIMEOUT):
    """带超时控制的网页获取函数"""
    # 创建一个事件，用于通知线程结束
    stop_event = threading.Event()
    result = {"html": None, "error": None}

    def _fetch():
        try:
            # 添加更多不同的User-Agent，避免被网站封锁
            user_agents = [
                # Chrome
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                # Firefox
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
                # Safari
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
                # Edge
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
                # Mobile
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36"
            ]

            for retry in range(MAX_RETRIES):
                if stop_event.is_set():
                    return  # 如果收到停止信号，立即退出

                try:
                    if retry > 0:
                        delay = RETRY_DELAY[min(retry-1, len(RETRY_DELAY)-1)]
                        print(f"第 {retry} 次重试获取网页，等待 {delay} 秒...")
                        time.sleep(delay)

                    # 随机选择一个User-Agent
                    headers = {
                        "User-Agent": user_agents[retry % len(user_agents)],
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7",
                        "Accept-Encoding": "gzip, deflate, br",
                        "Connection": "keep-alive",
                        "Upgrade-Insecure-Requests": "1",
                        "Cache-Control": "max-age=0",
                        "Sec-Ch-Ua": "\"Not A(Brand\";v=\"99\", \"Google Chrome\";v=\"121\", \"Chromium\";v=\"121\"",
                        "Sec-Ch-Ua-Mobile": "?0",
                        "Sec-Ch-Ua-Platform": "\"Windows\"",
                        "Sec-Fetch-Dest": "document",
                        "Sec-Fetch-Mode": "navigate",
                        "Sec-Fetch-Site": "none",
                        "Sec-Fetch-User": "?1",
                        "Pragma": "no-cache",
                        "Priority": "u=0, i"
                    }

                    print(f"使用 User-Agent: {headers['User-Agent'][:30]}...")

                    # 使用流式请求，避免下载过大的内容
                    # 添加更多请求参数，提高成功率
                    request_params = {
                        "headers": headers,
                        "timeout": min(10, timeout/2),  # 增加单次请求超时时间
                        "stream": True,
                        "allow_redirects": True,  # 允许重定向
                        "verify": True,  # 验证SSL证书
                    }



                    # 发送请求
                    with requests.get(url, **request_params) as response:
                        response.raise_for_status()  # 如果请求失败，抛出异常

                        # 获取响应头信息
                        content_type = response.headers.get('Content-Type', '')
                        print(f"Content-Type: {content_type}")

                        # 如果不是HTML内容，可能需要特殊处理
                        if 'text/html' not in content_type and 'application/xhtml+xml' not in content_type:
                            print(f"警告: 响应不是HTML内容，而是 {content_type}")

                        # 检测编码
                        if response.encoding == 'ISO-8859-1' or not response.encoding:
                            # 可能是网页没有指定编码，尝试使用更常见的编码
                            detected_encoding = response.apparent_encoding
                            print(f"检测到编码: {detected_encoding}")
                            if detected_encoding:
                                response.encoding = detected_encoding
                            else:
                                # 如果无法检测编码，尝试常见的编码
                                for enc in ['utf-8', 'gbk', 'gb2312', 'big5']:
                                    try:
                                        response.encoding = enc
                                        break
                                    except:
                                        continue

                        # 只读取限定大小的内容
                        content = ""
                        content_length = 0

                        # 使用更大的块大小，提高效率
                        for chunk in response.iter_content(chunk_size=32768, decode_unicode=True):
                            if stop_event.is_set():
                                return  # 如果收到停止信号，立即退出

                            if chunk:
                                content += chunk
                                content_length += len(chunk)
                                if content_length >= MAX_HTML_SIZE:
                                    print(f"网页内容过大，已截断至 {MAX_HTML_SIZE} 字符")
                                    break

                        # 检查内容是否为空
                        if not content.strip():
                            print("警告: 获取的内容为空")
                            if retry < MAX_RETRIES - 1:
                                print("将尝试重新获取...")
                                continue
                            else:
                                result["error"] = "获取的内容为空"
                                return

                        print(f"网页获取成功，内容长度: {content_length} 字符")
                        result["html"] = content
                        return

                except requests.exceptions.HTTPError as e:
                    print(f"HTTP错误: {e}")
                    if e.response.status_code == 403:
                        print("可能被网站拒绝访问，尝试更换 User-Agent...")
                    elif e.response.status_code == 404:
                        print("页面不存在，请检查URL是否正确")
                        result["error"] = f"页面不存在: {url}"
                        return  # 404错误不需要重试
                    elif e.response.status_code == 429:
                        print("请求过于频繁，网站限制访问")
                        result["error"] = "请求过于频繁，网站限制访问"

                    if retry >= MAX_RETRIES - 1:
                        result["error"] = f"HTTP错误: {e}"

                except requests.exceptions.ConnectionError as e:
                    print(f"连接错误: 无法连接到 {url}")
                    if retry >= MAX_RETRIES - 1:
                        result["error"] = f"连接错误: {e}"

                except requests.exceptions.Timeout as e:
                    print("请求超时")
                    if retry >= MAX_RETRIES - 1:
                        result["error"] = f"请求超时: {e}"

                except Exception as e:
                    print(f"获取网页失败: {e}")
                    if retry >= MAX_RETRIES - 1:
                        result["error"] = f"获取网页失败: {e}"

        except Exception as e:
            result["error"] = f"获取网页线程异常: {e}"
            print(f"获取网页线程异常: {e}")

    # 创建并启动线程
    fetch_thread = threading.Thread(target=_fetch)
    fetch_thread.daemon = True  # 设置为守护线程，主线程结束时自动结束
    fetch_thread.start()

    # 等待线程完成或超时
    fetch_thread.join(timeout)

    # 如果线程仍在运行，发送停止信号并返回超时错误
    if fetch_thread.is_alive():
        stop_event.set()  # 发送停止信号
        print(f"获取网页超时（{timeout}秒）")
        return None, f"获取网页超时（{timeout}秒）"

    return result["html"], result["error"]

def fetch_webpage(url):
    """获取网页内容"""
    print(f"\n正在获取网页: {url}")

    # 使用带超时控制的函数获取网页
    html_content, error = fetch_webpage_with_timeout(url)

    if html_content:
        return html_content
    else:
        print(f"获取网页失败: {error}")
        return None

# 使用 ScrapegraphAI 爬取网页
def scrape_with_scrapegraphai(url, prompt, timeout=API_TIMEOUT):
    """使用 ScrapegraphAI 爬取网页并提取信息"""
    print(f"\n使用 ScrapegraphAI 爬取网页: {url}")
    print(f"查询关键词: {prompt}")
    print(f"使用模型: {MODEL}")

    # 创建一个事件，用于通知线程结束
    stop_event = threading.Event()
    result = {"response": None, "error": None}

    def _scrape():
        try:
            if not SCRAPEGRAPHAI_AVAILABLE:
                result["error"] = "ScrapegraphAI 库不可用"
                return

            # 创建 SmartScraperGraph 实例
            scraper = SmartScraperGraph(
                provider=SCRAPEGRAPH_CONFIG["provider"],
                model=SCRAPEGRAPH_CONFIG["model"],
                api_key=SCRAPEGRAPH_CONFIG["api_key"],
                api_base=SCRAPEGRAPH_CONFIG["api_base"],
                temperature=SCRAPEGRAPH_CONFIG["temperature"],
                max_tokens_limit=SCRAPEGRAPH_CONFIG["max_tokens_limit"]
            )

            # 构建提示词
            full_prompt = f"""从以下网页内容中提取"{prompt}"的具体实例列表。

严格要求：
1. 只提取"{prompt}"的具体实例，不要提取其他任何实体
2. 每个实体的name字段必须是"{prompt}"的一个具体名称或种类
3. 例如：
   - 如果查询是"小吃"，则只提取具体小吃的名称（如"煎饼果子"、"臭豆腐"等）
   - 如果查询是"明星"，则只提取具体明星的姓名（如"周杰伦"、"刘德华"等）
   - 如果查询是"手机品牌"，则只提取具体手机品牌的名称（如"苹果"、"华为"等）
4. 不要提取人物、组织、地点等与"{prompt}"无关的实体
5. 如果实体不是"{prompt}"的具体实例，则不要包含在结果中
6. 尽可能提取每个实体的属性，如发源地、特点、创始时间等
7. 每个实体必须包含source_url字段，值为"{url}"

只返回JSON格式，不要有任何其他文本:
{{
  "entities": [
    {{
      "name": "具体的{prompt}名称",
      "attributes": {{
        "属性1": "值1",
        "属性2": "值2"
      }},
      "source_url": "{url}"
    }}
  ]
}}

如果网页中没有找到"{prompt}"的具体实例，则返回空数组：{{"entities": []}}"""

            # 爬取网页
            for retry in range(MAX_RETRIES):
                try:
                    if retry > 0:
                        delay = RETRY_DELAY[min(retry-1, len(RETRY_DELAY)-1)]
                        print(f"第 {retry} 次重试爬取，等待 {delay} 秒...")
                        time.sleep(delay)

                    print(f"开始爬取网页: {url}")
                    response = scraper.scrape(
                        url=url,
                        prompt=full_prompt,
                        max_items=SCRAPEGRAPH_CONFIG["max_items"]
                    )

                    # 检查响应
                    if response and isinstance(response, dict):
                        # 添加元数据
                        if "metadata" not in response:
                            response["metadata"] = {}

                        response["metadata"]["url"] = url
                        response["metadata"]["query"] = prompt

                        # 转换为JSON字符串
                        result["response"] = json.dumps(response, ensure_ascii=False)
                        return
                    else:
                        print(f"ScrapegraphAI 返回无效响应: {response}")
                        if retry < MAX_RETRIES - 1:
                            continue

                        result["error"] = "ScrapegraphAI 返回无效响应"
                        return

                except Exception as e:
                    print(f"ScrapegraphAI 爬取失败: {e}")
                    if retry < MAX_RETRIES - 1:
                        continue

                    result["error"] = f"ScrapegraphAI 爬取失败: {e}"
                    return

        except Exception as e:
            result["error"] = f"ScrapegraphAI 线程异常: {e}"
            print(f"ScrapegraphAI 线程异常: {e}")

    # 创建并启动线程
    scrape_thread = threading.Thread(target=_scrape)
    scrape_thread.daemon = True
    scrape_thread.start()

    # 等待线程完成或超时
    scrape_thread.join(timeout)

    # 如果线程仍在运行，发送停止信号并返回超时错误
    if scrape_thread.is_alive():
        stop_event.set()
        print(f"ScrapegraphAI 爬取超时（{timeout}秒）")
        return None, f"ScrapegraphAI 爬取超时（{timeout}秒）"

    return result["response"], result["error"]

def extract_text_from_html(html_content):
    """从 HTML 中提取文本内容，使用更高级的方法"""
    if not html_content:
        return None

    try:
        # 限制HTML大小
        if len(html_content) > MAX_HTML_SIZE:
            html_content = html_content[:MAX_HTML_SIZE]
            print(f"HTML内容过大，已截断至 {MAX_HTML_SIZE} 字符")

        # 确保HTML内容是UTF-8编码
        if isinstance(html_content, bytes):
            try:
                html_content = html_content.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    html_content = html_content.decode('gbk')
                except UnicodeDecodeError:
                    try:
                        html_content = html_content.decode('gb2312')
                    except UnicodeDecodeError:
                        try:
                            html_content = html_content.decode('big5')
                        except UnicodeDecodeError:
                            html_content = html_content.decode('utf-8', errors='ignore')

        # 强制转换为Unicode字符串
        html_content = str(html_content)

        # 检查是否包含乱码（常见乱码特征）
        if '�' in html_content or '\ufffd' in html_content:
            print("检测到可能的乱码，尝试修复...")
            # 尝试不同的编码方式
            for encoding in ['utf-8', 'gbk', 'gb2312', 'big5', 'utf-16', 'latin1']:
                try:
                    # 先尝试将字符串编码为bytes，然后用不同编码解码
                    temp_bytes = html_content.encode('utf-8', errors='ignore')
                    decoded = temp_bytes.decode(encoding, errors='ignore')
                    # 检查解码后的字符串是否仍然包含乱码
                    if '�' not in decoded and '\ufffd' not in decoded:
                        html_content = decoded
                        print(f"使用 {encoding} 编码修复乱码成功")
                        break
                except Exception as e:
                    print(f"使用 {encoding} 编码修复乱码失败: {e}")

        # 检查HTML内容是否为空
        if not html_content.strip():
            print("警告: HTML内容为空")
            return "HTML内容为空"

        # 检查HTML内容是否有效
        if "<html" not in html_content.lower() and "<body" not in html_content.lower():
            print("警告: 可能不是有效的HTML内容")
            # 尝试添加基本HTML标签
            html_content = f"<html><body>{html_content}</body></html>"

        # 使用更强大的解析器
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
        except:
            try:
                # 如果html.parser失败，尝试lxml
                soup = BeautifulSoup(html_content, 'lxml')
            except:
                # 如果lxml也失败，尝试html5lib
                try:
                    soup = BeautifulSoup(html_content, 'html5lib')
                except:
                    # 如果所有解析器都失败，使用最简单的解析器
                    soup = BeautifulSoup(html_content, 'html.parser', from_encoding='utf-8')

        # 移除脚本、样式和其他不必要的元素
        for tag in soup(["script", "style", "iframe", "nav", "footer", "aside", "head", "meta", "link", "noscript",
                         "svg", "path", "button", "form", "input", "header", "menu", "menuitem", "option", "select"]):
            tag.extract()

        # 移除所有隐藏元素和广告
        for tag in soup.find_all(style=lambda value: value and ('display:none' in value or 'visibility:hidden' in value)):
            tag.extract()

        # 移除可能的广告容器和无关内容
        ad_terms = ['ad', 'ads', 'advert', 'banner', 'sponsor', 'popup', 'modal', 'cookie', 'newsletter', 'subscription']
        for tag in soup.find_all(class_=lambda value: value and any(ad_term in value.lower() for ad_term in ad_terms)):
            tag.extract()

        for tag in soup.find_all(id=lambda value: value and any(ad_term in value.lower() for ad_term in ad_terms)):
            tag.extract()

        # 尝试找到主要内容区域
        main_content = None
        content_selectors = [
            "main", "article", "div.content", "div.main", "div.article", "div.post",
            "#content", "#main", "#article", ".article-content", ".post-content", ".entry-content", ".content-area",
            "[role='main']", "[itemprop='articleBody']", "[itemprop='mainContentOfPage']",
            ".main-content", ".main-container", ".container", ".wrapper", ".page-content"
        ]

        for selector in content_selectors:
            main_tags = soup.select(selector)
            if main_tags:
                main_content = main_tags[0]
                print(f"找到主要内容区域: {selector}")
                break

        # 如果找到主要内容区域，使用它；否则使用整个页面
        if main_content:
            content_soup = main_content
        else:
            # 如果没有找到主要内容区域，尝试使用最大的文本块
            text_blocks = []
            for tag in soup.find_all(['p', 'div', 'section', 'article', 'main']):
                if tag.get_text(strip=True):
                    text_blocks.append((tag, len(tag.get_text(strip=True))))

            if text_blocks:
                # 按文本长度排序
                text_blocks.sort(key=lambda x: x[1], reverse=True)
                # 使用最大的文本块
                content_soup = text_blocks[0][0]
                print(f"使用最大文本块，长度: {text_blocks[0][1]} 字符")
            else:
                content_soup = soup
                print("未找到主要内容区域，使用整个页面")

        # 获取标题
        title = ""
        if soup.title:
            title = soup.title.string

        # 尝试从h1标签获取标题
        if not title and soup.h1:
            title = soup.h1.get_text(strip=True)

        # 尝试从meta标签获取标题
        if not title:
            meta_title = soup.find('meta', {'property': 'og:title'}) or soup.find('meta', {'name': 'title'})
            if meta_title and meta_title.get('content'):
                title = meta_title['content']

        # 获取文本
        text = content_soup.get_text(separator='\n', strip=True)

        # 检查是否包含乱码（常见乱码特征）
        if '�' in text or '\ufffd' in text:
            print("提取的文本内容包含乱码，尝试修复...")
            # 尝试不同的编码方式
            for encoding in ['utf-8', 'gbk', 'gb2312', 'big5', 'utf-16', 'latin1']:
                try:
                    # 先尝试将字符串编码为bytes，然后用不同编码解码
                    temp_bytes = text.encode('utf-8', errors='ignore')
                    decoded = temp_bytes.decode(encoding, errors='ignore')
                    # 检查解码后的字符串是否仍然包含乱码
                    if '�' not in decoded and '\ufffd' not in decoded:
                        text = decoded
                        print(f"使用 {encoding} 编码修复文本乱码成功")
                        break
                except Exception as e:
                    print(f"使用 {encoding} 编码修复文本乱码失败: {e}")

        # 处理文本，删除多余的空行和空格
        lines = []
        for line in text.splitlines():
            line = line.strip()
            if line:  # 只保留非空行
                # 删除多余的空格
                line = re.sub(r'\s+', ' ', line)
                lines.append(line)

        text = '\n'.join(lines)

        # 删除重复的行
        unique_lines = []
        seen_lines = set()
        for line in text.splitlines():
            line_lower = line.lower()
            if line_lower not in seen_lines and len(line) > 5:  # 忽略太短的行
                seen_lines.add(line_lower)
                unique_lines.append(line)

        text = '\n'.join(unique_lines)

        # 如果文本太长，截断它
        if len(text) > MAX_TEXT_SIZE:
            # 保留开头和结尾的一部分内容
            head_size = int(MAX_TEXT_SIZE * 0.8)  # 80%用于开头
            tail_size = MAX_TEXT_SIZE - head_size  # 剩余用于结尾

            text = text[:head_size] + "\n...\n[内容已截断]\n...\n" + text[-tail_size:]
            print(f"提取的文本过长，已截断至约 {MAX_TEXT_SIZE} 字符")

        # 添加标题
        if title:
            text = f"标题: {title}\n\n{text}"

        # 检查提取的文本是否为空
        if not text.strip():
            print("警告: 提取的文本为空")
            return "提取的文本为空"

        # 检查提取的文本是否太短
        if len(text.strip()) < 50:
            print(f"警告: 提取的文本太短 ({len(text.strip())} 字符)")

        return text
    except Exception as e:
        print(f"提取文本失败: {e}")
        print(traceback.format_exc())

        # 尝试简单提取
        try:
            print("尝试使用简单方法提取文本...")
            # 使用正则表达式直接提取文本
            text = re.sub(r'<script.*?</script>', '', html_content, flags=re.DOTALL)
            text = re.sub(r'<style.*?</style>', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()

            if len(text) > MAX_TEXT_SIZE:
                text = text[:MAX_TEXT_SIZE] + "...\n[内容太长，已截断]"

            if not text.strip():
                return "无法提取网页内容"

            return text
        except Exception as e:
            print(f"简单提取也失败: {e}")
            return "无法提取网页内容"

def ask_ollama_with_timeout(prompt, model="deepseek-r1:7b", html_content=None, timeout=API_TIMEOUT):
    """带超时控制的 Ollama API 调用函数"""
    # 创建一个事件，用于通知线程结束
    stop_event = threading.Event()
    result = {"response": None, "error": None}

    def _ask():
        try:
            # 构建完整提示
            full_prompt = prompt

            if html_content:
                # 如果提供了 HTML 内容，添加到提示中
                text_content = extract_text_from_html(html_content)
                if text_content:
                    # 极其明确地指导模型只提取查询的具体实例
                    full_prompt = f"""从以下网页内容中提取"{prompt}"的具体实例列表。

严格要求：
1. 只提取"{prompt}"的具体实例，不要提取其他任何实体
2. 每个实体的name字段必须是"{prompt}"的一个具体名称或种类
3. 例如：
   - 如果查询是"小吃"，则只提取具体小吃的名称（如"煎饼果子"、"臭豆腐"等）
   - 如果查询是"明星"，则只提取具体明星的姓名（如"周杰伦"、"刘德华"等）
   - 如果查询是"手机品牌"，则只提取具体手机品牌的名称（如"苹果"、"华为"等）
4. 不要提取人物、组织、地点等与"{prompt}"无关的实体
5. 如果实体不是"{prompt}"的具体实例，则不要包含在结果中
6. 每个实体必须包含source_url字段，值为当前网页的URL

以下是网页内容:
{text_content}

网页URL: {url}

只返回JSON格式，不要有任何其他文本:
{{
  "entities": [
    {{
      "name": "具体的{prompt}名称",
      "attributes": {{
        "属性1": "值1",
        "属性2": "值2"
      }},
      "source_url": "{url}"
    }}
  ]
}}

如果网页中没有找到"{prompt}"的具体实例，则返回空数组：{{"entities": []}}"""

            print(f"\n正在向 Ollama 发送请求...")
            print(f"模型: {model}")
            print(f"提示: {prompt}")

            for retry in range(MAX_RETRIES):
                if stop_event.is_set():
                    return  # 如果收到停止信号，立即退出

                try:
                    if retry > 0:
                        delay = RETRY_DELAY[min(retry-1, len(RETRY_DELAY)-1)]
                        print(f"第 {retry} 次重试调用 Ollama API，等待 {delay} 秒...")
                        time.sleep(delay)

                    # 调用 Ollama API，使用最优参数设置
                    start_time = time.time()
                    response = requests.post(
                        "http://localhost:11434/api/generate",
                        json={
                            "model": model,
                            "prompt": full_prompt,
                            "temperature": 0.01,  # 极低的温度，确保输出更确定性
                            "stream": False,
                            "format": "json",  # 使用JSON格式
                            "num_predict": 1024,  # 增加token数量限制
                            "top_p": 0.5,  # 更严格的采样范围
                            "top_k": 20,  # 更严格的候选词数量
                            "stop": ["\n\n", "```"]  # 添加停止标记，避免生成额外内容
                        },
                        timeout=min(30, timeout/2)  # 增加单次请求超时时间
                    )
                    elapsed_time = time.time() - start_time

                    print(f"Ollama 响应时间: {elapsed_time:.2f} 秒")

                    if response.status_code == 200:
                        api_result = response.json()
                        raw_response = api_result.get("response", "")

                        # 尝试从响应中提取JSON
                        try:
                            # 查找JSON开始的位置
                            json_start = raw_response.find('{')
                            json_end = raw_response.rfind('}') + 1

                            if json_start >= 0 and json_end > json_start:
                                json_str = raw_response[json_start:json_end]
                                # 尝试解析JSON
                                try:
                                    json_obj = json.loads(json_str)
                                    # 如果成功解析为JSON，添加原始文本
                                    if not isinstance(json_obj, dict):
                                        json_obj = {"data": json_obj}

                                    # 添加元数据，但保持简洁
                                    json_obj["metadata"] = {
                                        "query": prompt
                                    }

                                    # 确保使用UTF-8编码，避免中文乱码
                                    result["response"] = json.dumps(json_obj, ensure_ascii=False)
                                    return
                                except:
                                    # JSON解析失败，使用简化的响应
                                    pass
                        except:
                            pass

                        # 如果无法提取JSON，使用简化的JSON格式
                        result["response"] = json.dumps({
                            "text": raw_response[:1000],  # 限制响应长度
                            "metadata": {
                                "model": model,
                                "query": prompt
                            }
                        }, ensure_ascii=False)
                        return
                    else:
                        print(f"Ollama API 错误: {response.status_code}")
                        if retry < MAX_RETRIES - 1:
                            continue

                        # 所有重试都失败，返回简化的错误信息
                        result["error"] = f"Ollama API 错误: {response.status_code}"
                        return

                except requests.exceptions.ConnectionError:
                    print(f"连接错误: 无法连接到 Ollama 服务")
                    if retry < MAX_RETRIES - 1:
                        continue

                    # 所有重试都失败，返回简化的错误信息
                    result["error"] = "无法连接到 Ollama 服务"
                    return

                except requests.exceptions.Timeout:
                    print("请求超时")
                    if retry < MAX_RETRIES - 1:
                        continue

                    # 所有重试都失败，返回简化的错误信息
                    result["error"] = "Ollama API 请求超时"
                    return

                except Exception as e:
                    print(f"调用 Ollama API 失败: {e}")
                    if retry < MAX_RETRIES - 1:
                        continue

                    # 所有重试都失败，返回简化的错误信息
                    result["error"] = "调用 Ollama API 失败"
                    return

        except Exception as e:
            result["error"] = f"Ollama API 线程异常: {e}"
            print(f"Ollama API 线程异常: {e}")

    # 创建并启动线程
    ask_thread = threading.Thread(target=_ask)
    ask_thread.daemon = True  # 设置为守护线程，主线程结束时自动结束
    ask_thread.start()

    # 等待线程完成或超时
    ask_thread.join(timeout)

    # 如果线程仍在运行，发送停止信号并返回超时错误
    if ask_thread.is_alive():
        stop_event.set()  # 发送停止信号
        print(f"Ollama API 调用超时（{timeout}秒）")
        return None, f"Ollama API 调用超时（{timeout}秒）"

    return result["response"], result["error"]

def ask_ollama(prompt, model="deepseek-r1:7b", html_content=None):
    """直接调用 Ollama API 提问"""
    # 使用带超时控制的函数调用 Ollama API
    response, error = ask_ollama_with_timeout(prompt, model, html_content)

    if response:
        # 确保响应是有效的UTF-8编码
        try:
            # 尝试解析JSON
            json_obj = json.loads(response)
            # 重新编码为UTF-8
            return json.dumps(json_obj, ensure_ascii=False)
        except:
            # 如果解析失败，直接返回原始响应
            return response
    else:
        # 构建错误响应
        error_response = json.dumps({
            "error": error or "未知错误",
            "metadata": {
                "query": prompt
            }
        }, ensure_ascii=False)
        return error_response

def scrape_single_website(url, prompt, model="deepseek-r1:7b"):
    """爬取单个网站并使用 ScrapegraphAI 或 Ollama 分析内容"""
    # 获取网页内容
    html_content = fetch_webpage(url)
    if not html_content:
        return {
            "error": "无法获取网页内容",
            "metadata": {
                "url": url,
                "query": prompt
            }
        }

    # 优先使用 ScrapegraphAI
    if SCRAPEGRAPHAI_AVAILABLE:
        print(f"使用 ScrapegraphAI 和 {MODEL} 模型爬取: {url}")
        try:
            # 使用 ScrapegraphAI 分析内容
            answer, error = scrape_with_scrapegraphai(url, prompt)

            # 检查是否有错误
            if error:
                print(f"ScrapegraphAI 爬取失败: {error}，尝试使用 Ollama...")
                # 如果 ScrapegraphAI 失败，回退到 Ollama
                answer, error = ask_ollama_with_timeout(prompt, model, html_content)
                if error:
                    print(f"Ollama 爬取也失败: {error}")
                    return {
                        "error": f"爬取失败: {error}",
                        "metadata": {
                            "url": url,
                            "query": prompt
                        }
                    }
            else:
                print(f"ScrapegraphAI 爬取成功")
        except Exception as e:
            print(f"ScrapegraphAI 异常: {e}，尝试使用 Ollama...")
            # 如果 ScrapegraphAI 出现异常，回退到 Ollama
            answer, error = ask_ollama_with_timeout(prompt, model, html_content)
            if error:
                print(f"Ollama 爬取也失败: {error}")
                return {
                    "error": f"爬取失败: {error}",
                    "metadata": {
                        "url": url,
                        "query": prompt
                    }
                }
    else:
        # 使用 Ollama 分析内容
        print(f"ScrapegraphAI 不可用，使用 Ollama 爬取: {url}")
        answer, error = ask_ollama_with_timeout(prompt, model, html_content)
        if error:
            print(f"Ollama 爬取失败: {error}")
            return {
                "error": f"爬取失败: {error}",
                "metadata": {
                    "url": url,
                    "query": prompt
                }
            }

    # 处理爬取结果
    try:
        # 检查answer是否是字符串
        if isinstance(answer, str):
            # 尝试解析为JSON对象
            try:
                result = json.loads(answer)

                # 如果成功，添加URL信息到metadata中（避免重复字段）
                if isinstance(result, dict):
                    # 确保有metadata字段
                    if "metadata" not in result:
                        result["metadata"] = {}

                    # 只在metadata中添加URL，避免重复
                    result["metadata"]["url"] = url
                    result["metadata"]["query"] = prompt

                    # 确保不存在重复的url字段
                    if "url" in result and result["url"] != url:
                        # 如果已存在不同的url字段，将其移动到metadata中
                        result["metadata"]["original_url"] = result["url"]
                        del result["url"]

                    # 提取HTML和文本内容
                    if html_content and not result.get("html"):
                        # 确保HTML内容是UTF-8编码的字符串
                        if isinstance(html_content, bytes):
                            try:
                                html_content = html_content.decode('utf-8')
                            except UnicodeDecodeError:
                                try:
                                    html_content = html_content.decode('gbk')
                                except UnicodeDecodeError:
                                    try:
                                        html_content = html_content.decode('gb2312')
                                    except UnicodeDecodeError:
                                        html_content = html_content.decode('utf-8', errors='ignore')

                        # 过滤掉不可打印字符和控制字符
                        html_content = ''.join(c for c in html_content if c.isprintable() or c in ['\n', '\t', ' '])

                        # 只保存HTML的文本内容，不保存原始HTML
                        try:
                            soup = BeautifulSoup(html_content, 'html.parser')
                            text_content = soup.get_text(separator='\n', strip=True)
                            result["html"] = text_content[:MAX_HTML_SIZE]
                        except:
                            # 如果解析失败，保存过滤后的HTML
                            result["html"] = html_content[:MAX_HTML_SIZE]

                    if not result.get("content"):
                        text_content = extract_text_from_html(html_content)
                        if text_content:
                            result["content"] = text_content[:MAX_TEXT_SIZE]

                    # 添加时间戳
                    result["metadata"]["timestamp"] = datetime.now().isoformat()

                    # 确保每个实体都有source_url字段
                    if "entities" in result and isinstance(result["entities"], list):
                        for entity in result["entities"]:
                            if isinstance(entity, dict) and "source_url" not in entity:
                                entity["source_url"] = url

                    return result
                else:
                    # 如果结果不是字典，包装为字典
                    return {
                        "data": result,
                        "metadata": {
                            "url": url,
                            "query": prompt,
                            "timestamp": datetime.now().isoformat()
                        }
                    }
            except json.JSONDecodeError as e:
                # 如果不是有效的JSON，尝试提取JSON部分
                print(f"解析JSON失败: {e}, 尝试提取JSON部分...")

                # 尝试从文本中提取JSON部分
                json_match = re.search(r'(\{.*\})', answer, re.DOTALL)
                if json_match:
                    try:
                        json_str = json_match.group(1)
                        result = json.loads(json_str)

                        # 添加元数据
                        if isinstance(result, dict):
                            if "metadata" not in result:
                                result["metadata"] = {}

                            result["metadata"]["url"] = url
                            result["metadata"]["query"] = prompt
                            result["metadata"]["timestamp"] = datetime.now().isoformat()

                            # 确保每个实体都有source_url字段
                            if "entities" in result and isinstance(result["entities"], list):
                                for entity in result["entities"]:
                                    if isinstance(entity, dict) and "source_url" not in entity:
                                        entity["source_url"] = url

                            # 提取HTML和文本内容
                            if html_content and not result.get("html"):
                                # 确保HTML内容是UTF-8编码的字符串
                                if isinstance(html_content, bytes):
                                    try:
                                        html_content = html_content.decode('utf-8')
                                    except UnicodeDecodeError:
                                        try:
                                            html_content = html_content.decode('gbk')
                                        except UnicodeDecodeError:
                                            try:
                                                html_content = html_content.decode('gb2312')
                                            except UnicodeDecodeError:
                                                html_content = html_content.decode('utf-8', errors='ignore')

                                # 过滤掉不可打印字符和控制字符，但保留中文字符
                                html_content = ''.join(c for c in html_content if c.isprintable() or c in ['\n', '\t', ' '])

                                # 检查是否包含乱码（常见乱码特征）
                                if '�' in html_content or '\ufffd' in html_content:
                                    print("检测到可能的乱码，尝试修复...")
                                    # 尝试不同的编码方式
                                    for encoding in ['utf-8', 'gbk', 'gb2312', 'big5', 'utf-16', 'latin1']:
                                        try:
                                            # 先尝试将字符串编码为bytes，然后用不同编码解码
                                            temp_bytes = html_content.encode('utf-8', errors='ignore')
                                            decoded = temp_bytes.decode(encoding, errors='ignore')
                                            # 检查解码后的字符串是否仍然包含乱码
                                            if '�' not in decoded and '\ufffd' not in decoded:
                                                html_content = decoded
                                                print(f"使用 {encoding} 编码修复乱码成功")
                                                break
                                        except Exception as e:
                                            print(f"使用 {encoding} 编码修复乱码失败: {e}")

                                # 只保存HTML的文本内容，不保存原始HTML
                                try:
                                    soup = BeautifulSoup(html_content, 'html.parser')
                                    text_content = soup.get_text(separator='\n', strip=True)

                                    # 再次检查文本内容是否包含乱码
                                    if '�' in text_content or '\ufffd' in text_content:
                                        print("提取的文本内容仍包含乱码，尝试修复...")
                                        # 尝试不同的编码方式
                                        for encoding in ['utf-8', 'gbk', 'gb2312', 'big5', 'utf-16', 'latin1']:
                                            try:
                                                temp_bytes = text_content.encode('utf-8', errors='ignore')
                                                decoded = temp_bytes.decode(encoding, errors='ignore')
                                                if '�' not in decoded and '\ufffd' not in decoded:
                                                    text_content = decoded
                                                    print(f"使用 {encoding} 编码修复文本乱码成功")
                                                    break
                                            except Exception as e:
                                                print(f"使用 {encoding} 编码修复文本乱码失败: {e}")

                                    result["html"] = text_content[:MAX_HTML_SIZE]
                                except Exception as e:
                                    print(f"解析HTML失败: {e}")
                                    # 如果解析失败，保存过滤后的HTML
                                    result["html"] = html_content[:MAX_HTML_SIZE]

                            if not result.get("content"):
                                text_content = extract_text_from_html(html_content)
                                if text_content:
                                    result["content"] = text_content[:MAX_TEXT_SIZE]

                            return result
                    except Exception as e2:
                        print(f"提取JSON部分失败: {e2}")

        # 如果上述处理都失败，构建一个包含原始内容的结果
        print(f"无法解析为JSON，使用原始内容...")

        # 提取文本内容
        text_content = extract_text_from_html(html_content) if html_content else ""

        # 构建结果
        result = {
            "title": "",  # 尝试从HTML中提取标题
            "content": text_content[:MAX_TEXT_SIZE] if text_content else "",
            "metadata": {
                "url": url,
                "query": prompt,
                "timestamp": datetime.now().isoformat()
            }
        }

        # 处理HTML内容，避免保存原始HTML
        if html_content:
            try:
                # 确保HTML内容是UTF-8编码的字符串
                if isinstance(html_content, bytes):
                    try:
                        html_content = html_content.decode('utf-8')
                    except UnicodeDecodeError:
                        try:
                            html_content = html_content.decode('gbk')
                        except UnicodeDecodeError:
                            try:
                                html_content = html_content.decode('gb2312')
                            except UnicodeDecodeError:
                                html_content = html_content.decode('utf-8', errors='ignore')

                # 过滤掉不可打印字符和控制字符
                html_content = ''.join(c for c in html_content if c.isprintable() or c in ['\n', '\t', ' '])

                # 只保存HTML的文本内容，不保存原始HTML
                soup = BeautifulSoup(html_content, 'html.parser')
                text_content = soup.get_text(separator='\n', strip=True)
                result["html"] = text_content[:MAX_HTML_SIZE]
            except:
                # 如果解析失败，不保存HTML内容
                result["html"] = "无法解析HTML内容"

        # 尝试从HTML中提取标题
        if html_content:
            try:
                soup = BeautifulSoup(html_content, 'html.parser')
                if soup.title:
                    result["title"] = soup.title.string
            except:
                pass

        # 已删除实体提取代码

        return result

    except Exception as e:
        # 捕获所有异常，确保始终返回有效结果
        print(f"处理爬取结果时出错: {e}")
        print(traceback.format_exc())

        # 返回精简的错误结构
        return {
            "error": f"处理爬取结果时出错: {e}",
            "metadata": {
                "url": url,
                "query": prompt,
                "timestamp": datetime.now().isoformat()
            }
        }

def scrape_websites_parallel(urls, prompt, model="deepseek-r1:7b", max_workers=3, timeout=TOTAL_TIMEOUT):
    """顺序爬取多个网站（已删除并行处理）"""
    print("注意：已禁用并行爬取功能，改为顺序爬取")
    results = []
    successful = 0
    failed = 0

    # 顺序处理每个URL
    for i, url in enumerate(urls):
        print(f"\n[{i+1}/{len(urls)}] 开始爬取网页: {url}")

        try:
            # 设置单个爬取操作的超时
            start_time = time.time()
            result = scrape_single_website(url, prompt, model)

            # 检查是否超时
            if time.time() - start_time > timeout:
                print(f"爬取超时（{timeout}秒）")
                failed += 1
                results.append({
                    "error": f"爬取超时（{timeout}秒）",
                    "metadata": {
                        "url": url,
                        "query": prompt,
                        "timestamp": datetime.now().isoformat()
                    }
                })
                continue

            results.append(result)
            successful += 1
            print(f"成功爬取网页: {url}")
        except Exception as e:
            failed += 1
            print(f"爬取网页失败: {url}, 错误: {e}")
            results.append({
                "error": f"爬取失败: {str(e)}",
                "metadata": {
                    "url": url,
                    "query": prompt,
                    "timestamp": datetime.now().isoformat()
                }
            })

        # 添加延时，避免请求过快
        if i < len(urls) - 1:
            delay = 2  # 2秒延时
            print(f"等待 {delay} 秒后爬取下一个网页...")
            time.sleep(delay)

    print(f"爬取完成，成功: {successful}, 失败: {failed}")

    # 合并结果
    combined_result = {
        "results": results,
        "metadata": {
            "total": len(urls),
            "successful": successful,
            "failed": failed,
            "query": prompt
        }
    }

    return json.dumps(combined_result, ensure_ascii=False)

def scrape_website(url, prompt, model="deepseek-r1:7b"):
    """Scrape website and analyze content using Ollama (compatible with old interface)"""
    # 单个URL直接调用单个爬取函数
    result = scrape_single_website(url, prompt, model)

    # 确保结果是有效的UTF-8编码
    try:
        # 将结果转换为JSON字符串
        json_str = json.dumps(result, ensure_ascii=False)

        # 检查是否包含非ASCII字符
        has_non_ascii = any(ord(c) > 127 for c in json_str)
        if has_non_ascii:
            print("警告：JSON字符串包含非ASCII字符")

        return json_str
    except Exception as e:
        print(f"转换结果为JSON字符串时出错: {e}")
        # 如果转换失败，返回简化的JSON
        return json.dumps({
            "error": "转换结果为JSON字符串时出错",
            "details": str(e),
            "url": url,
        }, ensure_ascii=False)

def main_with_timeout(timeout=TOTAL_TIMEOUT):
    """Main function with timeout control"""
    # 创建一个事件，用于通知线程结束
    stop_event = threading.Event()
    result = {"output": None, "error": None}

    def _main():
        try:
            # 解析命令行参数
            parser = argparse.ArgumentParser(description="Use requests to call Ollama API directly to scrape websites")
            parser.add_argument("--url", required=True, help="要爬取的网站 URL")
            parser.add_argument("--prompt", default="", help="查询关键词")
            parser.add_argument("--model", default="deepseek-r1:7b", help="要使用的 Ollama 模型名称")
            args = parser.parse_args()

            # 打印参数信息
            print(f"爬取 URL: {args.url}")
            print(f"查询关键词: {args.prompt}")

            # 优先使用 ScrapegraphAI
            if SCRAPEGRAPHAI_AVAILABLE:
                print("\n使用 ScrapegraphAI 和 GPT-4o 模型进行爬取")
            else:
                print("\n警告: ScrapegraphAI 不可用，尝试使用 Ollama")
                # 检查 Ollama 服务
                service_ok, available_models = check_ollama_service()
                if not service_ok:
                    # 如果服务不可用，返回错误信息
                    error_result = json.dumps({
                        "error": "Ollama 服务不可用，ScrapegraphAI 也不可用",
                        "details": "请确保 Ollama 服务正在运行或安装 ScrapegraphAI",
                    }, ensure_ascii=False)
                    result["output"] = error_result
                    return

                # 检查指定的模型是否可用
                if args.model not in available_models:
                    print(f"\n警告: 指定的模型 '{args.model}' 不在可用模型列表中!")
                    print(f"请选择以下可用模型之一: {', '.join(available_models)}")

                    # 尝试使用可用的模型
                    if available_models:
                        print(f"自动选择第一个可用模型: {available_models[0]}")
                        args.model = available_models[0]
                    else:
                        # 如果没有可用模型，返回错误信息
                        error_result = json.dumps({
                            "error": "没有可用的 Ollama 模型，ScrapegraphAI 也不可用",
                            "details": "请安装至少一个模型或安装 ScrapegraphAI",
                        }, ensure_ascii=False)
                        result["output"] = error_result
                        return

            # 爬取网站
            print(f"\n开始爬取网站: {args.url}")
            print(f"使用提示: \"{args.prompt}\"")
            print(f"使用模型: {args.model}")

            # 获取爬取结果
            scrape_result = scrape_website(args.url, args.prompt, args.model)

            # 确保结果是JSON字符串
            try:
                # 尝试解析为JSON对象，验证格式
                _ = json.loads(scrape_result)
                # 如果成功，直接使用结果
                result["output"] = scrape_result
            except:
                # 如果不是有效的JSON，包装为JSON
                final_result = json.dumps({
                    "error": "结果不是有效的JSON",
                    "raw_result": str(scrape_result),
                    "timestamp": datetime.now().isoformat()
                }, ensure_ascii=False)
                result["output"] = final_result

        except Exception as e:
            # 捕获所有未处理的异常
            error_result = json.dumps({
                "error": "脚本执行出错",
                "details": str(e),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }, ensure_ascii=False)
            result["output"] = error_result

    # 创建并启动线程
    main_thread = threading.Thread(target=_main)
    main_thread.daemon = True  # 设置为守护线程，主线程结束时自动结束
    main_thread.start()

    # 等待线程完成或超时
    main_thread.join(timeout)

    # 如果线程仍在运行，发送停止信号并返回超时错误
    if main_thread.is_alive():
        stop_event.set()  # 发送停止信号
        timeout_error = json.dumps({
            "error": "脚本执行超时",
            "details": f"执行时间超过 {timeout} 秒",
            "timestamp": datetime.now().isoformat()
        }, ensure_ascii=False)
        print(timeout_error)
        return

    # 打印结果
    if result["output"]:
        print(result["output"])
    else:
        error_result = json.dumps({
            "error": "未知错误",
            "details": "脚本执行完成但没有输出",
            "timestamp": datetime.now().isoformat()
        }, ensure_ascii=False)
        print(error_result)

def main():
    """Main function"""
    # 设置标准输出编码为UTF-8
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    # 使用带超时控制的主函数
    main_with_timeout()

# 添加信号处理，确保脚本可以被正常终止
def signal_handler(sig, frame=None):
    print(json.dumps({
        "error": "脚本被中断",
        "details": f"收到信号 {sig}",
        "timestamp": datetime.now().isoformat()
    }, ensure_ascii=False))
    sys.exit(0)

# 注册信号处理器
try:
    import signal
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
except ImportError:
    pass  # 在不支持信号的平台上忽略

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # 捕获所有未处理的异常
        error_result = json.dumps({
            "error": "脚本执行出错",
            "details": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat()
        }, ensure_ascii=False)
        print(error_result)  # 打印JSON结果，供Node.js解析
