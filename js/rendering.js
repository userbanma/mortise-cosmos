// ========== 渲染循环 ==========
function renderLoop() {
  const ctx = App.ctx;
  ctx.clearRect(0, 0, App.width, App.height);

  // 更新嵌合动画
  updateAnimations();

  // 绘制背景纹理（淡淡的网格）
  drawGrid(ctx);

  // 绘制构件（已匹配组：先画榫再画卯，让卯遮挡榫头形成嵌合感）
  // 未匹配构件正常绘制
  const drawn = new Set();
  for (const groupId in App.groups) {
    const memberIds = App.groups[groupId];
    // 按类型排序：tenon先画（底层），mortise后画（顶层），structure最后
    const sorted = [...memberIds].sort((a, b) => {
      const ca = App.components.find(c => c.id === a);
      const cb = App.components.find(c => c.id === b);
      const order = { tenon: 0, mortise: 1, structure: 2, bracket: 2, eave: 3 };
      return (order[ca?.type] || 0) - (order[cb?.type] || 0);
    });
    for (const id of sorted) {
      const comp = App.components.find(c => c.id === id);
      if (comp && !comp.hidden) { drawComponent(ctx, comp); drawn.add(id); }
    }
  }
  // 画未匹配的构件
  for (const comp of App.components) {
    if (!drawn.has(comp.id) && !comp.hidden) {
      drawComponent(ctx, comp);
    }
  }

  // 绘制组连接线（让组合体视觉上更统一）
  drawGroupConnections(ctx);

  // 绘制手势/鼠标光标
  if (!App.useMouse && App.hand.visible) {
    drawCursor(ctx, App.hand.x, App.hand.y, App.hand.pinching);
  } else if (App.useMouse) {
    drawCursor(ctx, App.mouse.x, App.mouse.y, App.mouse.down);
  }

  // 绘制回收区域（阶段二，引导模式下隐藏）
  if (App.currentStage === 2 && !App.buildGuide) drawRecycleArea(ctx);

  // 绘制搭建引导目标位置
  if (App.buildGuide && App.buildGuideTargets.length > 0) drawBuildGuideTargets(ctx);

  // 绘制彩画托盘（在最上层）
  drawPaintPalette(ctx);

  // 最后再绘制一遍花纹，确保不被引导框的半透明填充覆盖
  drawAllPatternOverlays(ctx);

  requestAnimationFrame(renderLoop);
}
function getButtonAt(x, y) {
  // 检测坐标是否在页面按钮上
  const buttons = document.querySelectorAll('button, .btn, .start-btn');
  for (const btn of buttons) {
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return btn;
    }
  }
  return null;
}
function drawGrid(ctx) {
  ctx.strokeStyle = 'rgba(196, 165, 116, 0.08)';
  ctx.lineWidth = 1;
  const step = 60;
  for (let x = 0; x < App.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, App.height);
    ctx.stroke();
  }
  for (let y = 0; y < App.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(App.width, y);
    ctx.stroke();
  }
}

