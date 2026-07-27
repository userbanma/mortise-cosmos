#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
榫合万象 - 服务器配置
定义端口号、项目目录等全局配置项
"""

import os

# 服务器端口号
PORT = 8088

# 绑定地址（"" 表示绑定所有网络接口，本机和局域网均可访问）
HOST = ""

# 项目根目录（config.py 所在目录）
DIRECTORY = os.path.dirname(os.path.abspath(__file__))