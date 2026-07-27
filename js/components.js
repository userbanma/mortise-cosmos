
// ========== 构件初始化 ==========
function initComponents() {
  const cx = App.width / 2;
  const cy = App.height / 2;

  App.components = [
    {
      id: 'zhitui_01', name: '直榫', type: 'tenon',
      category: '柱枋节点',
      x: cx - 160, y: cy,
      width: 96, height: 40,
      rotation: 0,
      matched: false,
      unlocks: ['hexi_01'],
      description: '直榫是最基础的榫卯形式，榫头呈长方体，垂直插入卯眼，主要用于柱与枋的垂直连接。受力方向以压力为主。',
      briefNote: '始于商周，最古之榫。直来直往，承托千秋。',
      origin: '直榫见于商代青铜器的木范结构，是华夏榫卯之滥觞。《营造法式》称其为"直项"，为万榫之母。',
      rules: {
        mateWith: ['maoyan_01'],
        tolerance: 80,
        angleTolerance: 15
      },
      color: '#8b7355',
      groupId: null
    },
    {
      id: 'maoyan_01', name: '卯眼', type: 'mortise',
      category: '柱枋节点',
      x: cx + 160, y: cy,
      width: 96, height: 40,
      rotation: 0,
      matched: false,
      unlocks: ['hexi_01'],
      description: '卯眼是榫头的承接部位，凿于构件端部或侧面，与榫头配合形成稳固节点。',
      briefNote: '藏榫之所，纳木之怀。有容乃大，不露锋芒。',
      origin: '卯字本义为"冒"，取覆盖之意。《考工记》载匠人凿卯"深不过榫之半"，暗合中庸之道。',
      rules: {
        mateWith: ['zhitui_01'],
        tolerance: 80,
        angleTolerance: 15
      },
      color: '#6b5a45',
      groupId: null
    },
    {
      id: 'yanwei_01', name: '燕尾榫', type: 'tenon',
      category: '梁柱节点',
      x: cx - 160, y: cy + 95,
      width: 112, height: 44,
      rotation: 0,
      matched: false,
      unlocks: ['xuanzi_01'],
      description: '燕尾榫因形似燕尾而得名，榫头根部窄、端部宽，受拉力时越拉越紧，常用于梁柱水平连接。斜面比例通常为1:6。',
      briefNote: '形如燕尾，入木三分。愈拉愈紧，牢不可破。',
      origin: '燕尾榫古称"银锭榫"，兴于唐宋。《鲁班经》称其"拉不断、扯不开"，为抗拉节点之王。',
      rules: {
        mateWith: ['yanwei_mao_01'],
        tolerance: 90,
        angleTolerance: 15
      },
      color: '#9c7e5e',
      groupId: null
    },
    {
      id: 'yanwei_mao_01', name: '燕尾卯', type: 'mortise',
      category: '梁柱节点',
      x: cx + 160, y: cy + 95,
      width: 112, height: 44,
      rotation: 0,
      matched: false,
      unlocks: ['xuanzi_01'],
      description: '燕尾卯与燕尾榫配套使用，开口呈梯形，内宽外窄，防止构件脱开。',
      briefNote: '口阔腹窄，请君入瓮。一入其中，无复他适。',
      origin: '燕尾卯需逆燕尾之形而凿，匠人谓之"倒插门"。明代建筑中多用于檩条与梁架的连接。',
      rules: {
        mateWith: ['yanwei_01'],
        tolerance: 90,
        angleTolerance: 15
      },
      color: '#7a6548',
      groupId: null
    },
    {
      id: 'zhu_01', name: '柱', type: 'structure',
      category: '主体结构',
      x: cx, y: cy - 120,
      width: 40, height: 100,
      rotation: 0,
      matched: false,
      unlocks: [],
      description: '立柱是建筑的垂直承重构件，上承梁架，下接柱础。传统木柱多为整根原木制成，讲究顺纹直材。',
      briefNote: '木秀于林，风必摧之；柱立于堂，屋必安之。',
      origin: '柱之称谓始于殷墟。《周礼·考工记》列匠人"宫室之制"，柱为首务。历代木构皆以柱分间架，有"墙倒屋不塌"之说，全靠柱阵承力。',
      rules: {
        mateWith: [],
        tolerance: 0,
        angleTolerance: 0
      },
      color: '#a08060',
      groupId: null
    }
  ];
}
// ========== 碰撞检测 ==========
function hitTest(comp, x, y) {
  const halfW = comp.width / 2;
  const halfH = comp.height / 2;
  return x >= comp.x - halfW && x <= comp.x + halfW &&
         y >= comp.y - halfH && y <= comp.y + halfH;
}

