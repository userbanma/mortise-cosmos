#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
榫合万象 - 本地启动服务器
用 Python 内置 http.server 启动项目，解决 MediaPipe WASM 文件加载问题
作者: [你的名字]
课程: AI应用素养
"""

import http.server
import socketserver
import webbrowser
import os
import sys

# 配置
PORT = 8081
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    """自定义请求处理器，支持跨域加载 WASM 文件"""

    def end_headers(self):
        # 允许跨域加载 WASM（MediaPipe 需要）
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()

    def guess_type(self, path):
        # 确保 .wasm 文件使用正确的 MIME 类型
        if path.endswith(".wasm"):
            return "application/wasm"
        return super().guess_type(path)

    def log_message(self, format, *args):
        # 简化日志输出
        print(f"  [{self.log_date_time_string()}] {args[0]}")


def start_server():
    """启动本地服务器并自动打开浏览器"""
    os.chdir(DIRECTORY)

    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
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
