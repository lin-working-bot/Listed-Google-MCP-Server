# 使用官方 Node.js LTS 版本镜像
FROM node:20

# 安装 Python 和必要的依赖
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && ln -sf /usr/bin/pip3 /usr/bin/pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 验证 Python 安装
RUN python --version
RUN pip --version

# 设置工作目录
WORKDIR /app

# 复制依赖定义文件
COPY package.json package-lock.json* ./

# 安装依赖（生产依赖+开发依赖）
RUN npm install

# 全局安装 Next.js
RUN npm install -g next@15.3.0

# 验证全局安装的 Next.js
RUN which next
RUN next --version || echo "Next.js command not found"

# 验证本地安装的 Next.js
RUN ls -la node_modules/.bin/
RUN ls -la node_modules/next/
RUN node_modules/.bin/next --version || echo "Local Next.js command not found"

# 复制项目文件
COPY . .

# 安装 Python 依赖（如果有 requirements.txt 文件）
RUN if [ -f requirements.txt ]; then pip install --break-system-packages -r requirements.txt; fi

# 暴露 Next.js 默认端口
EXPOSE 3000

# 创建启动脚本，添加更多调试信息
RUN echo '#!/bin/bash\n\
echo "Starting Next.js app..."\n\
echo "PATH=$PATH"\n\
echo "Current directory: $(pwd)"\n\
echo "Files in current directory:"\n\
ls -la\n\
echo "Checking for next command:"\n\
which next || echo "next command not found"\n\
echo "Checking for python command:"\n\
which python || echo "python command not found"\n\
python --version || echo "python version not available"\n\
echo "Environment variables:"\n\
echo "NODE_ENV: $NODE_ENV"\n\
echo "GOOGLE_API_KEY length: ${#GOOGLE_API_KEY}"\n\
echo "SEARCH_ENGINE_ID: $SEARCH_ENGINE_ID"\n\
echo "Running next dev..."\n\
cd /app && next dev\n\
' > /usr/local/bin/start-nextjs && \
    chmod +x /usr/local/bin/start-nextjs

# 启动开发模式（热重载）
CMD ["/usr/local/bin/start-nextjs"]