// ========== 结构校验 ==========
function getConnectionPoint(comp) {
  if (comp.type === 'tenon') {
    const isDovetail = comp.id.includes('yanwei') || comp.id.includes('yw_');
    const bodyRight = isDovetail ? comp.width * 0.22 : comp.width * 0.25;
    const tLen = isDovetail ? comp.width * 0.24 : comp.width * 0.22;
    return { x: comp.x + bodyRight + tLen, y: comp.y };
  } else if (comp.type === 'mortise') {
    return { x: comp.x - comp.width / 2, y: comp.y };
  }
  return { x: comp.x, y: comp.y };
}

function checkMatchOnRelease(comp) {
  // 柱的特殊逻辑：可以吸附到已匹配的组合体上
  if (comp.type === 'structure') {
    checkColumnAttach(comp);
    return false;
  }

  // 雀替的特殊逻辑：可以吸附到柱子顶端
  if (comp.type === 'bracket') {
    return checkBracketAttach(comp);
  }

  if (!comp.rules || comp.rules.mateWith.length === 0) return false;

  for (const other of App.components) {
    if (other === comp) continue;
    if (!comp.rules.mateWith.includes(other.id)) continue;
    if (other.matched) continue;

    // 用连接点距离判断（榫头右端 vs 凹槽左端），更精确
    const p1 = getConnectionPoint(comp);
    const p2 = getConnectionPoint(other);
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angleDiff = Math.abs(comp.rotation - other.rotation);

    if (distance <= comp.rules.tolerance && angleDiff <= comp.rules.angleTolerance) {
      // 匹配成功！
      snapTogether(comp, other);
      onMatchSuccess(comp, other);
      return true;
    }
  }

  // 匹配失败，记录错误
  const pairKey = comp.id + '_' + comp.rules.mateWith[0];
  App.errorCount[pairKey] = (App.errorCount[pairKey] || 0) + 1;

  if (App.errorCount[pairKey] >= 3) {
    showHint(`【错误示范】${comp.name} 应与对应的卯眼/榫头对齐，注意方向和距离。查看营造图鉴了解更多。`, 4000);
  } else {
    showHint(`${comp.name} 未对齐，请靠近对应的构件并调整方向`, 2500);
  }
  return false;
}
function checkColumnAttach(column) {
  let bestGroup = null;
  let bestDist = Infinity;
  let bestCenter = null;

  // 寻找最近的已匹配组合体
  for (const groupId in App.groups) {
    const memberIds = App.groups[groupId];
    const members = memberIds.map(id => App.components.find(c => c.id === id)).filter(Boolean);
    if (members.length === 0) continue;
    
    // 计算组合体中心
    const centerX = members.reduce((s, m) => s + m.x, 0) / members.length;
    const centerY = members.reduce((s, m) => s + m.y, 0) / members.length;
    const dist = Math.hypot(column.x - centerX, column.y - centerY);
    
    if (dist < bestDist && dist <= 80) {
      bestDist = dist;
      bestGroup = groupId;
      bestCenter = { x: centerX, y: centerY };
    }
  }

  if (bestGroup && bestCenter) {
    // 柱吸附到组合体中心下方，形成"柱承梁"结构
    const members = App.groups[bestGroup].map(id => App.components.find(c => c.id === id)).filter(Boolean);
    const maxY = Math.max(...members.map(m => m.y + m.height/2));
    const targetX = bestCenter.x;
    const targetY = maxY + column.height / 2 + 4;
    animateSnap(column, targetX, targetY);
    column.rotation = 0;
    column.matched = true;

    // 把柱加入组
    column.groupId = bestGroup;
    App.groups[bestGroup].push(column.id);

    // 阶段一全部完成
    App.task3Done = true;
    App.phase1Done = true;

    App.score += 1;
    updateScoreDisplay();
    updateGuidePanel();
    showHint(`【立柱】${column.name} 已立于梁下！一柱承梁，万事始兴。`, 4000);
    checkPatternUnlock();

    // 显示自由搭建按钮
    const btn = document.getElementById('btn-phase2');
    if (btn) btn.style.display = 'inline-block';

    setTimeout(() => {
      showHint('【阶段一完成】恭喜！点击底部"自由搭建"开始自由营造。', 6000);
    }, 4500);
  }
}
function checkBracketAttach(bracket) {
  // 雀替吸附到最近的柱子顶端
  let bestColumn = null;
  let bestDist = Infinity;

  for (const comp of App.components) {
    if (comp.type !== 'structure') continue;
    const topY = comp.y - comp.height / 2;
    const topX = comp.x;
    const dist = Math.hypot(bracket.x - topX, bracket.y - topY);
    if (dist < bestDist && dist <= 100) {
      bestDist = dist;
      bestColumn = comp;
    }
  }

  if (!bestColumn) return false;

  const isLeftBracket = bracket.id.includes('_l_');
  const topY = bestColumn.y - bestColumn.height / 2;
  // 左雀替放柱子左侧，右雀替放柱子右侧
  // 嵌入6px让雀替紧贴柱子但不明显重叠
  const offsetX = bestColumn.width / 2 + bracket.width / 2 - 6;
  const targetX = isLeftBracket ? bestColumn.x - offsetX : bestColumn.x + offsetX;
  // 雀替顶部嵌入横梁底部8px
  const targetY = topY + bracket.height / 2 - 8;

  // 检查该柱子该侧是否已有同方向雀替（防止两个左雀替吸附同一根柱子）
  for (const comp of App.components) {
    if (comp === bracket) continue;
    if (comp.type !== 'bracket') continue;
    if (comp.matched && comp.id.includes('_l_') === isLeftBracket) {
      // 同方向雀替，检查是否在目标位置附近
      const expectedX = isLeftBracket ? bestColumn.x - offsetX : bestColumn.x + offsetX;
      const expectedY = targetY;
      if (Math.hypot(comp.x - expectedX, comp.y - expectedY) < 20) {
        showHint('该侧已有雀替，请装到另一根柱子上。', 2000);
        return false;
      }
    }
  }

  // 直接设置位置（不调用动画），确保 triggerPointerUp 后续检测时位置已正确
  bracket.x = targetX;
  bracket.y = targetY;
  bracket.rotation = 0;
  bracket.matched = true;
  // 雀替单独成组，不加入柱子组，避免柱子被连带移动
  bracket.groupId = null;

  const sideLabel = isLeftBracket ? '左侧' : '右侧';
  showHint(`【雀替】${bracket.name} 已装于 ${bestColumn.name}${sideLabel}！`, 2500);
  return true;
}