function drawRecycleArea(ctx) {
  // 左下角回收区域
  const rx = 60;
  const ry = App.height - 100;
  const rw = 80;
  const rh = 80;

  ctx.save();
  ctx.fillStyle = 'rgba(60, 45, 30, 0.6)';
  roundRect(ctx, rx, ry, rw, rh, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(196, 165, 116, 0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, rx, ry, rw, rh, 8);
  ctx.stroke();

  // 回收图标（简单的叉号）
  ctx.strokeStyle = 'rgba(196, 165, 116, 0.7)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const s = 16;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s);
  ctx.lineTo(cx + s, cy + s);
  ctx.moveTo(cx + s, cy - s);
  ctx.lineTo(cx - s, cy + s);
  ctx.stroke();

  // 文字
  ctx.fillStyle = 'rgba(196, 165, 116, 0.7)';
  ctx.font = '11px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('拖入移除', cx, ry + rh - 10);

  ctx.restore();
}
function drawBuildGuideTargets(ctx) {
  const targets = App.buildGuideTargets;
  const now = Date.now() / 1000;
  const pulse = 0.5 + 0.5 * Math.sin(now * 3); // 脉冲动画

  ctx.save();
  for (const t of targets) {
    // 虚线外框
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -now * 40;
    ctx.strokeStyle = `rgba(232, 201, 122, ${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2.5;
    roundRect(ctx, t.x, t.y, t.w, t.h, 6);
    ctx.stroke();

    // 半透明填充
    ctx.fillStyle = `rgba(232, 201, 122, ${0.08 + pulse * 0.06})`;
    roundRect(ctx, t.x, t.y, t.w, t.h, 6);
    ctx.fill();

    // 图标
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(232, 201, 122, 0.8)';
    ctx.font = 'bold 22px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.icon || '✦', t.x + t.w / 2, t.y + t.h / 2 - 10);

    // 标签
    ctx.fillStyle = 'rgba(232, 201, 122, 0.85)';
    ctx.font = '12px "Noto Serif SC", serif';
    ctx.fillText(t.label, t.x + t.w / 2, t.y + t.h / 2 + 16);

    // 指示箭头（从构件位置指向目标）
    if (t.fromX !== undefined && t.fromY !== undefined) {
      const midX = (t.fromX + t.x + t.w / 2) / 2;
      const midY = (t.fromY + t.y + t.h / 2) / 2;
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = `rgba(232, 201, 122, ${0.3 + pulse * 0.2})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(t.fromX, t.fromY);
      ctx.quadraticCurveTo(midX, midY - 30, t.x + t.w / 2, t.y + t.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function isInRecycleArea(x, y) {
  const rx = 60;
  const ry = App.height - 100;
  const rw = 80;
  const rh = 80;
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}
function drawPaintPalette(ctx) {
  // 绘制左侧彩画托盘（始终显示所有颜料）
  const allPaints = App.paintPalette;
  if (allPaints.length === 0) return;

  const maxY = Math.max(...allPaints.map(p => p.y + p.h));
  const minY = Math.min(...allPaints.map(p => p.y));
  const trayTop = minY - 56;
  const trayHeight = maxY - trayTop + 16;

  ctx.save();

  // 托盘背景（左边界与任务栏对齐：20px - 8px padding = 12px）
  ctx.fillStyle = 'rgba(30, 22, 16, 0.75)';
  roundRect(ctx, 52, trayTop, 104, trayHeight, 8);
  ctx.fill();

  // 操作说明（顶部小字）
  ctx.fillStyle = '#8c7e6d';
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('食指拇指捏合', 104, trayTop + 18);
  ctx.fillText('拖动完成染色', 104, trayTop + 34);

  // 托盘标题
  ctx.fillStyle = '#c4a574';
  ctx.font = 'bold 14px "Noto Serif SC", serif';
  ctx.fillText('彩画颜料', 104, minY - 8);

  ctx.restore();

  // 绘制每个颜料
  for (const paint of allPaints) {
    if (App.draggingPaint && App.draggingPaint.id === paint.id) continue;

    ctx.save();

    if (paint.unlocked) {
      // 已解锁：彩色显示，可拖拽
      ctx.fillStyle = paint.displayColor;
      roundRect(ctx, paint.x, paint.y, paint.w, paint.h, 6);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, paint.x, paint.y, paint.w, paint.h, 6);
      ctx.stroke();

      ctx.fillStyle = '#2b2118';
      ctx.font = 'bold 13px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(paint.name, paint.x + paint.w / 2, paint.y + paint.h / 2);

      // 解锁标记点
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(paint.x + paint.w - 12, paint.y + paint.h - 12, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 未解锁：灰色暗色显示 + 锁头效果
      ctx.fillStyle = 'rgba(60, 50, 40, 0.6)';
      roundRect(ctx, paint.x, paint.y, paint.w, paint.h, 6);
      ctx.fill();

      ctx.strokeStyle = 'rgba(100, 85, 70, 0.5)';
      ctx.lineWidth = 1;
      roundRect(ctx, paint.x, paint.y, paint.w, paint.h, 6);
      ctx.stroke();

      // 名称
      ctx.fillStyle = '#d4c9b8';
      ctx.font = '13px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(paint.name, paint.x + paint.w / 2, paint.y + paint.h / 2 - 7);

      // 解锁条件
      ctx.fillStyle = '#8c7e6d';
      ctx.font = '11px "Noto Serif SC", serif';
      ctx.fillText('营造值' + paint.unlockScore, paint.x + paint.w / 2, paint.y + paint.h / 2 + 12);

      // 锁图标
      ctx.fillStyle = '#8c7e6d';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('锁', paint.x + paint.w - 6, paint.y + 6);
    }

    ctx.restore();
  }

  // 绘制正在拖动的颜料（跟随光标）
  if (App.draggingPaint) {
    const dp = App.draggingPaint;
    const mx = App.useMouse ? App.mouse.x : App.hand.x;
    const my = App.useMouse ? App.mouse.y : App.hand.y;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = dp.displayColor;
    roundRect(ctx, mx - dp.w / 2, my - dp.h / 2, dp.w, dp.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    roundRect(ctx, mx - dp.w / 2, my - dp.h / 2, dp.w, dp.h, 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(43, 33, 24, 0.9)';
    ctx.font = 'bold 13px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dp.name, mx, my);
    ctx.restore();
  }

  // 颜料悬停注释（捏合/悬停时显示）
  drawPaintTooltip(ctx);
}
function drawPaintTooltip(ctx) {
  // 检测光标是否悬停在颜料上（已解锁/未解锁都显示）
  const mx = App.useMouse ? App.mouse.x : App.hand.x;
  const my = App.useMouse ? App.mouse.y : App.hand.y;

  for (const paint of App.paintPalette) {
    if (App.draggingPaint && App.draggingPaint.id === paint.id) continue;

    if (
      mx >= paint.x && mx <= paint.x + paint.w &&
      my >= paint.y && my <= paint.y + paint.h
    ) {
      ctx.save();
      const text = paint.unlocked
        ? paint.description
        : '营造值达到 ' + paint.unlockScore + ' 后解锁。' + paint.description;
      ctx.font = '14px "Noto Serif SC", serif';
      const maxWidth = 200;
      const words = text.split('');
      let line = '';
      const lines = [];
      for (const ch of words) {
        const testLine = line + ch;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line.length > 0) {
          lines.push(line);
          line = ch;
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      const lineHeight = 18;
      const boxW = maxWidth + 16;
      const boxH = lines.length * lineHeight + 16;
      const boxX = paint.x + paint.w + 8;
      const boxY = paint.y;

      // 气泡背景
      ctx.fillStyle = 'rgba(43, 33, 24, 0.95)';
      roundRect(ctx, boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.strokeStyle = '#5c4033';
      ctx.lineWidth = 1;
      roundRect(ctx, boxX, boxY, boxW, boxH, 6);
      ctx.stroke();

      // 文字
      ctx.fillStyle = '#d4c9b8';
      ctx.font = '14px "Noto Serif SC", serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], boxX + 10, boxY + 10 + i * lineHeight);
      }

      ctx.restore();
      break;
    }
  }
}
// 绘制构件组之间的连接线（模拟木构节点的整体性）
function drawGroupConnections(ctx) {
  for (const groupId in App.groups) {
    const memberIds = App.groups[groupId];
    if (memberIds.length < 2) continue;
    
    const members = memberIds.map(id => App.components.find(c => c.id === id)).filter(Boolean);
    if (members.length < 2) continue;
    
    // 画一条穿过组内所有构件中心的虚线
    ctx.save();
    ctx.strokeStyle = 'rgba(196, 165, 116, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let i = 0; i < members.length; i++) {
      if (i === 0) ctx.moveTo(members[i].x, members[i].y);
      else ctx.lineTo(members[i].x, members[i].y);
    }
    ctx.stroke();
    ctx.restore();
    
    // 在组中心画一个淡淡的金色光晕（表示节点稳固）
    const centerX = members.reduce((s, m) => s + m.x, 0) / members.length;
    const centerY = members.reduce((s, m) => s + m.y, 0) / members.length;
    ctx.save();
    ctx.fillStyle = 'rgba(196, 165, 116, 0.1)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
function drawNoteBubble(ctx, comp, halfW, halfH) {
  const padding = 10;
  const lineHeight = 18;
  const maxLineWidth = 220;

  // 准备文字内容
  const lines = [];
  lines.push({ text: comp.briefNote, size: 13, weight: 'bold', color: '#e8dcc8' });
  if (comp.origin) {
    const originLines = wrapText(ctx, comp.origin, maxLineWidth);
    for (const line of originLines) {
      lines.push({ text: line, size: 11, weight: 'normal', color: '#b0a08a' });
    }
  }

  // 计算气泡尺寸
  ctx.font = `bold 13px "Noto Serif SC", "PingFang SC", serif`;
  const briefW = ctx.measureText(comp.briefNote).width;
  let boxW = Math.max(briefW + padding * 2, maxLineWidth + padding * 2);
  const boxH = lines.length * lineHeight + padding * 2 - 4;

  // 气泡位置：构件上方居中
  const boxX = -boxW / 2;
  const boxY = -halfH - boxH - 14;

  // 绘制气泡背景（带毛玻璃效果）
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
  roundRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.fill();

  // 气泡边框（金色细线）
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 1;
  roundRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.stroke();

  // 小三角箭头
  ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
  ctx.beginPath();
  ctx.moveTo(-6, boxY + boxH);
  ctx.lineTo(6, boxY + boxH);
  ctx.lineTo(0, boxY + boxH + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8b7355';
  ctx.beginPath();
  ctx.moveTo(-6, boxY + boxH);
  ctx.lineTo(0, boxY + boxH + 6);
  ctx.lineTo(6, boxY + boxH);
  ctx.stroke();

  // 绘制文字
  let textY = boxY + padding + 12;
  for (const line of lines) {
    ctx.font = `${line.weight} ${line.size}px "Noto Serif SC", "PingFang SC", serif`;
    ctx.fillStyle = line.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(line.text, boxX + padding, textY);
    textY += lineHeight;
  }

  // 顶部装饰小横线
  ctx.strokeStyle = '#c4a574';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(boxX + padding, boxY + 6);
  ctx.lineTo(boxX + padding + 24, boxY + 6);
  ctx.stroke();

  ctx.restore();
}
function drawCursor(ctx, x, y, pinching) {
  ctx.save();
  ctx.strokeStyle = pinching ? '#e8c97a' : '#c4a574';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, pinching ? 8 : 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = pinching ? 'rgba(232, 201, 122, 0.4)' : 'rgba(196, 165, 116, 0.2)';
  ctx.fill();
  ctx.restore();
}

function updateHandCursor(x, y, pinching) {
  const cursor = document.getElementById('hand-cursor');
  cursor.style.display = 'block';
  cursor.style.left = x + 'px';
  cursor.style.top = y + 'px';
  cursor.classList.toggle('pinching', pinching);
}

// 在所有上层UI之后，单独绘制花纹覆盖层，确保不被引导框等半透明层遮盖
// 按渲染顺序绘制：tenon → mortise → structure/bracket → eave，屋檐花纹在最上层
function drawAllPatternOverlays(ctx) {
  const order = { tenon: 0, mortise: 1, structure: 2, bracket: 2, eave: 3 };
  const painted = App.components.filter(c => c.matched && c.painted && !c.hidden);
  painted.sort((a, b) => (order[a.type] || 0) - (order[b.type] || 0));
  for (const comp of painted) {
    ctx.save();
    ctx.translate(comp.x, comp.y);
    ctx.rotate((comp.rotation * Math.PI) / 180);
    drawPatternOverlay(ctx, comp, comp.width / 2, comp.height / 2);
    ctx.restore();
  }
}
