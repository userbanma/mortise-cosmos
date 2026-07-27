#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
榫合万象 - 自定义 HTTP 请求处理器
支持 MediaPipe WASM 文件的跨域加载
"""

import http.server


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