// ========== 嵌合动画系统 ==========
const Animations = [];

function animateSnap(comp, targetX, targetY) {
  comp.animating = true;
  comp.animStartX = comp.x;
  comp.animStartY = comp.y;
  comp.animTargetX = targetX;
  comp.animTargetY = targetY;
  comp.animStartTime = performance.now();
  comp.animDuration = 400; // 毫秒
  Animations.push(comp);
}

function updateAnimations() {
  const now = performance.now();
  for (let i = Animations.length - 1; i >= 0; i--) {
    const comp = Animations[i];
    const elapsed = now - comp.animStartTime;
    const progress = Math.min(elapsed / comp.animDuration, 1);
    
    // easeOutBack 缓动：先冲过头再弹回，模拟咔嗒感
    const easeOutBack = (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    
    const eased = easeOutBack(progress);
    comp.x = comp.animStartX + (comp.animTargetX - comp.animStartX) * eased;
    comp.y = comp.animStartY + (comp.animTargetY - comp.animStartY) * eased;
    
    if (progress >= 1) {
      comp.animating = false;
      Animations.splice(i, 1);
    }
  }
}

function snapTogether(a, b) {
  const tenon = a.type === 'tenon' ? a : b;
  const mortise = a.type === 'mortise' ? a : b;
  const isDovetail = tenon.id.includes('yanwei') || tenon.id.includes('yw_');

  // ========== 水平一字型嵌合：榫从左向右插入卯 ==========
  // 榫（tenon）：水平横放，榫头在右端
  // 卯（mortise）：水平横放，凹槽在左端
  // 嵌合后：tenon 主体右边缘贴 mortise 左边缘，形成一根完整梁

  const bodyRight = isDovetail ? tenon.width * 0.22 : tenon.width * 0.25;

  // X方向：tenon 主体右边缘与 mortise 左边缘对齐
  // tenon.x + bodyRight = mortise.x - mortise.width/2
  const tenonTargetX = mortise.x - mortise.width / 2 - bodyRight;

  // Y方向：中心对齐
  const tenonTargetY = mortise.y;

  animateSnap(tenon, tenonTargetX, tenonTargetY);
  animateSnap(mortise, mortise.x, mortise.y);

  a.rotation = 0;
  b.rotation = 0;
  a.matched = true;
  b.matched = true;

  const groupId = 'group_' + App.nextGroupId++;
  a.groupId = groupId;
  b.groupId = groupId;
  App.groups[groupId] = [a.id, b.id];
}
function onMatchSuccess(a, b) {
  App.score += 1;
  updateScoreDisplay();
  showHint(`【${a.name} × ${b.name}】拼接正确！${a.briefNote}`, 4000);

  // 阶段一子任务推进
  if (App.currentStage === 1) {
    const pairIds = [a.id, b.id].sort().join('_');
    if (pairIds === 'yanwei_01_yanwei_mao_01') {
      App.task1Done = true;
      App.currentTask = 2;
      updateGuidePanel();
      setTimeout(() => {
        showHint('【任务一完成】燕尾榫卯已嵌合！接下来请拼接直榫与卯眼。', 5000);
      }, 4500);
    } else if (pairIds === 'maoyan_01_zhitui_01') {
      App.task2Done = true;
      App.currentTask = 3;
      updateGuidePanel();
      setTimeout(() => {
        showHint('【任务二完成】直榫卯已嵌合！最后请将立柱放到梁下。', 5000);
      }, 4500);
    }
  }

  // 检查解锁彩画
  checkPatternUnlock();
}
// ========== 构件真实形状绘制 ==========
// 设计理念：参考真实榫卯，一个构件端头有凸出榫头，另一个构件侧面有凹入卯眼
// 嵌合时呈T字型/L字型

function drawTenonShape(ctx, w, h) {
  // 直榫：横木，右端有矩形凸出的榫头
  // 榫头尺寸与卯眼凹槽精确匹配
  const bodyRight = w * 0.25;  // 主体右边缘
  const tLen = w * 0.22;       // 榫头长度（与凹槽深度匹配）
  const tH = h * 0.5;          // 榫头高度（与凹槽高度匹配）
  const r = 3;
  ctx.beginPath();
  ctx.moveTo(-w/2, -h/2);
  ctx.lineTo(bodyRight, -h/2);
  ctx.lineTo(bodyRight, -tH/2 + r);
  ctx.lineTo(bodyRight + r, -tH/2);
  ctx.lineTo(bodyRight + tLen - r, -tH/2);
  ctx.lineTo(bodyRight + tLen, -tH/2 + r);
  ctx.lineTo(bodyRight + tLen, tH/2 - r);
  ctx.lineTo(bodyRight + tLen - r, tH/2);
  ctx.lineTo(bodyRight + r, tH/2);
  ctx.lineTo(bodyRight, tH/2 - r);
  ctx.lineTo(bodyRight, h/2);
  ctx.lineTo(-w/2, h/2);
  ctx.closePath();
}

function drawMortiseShape(ctx, w, h) {
  // 卯眼：横木，中间偏右有一个矩形凹入的卯眼（从上下表面向内凿）
  // 卯眼是一个穿透槽，从上表面和下表面都能看到
  const gW = w * 0.25;     // 卯眼宽度（沿构件长度方向）
  const gH = h * 0.45;     // 卯眼深度（从表面向内）
  const gPosX = w * 0.15;  // 卯眼中心偏右位置
  ctx.beginPath();
  // 整体矩形外轮廓
  ctx.moveTo(-w/2, -h/2);
  ctx.lineTo(w/2, -h/2);
  ctx.lineTo(w/2, h/2);
  ctx.lineTo(-w/2, h/2);
  ctx.closePath();
  // 注意：卯眼是一个"洞"，用颜色区分表示
}

function drawMortiseShapeFilled(ctx, w, h) {
  // 卯眼外轮廓（整体矩形）
  ctx.beginPath();
  ctx.moveTo(-w/2, -h/2);
  ctx.lineTo(w/2, -h/2);
  ctx.lineTo(w/2, h/2);
  ctx.lineTo(-w/2, h/2);
  ctx.closePath();
}

function drawDovetailTenonShape(ctx, w, h) {
  // 燕尾榫：横木，右端有梯形凸出的燕尾榫头
  // 根部（靠近主体）窄，端部（远离主体）宽 — 像喇叭口展开
  const bodyRight = w * 0.22;
  const tLen = w * 0.24;
  const rootH = h * 0.35;  // 根部窄
  const tipH = h * 0.65;   // 端部宽
  const r = 3;
  ctx.beginPath();
  ctx.moveTo(-w/2, -h/2);
  ctx.lineTo(bodyRight, -h/2);
  ctx.lineTo(bodyRight, -rootH/2);
  ctx.lineTo(bodyRight + tLen - r, -tipH/2);
  ctx.quadraticCurveTo(bodyRight + tLen, -tipH/2, bodyRight + tLen, -tipH/2 + r);
  ctx.lineTo(bodyRight + tLen, tipH/2 - r);
  ctx.quadraticCurveTo(bodyRight + tLen, tipH/2, bodyRight + tLen - r, tipH/2);
  ctx.lineTo(bodyRight, rootH/2);
  ctx.lineTo(bodyRight, h/2);
  ctx.lineTo(-w/2, h/2);
  ctx.closePath();
}

function drawDovetailMortiseShape(ctx, w, h) {
  // 燕尾卯：横木，中间偏右有一个梯形凹入的燕尾卯眼
  // 与燕尾榫配套：入口窄（tipH），里面宽（rootH）
  const gW = w * 0.28;
  const entryH = h * 0.22;  // 入口窄
  const innerH = h * 0.75;  // 里面宽
  const gPosX = w * 0.15;
  ctx.beginPath();
  // 整体矩形外轮廓
  ctx.moveTo(-w/2, -h/2);
  ctx.lineTo(w/2, -h/2);
  ctx.lineTo(w/2, h/2);
  ctx.lineTo(-w/2, h/2);
  ctx.closePath();
}

function drawColumnShape(ctx, w, h) {
  // 柱：直柱，两端无突起
  roundRect(ctx, -w / 2, -h / 2, w, h, 3);
}

function drawEaveShape(ctx, w, h) {
  // 屋檐：直接原样绘制素材图片，不做任何变换
  if (!App.wuImg) {
    App.wuImg = new Image();
    App.wuImg.src = 'assets/wu.png';
    roundRect(ctx, -w / 2, -h / 2, w, h, 4);
    return;
  }
  if (!App.wuImg.complete || App.wuImg.naturalWidth === 0) {
    roundRect(ctx, -w / 2, -h / 2, w, h, 4);
    return;
  }

  ctx.drawImage(App.wuImg, -w / 2, -h / 2, w, h);
}

function drawBracketShape(ctx, w, h, direction) {
  // 雀替：直接原样绘制对应方向的素材图片，不做任何旋转或镜像
  const isLeft = direction === -1;
  const imgKey = isLeft ? 'quetiLeftImg' : 'quetiImg';
  const imgSrc = isLeft ? 'assets/queti_left.png' : 'assets/queti.png';

  if (!App[imgKey]) {
    App[imgKey] = new Image();
    App[imgKey].src = imgSrc;
    roundRect(ctx, -w / 2, -h / 2, w, h, 4);
    return;
  }
  if (!App[imgKey].complete || App[imgKey].naturalWidth === 0) {
    roundRect(ctx, -w / 2, -h / 2, w, h, 4);
    return;
  }

  ctx.drawImage(App[imgKey], -w / 2, -h / 2, w, h);
}

function drawBracketCloudPattern(ctx, w, h, direction) {
  // （已废弃：雀替用图片素材绘制，此函数不再调用）
  // 左右雀替使用各自对应方向的素材图片
  ctx.save();
  ctx.strokeStyle = 'rgba(43,33,24,0.5)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 主S形云气（从顶部向底部螺旋内卷）
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.32);
  // 上段：先向右外展
  ctx.bezierCurveTo(
    w * 0.2, -h * 0.32,
    w * 0.25, -h * 0.18,
    w * 0.18, -h * 0.05
  );
  // 中段：向左回收，形成涡旋
  ctx.bezierCurveTo(
    w * 0.1, h * 0.08,
    -w * 0.12, h * 0.12,
    -w * 0.15, h * 0.02
  );
  // 下段：向右下螺旋收束
  ctx.bezierCurveTo(
    -w * 0.18, -h * 0.08,
    -w * 0.05, -h * 0.18,
    w * 0.08, -h * 0.2
  );
  ctx.stroke();

  // 卷云涡旋（中部，核心涡圈）
  ctx.beginPath();
  ctx.arc(w * 0.1, -h * 0.08, w * 0.07, Math.PI * 0.5, Math.PI * 2.2, false);
  ctx.stroke();

  // 卷云涡旋（中下部）
  ctx.beginPath();
  ctx.arc(-w * 0.08, h * 0.06, w * 0.06, -Math.PI * 0.3, Math.PI * 1.5, false);
  ctx.stroke();

  // 底部卷须（向内收束的小卷曲）
  ctx.beginPath();
  ctx.moveTo(-w * 0.06, h * 0.28);
  ctx.bezierCurveTo(
    -w * 0.15, h * 0.32,
    -w * 0.08, h * 0.42,
    0, h * 0.38
  );
  ctx.stroke();

  // 上方小如意头装饰
  ctx.beginPath();
  ctx.moveTo(-w * 0.08, -h * 0.38);
  ctx.bezierCurveTo(
    w * 0.05, -h * 0.42,
    w * 0.12, -h * 0.35,
    w * 0.06, -h * 0.28
  );
  ctx.stroke();

  ctx.restore();
}
// ========== 颜色工具函数 ==========
function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(2.55 * percent));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(2.55 * percent));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(2.55 * percent));
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
  return `rgb(${r},${g},${b})`;
}

