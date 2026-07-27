#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
榫合万象 - 本地启动服务器
用 Python 内置 http.server 启动项目，解决 MediaPipe WASM 文件加载问题
使用 config.py 管理配置，handler.py 管理请求处理逻辑
"""

import socketserver
import webbrowser
import os
import sys
from config import HOST, PORT, DIRECTORY
from handler import CustomHandler


def start_server():
    """启动本地服务器并自动打开浏览器"""
    os.chdir(DIRECTORY)

    with socketserver.TCPServer((HOST, PORT), CustomHandler) as httpd:
        url = f"http://localhost:{PORT}/"
        print("=" * 50)
        print("  榫合万象 - 平面古建营造交互作品")
        print("=" * 50)
        print(f"\n  项目路径: {DIRECTORY}")
        print(f"  访问地址: {url}")
        print("\n  启动中...")

        # 自动打开浏览器
        webbrowser.open(url)

        print(f"\n  服务器已启动，按 Ctrl+C 停止\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  服务器已停止")
            sys.exit(0)


if __name__ == "__main__":
    start_server()