function drawComponentBody(ctx, comp) {
  const w = comp.width;
  const h = comp.height;
  const id = comp.id;
  if (id === 'zhitui_01' || id.startsWith('p2_zt_')) { drawTenonShape(ctx, w, h); }
  else if (id === 'maoyan_01' || id.startsWith('p2_my_')) { drawMortiseShape(ctx, w, h); }
  else if (id === 'yanwei_01' || id.startsWith('p2_yw_')) { drawDovetailTenonShape(ctx, w, h); }
  else if (id === 'yanwei_mao_01' || id.startsWith('p2_ym_')) { drawDovetailMortiseShape(ctx, w, h); }
  else if (id === 'zhu_01' || id.startsWith('p2_zhu_')) { drawColumnShape(ctx, w, h); }
  else if (comp.type === 'bracket') {
    const dir = comp.id.includes('_l_') ? -1 : 1;
    drawBracketShape(ctx, w, h, dir);
  }
  else if (comp.type === 'eave') { drawEaveShape(ctx, w, h); }
  else { roundRect(ctx, -w/2, -h/2, w, h, 4); }
}
function drawComponent(ctx, comp) {
  ctx.save();
  ctx.translate(comp.x, comp.y);
  ctx.rotate((comp.rotation * Math.PI) / 180);

  const w = comp.width;
  const h = comp.height;
  const halfW = w / 2;
  const halfH = h / 2;

  // 判断状态
  const isHover = (App.hoverComponent === comp);
  const isDragging = (App.draggingComponent === comp);

  // 阴影
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = isDragging ? 20 : 8;
  ctx.shadowOffsetY = isDragging ? 8 : 4;

  // 主体填充（使用渐变模拟3D立体木材质感）
  const baseColor = comp.matched ? '#c4a574' : comp.color;
  const hoverColor = comp.matched ? '#d4b584' : '#a08060';
  const fillColor = (isHover && !comp.matched) ? hoverColor : baseColor;
  
  const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
  grad.addColorStop(0, lightenColor(fillColor, 15));
  grad.addColorStop(0.3, fillColor);
  grad.addColorStop(1, darkenColor(fillColor, 20));
  ctx.fillStyle = grad;
  
  drawComponentBody(ctx, comp);
  ctx.fill();

  // 边框描边
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = comp.matched ? '#e8c97a' : (isHover ? '#d4a017' : '#4a3728');
  ctx.lineWidth = comp.matched ? 3 : 2;
  if (isHover) ctx.lineWidth = 3;
  drawComponentBody(ctx, comp);
  ctx.stroke();

  // ===== 卯眼的"洞"可视化 =====
  ctx.shadowColor = 'transparent';
  if (comp.id === 'maoyan_01' || comp.id.startsWith('p2_my_')) {
    // 直卯眼：矩形凹槽在 mortise 左端，水平凹入
    // 与直榫头精确匹配：tLen = w*0.22, tH = h*0.5
    const grooveH = h * 0.5;    // 竖直高度 = 榫头高度
    const grooveD = w * 0.22;   // 水平深度 = 榫头长度
    const gX = -w/2;            // 左边缘
    const gY = -grooveH/2;      // 垂直居中
    ctx.fillStyle = 'rgba(35, 25, 18, 0.5)';
    ctx.fillRect(gX, gY, grooveD, grooveH);
    ctx.strokeStyle = 'rgba(35, 25, 18, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(gX, gY, grooveD, grooveH);
  }
  if (comp.id === 'yanwei_mao_01' || comp.id.startsWith('p2_ym_')) {
    // 燕尾卯眼：梯形凹槽在 mortise 左端，水平凹入
    // 与燕尾榫头精确匹配：tLen = w*0.24, rootH = h*0.65（根部宽）, tipH = h*0.35（端部窄）
    // 凹槽入口窄（匹配端部窄），里面宽（匹配根部宽）
    const tipH = h * 0.35;      // 端部窄 = 入口窄
    const rootH = h * 0.65;     // 根部宽 = 里面宽
    const grooveD = w * 0.24;   // 深度 = 榫头长度

    const leftX = -w/2;              // 左边缘（入口 = 窄）
    const rightX = -w/2 + grooveD;   // 内边缘（里面 = 宽）
    const cy = 0;                    // 垂直居中

    ctx.fillStyle = 'rgba(35, 25, 18, 0.45)';
    ctx.beginPath();
    ctx.moveTo(leftX, cy - tipH/2);     // 入口左上（窄）
    ctx.lineTo(leftX, cy + tipH/2);     // 入口左下（窄）
    ctx.lineTo(rightX, cy + rootH/2);   // 里面右下（宽）
    ctx.lineTo(rightX, cy - rootH/2);   // 里面右上（宽）
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(35, 25, 18, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ===== 构件内部纹理细节 =====
  // 直榫：榫头与主体交界线 + 纵向木纹
  if (comp.id === 'zhitui_01' || comp.id.startsWith('p2_zt_')) {
    ctx.strokeStyle = 'rgba(43,33,24,0.15)';
    ctx.lineWidth = 1;
    const bodyRight = w * 0.25;
    ctx.beginPath();
    ctx.moveTo(bodyRight, -h/2 + 4);
    ctx.lineTo(bodyRight, h/2 - 4);
    ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 15, -h/2 + 6);
      ctx.lineTo(i * 15, h/2 - 6);
      ctx.stroke();
    }
  }

  // 卯眼：纵向木纹
  if (comp.id === 'maoyan_01' || comp.id.startsWith('p2_my_')) {
    ctx.strokeStyle = 'rgba(43,33,24,0.12)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const lx = i * 12;
      // 凹槽在左端 x∈[-w/2, -w/2+grooveD]，木纹线在右侧不重叠
      ctx.beginPath();
      ctx.moveTo(lx, -h/2 + 6);
      ctx.lineTo(lx, h/2 - 6);
      ctx.stroke();
    }
  }

  // 燕尾榫：交界线 + 纵向木纹
  if (comp.id === 'yanwei_01' || comp.id.startsWith('p2_yw_')) {
    ctx.strokeStyle = 'rgba(43,33,24,0.15)';
    ctx.lineWidth = 1;
    const bodyRight = w * 0.22;
    ctx.beginPath();
    ctx.moveTo(bodyRight, -h/2 + 4);
    ctx.lineTo(bodyRight, h/2 - 4);
    ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 15, -h/2 + 6);
      ctx.lineTo(i * 15, h/2 - 6);
      ctx.stroke();
    }
  }

  // 燕尾卯：木纹
  if (comp.id === 'yanwei_mao_01' || comp.id.startsWith('p2_ym_')) {
    ctx.strokeStyle = 'rgba(43,33,24,0.12)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const lx = i * 14;
      // 凹槽在左端，木纹线在右侧不重叠
      ctx.beginPath();
      ctx.moveTo(lx, -h/2 + 6);
      ctx.lineTo(lx, h/2 - 6);
      ctx.stroke();
    }
  }

  // 雀替：图片素材已包含龙纹装饰，无需额外绘制
  // if (comp.type === 'bracket') { ... }



  // 已匹配标记
  if (comp.matched) {
    ctx.fillStyle = '#2e5c4f';
    ctx.beginPath();
    ctx.arc(halfW - 10, -halfH + 10, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 文字
  ctx.fillStyle = '#2b2118';
  ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(comp.name, 0, 0);

  // 类型标识小图标
  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'rgba(43,33,24,0.5)';
  const typeLabel = comp.type === 'tenon' ? '榫' : comp.type === 'mortise' ? '卯' : '构';
  ctx.fillText(typeLabel, halfW - 14, halfH - 10);

  // 已匹配标记
  if (comp.matched) {
    ctx.fillStyle = '#2e5c4f';
    ctx.beginPath();
    ctx.arc(halfW - 10, -halfH + 10, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 悬停时绘制传统文化注释气泡
  if (isHover && comp.briefNote) {
    drawNoteBubble(ctx, comp, halfW, halfH);
  }

  ctx.restore();
}
function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  const lines = [];
  let currentLine = '';

  for (const char of words) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}
function drawPatternOverlay(ctx, comp, halfW, halfH) {
  // 只对用户手动上色的构件绘制彩画纹理
  if (!comp.painted) return;

  const patternId = comp.paintPatternId;

  if (patternId === 'hexi_01') {
    // 和玺彩画：用素材图纹理覆盖
    if (!App.hexiPatternImg || !App.hexiPatternImg.complete || App.hexiPatternImg.naturalWidth === 0) return;

    const img = App.hexiPatternImg;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    ctx.save();
    ctx.beginPath();
    roundRect(ctx, -halfW, -halfH, halfW * 2, halfH * 2, 4);
    ctx.clip();
    ctx.globalAlpha = 0.35;

    const srcSize = Math.min(iw, ih) * 0.5;
    const srcX = (iw - srcSize) / 2;
    const srcY = (ih - srcSize) / 2;
    const compW = halfW * 2;
    const compH = halfH * 2;
    const scale = Math.max(compW / srcSize, compH / srcSize);
    const drawW = srcSize * scale;
    const drawH = srcSize * scale;
    const drawX = -compW / 2 - (drawW - compW) / 2;
    const drawY = -compH / 2 - (drawH - compH) / 2;

    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else if (patternId === 'xuanzi_01') {
    // 旋子彩画：用素材图纹理覆盖
    if (!App.xuanziPatternImg || !App.xuanziPatternImg.complete || App.xuanziPatternImg.naturalWidth === 0) return;

    const img = App.xuanziPatternImg;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    ctx.save();
    ctx.beginPath();
    roundRect(ctx, -halfW, -halfH, halfW * 2, halfH * 2, 4);
    ctx.clip();
    ctx.globalAlpha = 0.4;

    const srcSize = Math.min(iw, ih) * 0.5;
    const srcX = (iw - srcSize) / 2;
    const srcY = (ih - srcSize) / 2;
    const compW = halfW * 2;
    const compH = halfH * 2;
    const scale = Math.max(compW / srcSize, compH / srcSize);
    const drawW = srcSize * scale;
    const drawH = srcSize * scale;
    const drawX = -compW / 2 - (drawW - compW) / 2;
    const drawY = -compH / 2 - (drawH - compH) / 2;

    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, drawX, drawY, drawW, drawH);
    ctx.restore();
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
