// ========== 初始化 ==========
function init() {
  App.canvas = document.getElementById('main-canvas');
  App.ctx = App.canvas.getContext('2d');
  App.video = document.getElementById('camera-video');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 初始化构件（阶段三会详细展开）
  initComponents();
  initPatterns();
  initPaintPalette();

  // 绑定鼠标事件（阶段二会加入手势）
  bindMouseEvents();

  // 初始化教程面板
  updateGuidePanel();

  // 开始渲染循环
  requestAnimationFrame(renderLoop);
}

function resizeCanvas() {
  App.width = window.innerWidth;
  App.height = window.innerHeight;
  App.canvas.width = App.width;
  App.canvas.height = App.height;
}

// ========== 启动应用 ==========
async function startApp() {
  const overlay = document.getElementById('start-overlay');
  overlay.style.opacity = '0';
  setTimeout(() => overlay.style.display = 'none', 500);

  init();

  try {
    // 启动摄像头并初始化 MediaPipe Hands
    await initMediaPipe();
  } catch (err) {
    console.warn('MediaPipe或摄像头启动失败:', err);
    App.useMouse = true;
    showHint('【阶段一 · 任务一】请将燕尾榫拖向燕尾卯完成嵌合。其余构件已锁定。');
  }
}


// ========== 彩画初始化 ==========
function initPatterns() {
  App.patterns = [
    {
      id: 'hexi_01',
      name: '和玺龙纹',
      type: '和玺彩画',
      unlockScore: 2,
      color: '#c4a574',
      description: '和玺彩画为最高等级，仅用于宫殿主殿。以龙纹为主题，金线勾勒，青绿底色。'
    },
    {
      id: 'xuanzi_01',
      name: '旋子花瓣',
      type: '旋子彩画',
      unlockScore: 4,
      color: '#8fbc8f',
      description: '旋子彩画因图案呈旋花状而得名，等级次于和玺，广泛用于官式建筑。'
    }
  ];

  // 预加载彩画素材图片
  App.hexiPatternImg = new Image();
  App.hexiPatternImg.src = 'assets/hexi_pattern.png';
  App.xuanziPatternImg = new Image();
  App.xuanziPatternImg.src = 'assets/xuanzi_pattern.png';
}

function initPaintPalette() {
  // 左侧彩画颜料托盘初始化
  // 始终显示所有颜料，已解锁/未解锁用不同样式标注
  const itemH = 52;
  const gap = 10;

  App.paintPalette = [
    {
      id: 'paint_hexi',
      name: '和玺龙纹',
      patternId: 'hexi_01',
      color: '#c4a574',
      displayColor: '#c4a574',
      x: 20, y: 0,
      w: 86, h: itemH,
      unlocked: false,
      unlockScore: 2,
      description: '和玺彩画颜料，金线龙纹，青绿底色。拖拽到已嵌合构件上可为其上色。',
    },
    {
      id: 'paint_xuanzi',
      name: '旋子花纹',
      patternId: 'xuanzi_01',
      color: '#8fbc8f',
      displayColor: '#8fbc8f',
      x: 20, y: 0,
      w: 86, h: itemH,
      unlocked: false,
      unlockScore: 4,
      description: '旋子彩画颜料，青绿旋花纹样。拖拽到已嵌合构件上可为其上色。',
    },
  ];
  updatePaintPalettePositions();
}
// ========== 鼠标事件 ==========
function bindMouseEvents() {
  App.canvas.addEventListener('mousedown', onMouseDown);
  App.canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // 触摸支持
  App.canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    onMouseDown({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });

  App.canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', onMouseUp);
}

function onMouseDown(e) {
  if (!App.useMouse) return;
  const rect = App.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  App.mouse.x = x;
  App.mouse.y = y;
  App.mouse.down = true;
  triggerPointerDown(x, y);
}

function onMouseMove(e) {
  if (!App.useMouse) return;
  const rect = App.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  App.mouse.x = x;
  App.mouse.y = y;
  triggerPointerMove(x, y);
  updateHandCursor(x, y, App.mouse.down);
}

function onMouseUp() {
  if (!App.useMouse) return;
  App.mouse.down = false;
  triggerPointerUp();
}

// ========== 统一交互触发器（手势/鼠标共用） ==========
function isDraggableInStage(comp) {
  if (App.currentStage === 1) {
    // 阶段一引导模式
    if (App.phase1Done) return false;
    if (App.currentTask === 1) {
      return (comp.id === 'yanwei_01' || comp.id === 'yanwei_mao_01');
    } else if (App.currentTask === 2) {
      return (comp.id === 'zhitui_01' || comp.id === 'maoyan_01');
    } else if (App.currentTask === 3) {
      return (comp.id === 'zhu_01');
    }
    return false;
  } else if (App.currentStage === 2) {
    // 阶段二自由搭建：所有构件都可移动
    // 但如果开启了搭建引导，只允许引导步骤所需的构件移动
    if (App.buildGuide && App.buildGuide.stepIds) {
      return App.buildGuide.stepIds.includes(comp.id);
    }
    return true;
  }
  return false;
}

function triggerPointerDown(x, y) {
  // 先检查是否点中彩画托盘中的颜料（颜料优先级高于构件）
  const unlockedPaints = App.paintPalette.filter(p => p.unlocked);
  for (let i = unlockedPaints.length - 1; i >= 0; i--) {
    const paint = unlockedPaints[i];
    if (
      x >= paint.x && x <= paint.x + paint.w &&
      y >= paint.y && y <= paint.y + paint.h
    ) {
      App.draggingPaint = paint;
      return;
    }
  }

  // 检查是否点中构件（动画中的不可拖拽，已匹配的组可整体拖拽）
  for (let i = App.components.length - 1; i >= 0; i--) {
    const comp = App.components[i];
    if (comp.animating) continue;
    // 已匹配但没有组的构件不可单独拖拽（等待组合）
    if (comp.matched && !comp.groupId) continue;
    // 阶段锁定：非当前阶段允许移动的构件不可拖拽
    if (!isDraggableInStage(comp)) continue;
    if (hitTest(comp, x, y)) {
      App.draggingComponent = comp;
      App.dragOffset.x = x - comp.x;
      App.dragOffset.y = y - comp.y;
      // 如果拖拽的是组成员，记录组内所有成员相对偏移
      App.dragGroupOffset = {};
      if (comp.groupId && App.groups[comp.groupId]) {
        for (const memberId of App.groups[comp.groupId]) {
          const member = App.components.find(c => c.id === memberId);
          if (member && member !== comp) {
            App.dragGroupOffset[memberId] = {
              x: member.x - comp.x,
              y: member.y - comp.y
            };
          }
        }
      }
      // 提到最上层（整组提到上层）
      App.components.splice(i, 1);
      App.components.push(comp);
      if (comp.groupId && App.groups[comp.groupId]) {
        for (const memberId of App.groups[comp.groupId]) {
          const memberIdx = App.components.findIndex(c => c.id === memberId);
          if (memberIdx !== -1 && memberId !== comp.id) {
            const member = App.components.splice(memberIdx, 1)[0];
            App.components.push(member);
          }
        }
      }
      break;
    }
  }
}

function triggerPointerMove(x, y) {
  // 如果正在拖动颜料，不处理构件拖拽
  if (App.draggingPaint) return;

  // 拖拽中（组内成员一起移动）
  if (App.draggingComponent) {
    const newX = x - App.dragOffset.x;
    const newY = y - App.dragOffset.y;
    const dx = newX - App.draggingComponent.x;
    const dy = newY - App.draggingComponent.y;
    App.draggingComponent.x = newX;
    App.draggingComponent.y = newY;
    // 同组成员一起移动
    for (const [memberId, offset] of Object.entries(App.dragGroupOffset)) {
      const member = App.components.find(c => c.id === memberId);
      if (member) {
        member.x = newX + offset.x;
        member.y = newY + offset.y;
      }
    }
  }

  // 悬停检测
  App.hoverComponent = null;
  for (let i = App.components.length - 1; i >= 0; i--) {
    if (hitTest(App.components[i], x, y)) {
      App.hoverComponent = App.components[i];
      break;
    }
  }
}

function triggerPointerUp() {
  // 无论如何最后都要清除拖拽状态，防止卡住
  try {
    // 如果正在拖动颜料，检测是否放到已嵌合构件上
    if (App.draggingPaint) {
      const mx = App.useMouse ? App.mouse.x : App.hand.x;
      const my = App.useMouse ? App.mouse.y : App.hand.y;
      const paint = App.draggingPaint;

      // 查找光标下的已嵌合构件
      let targetComp = null;
      for (let i = App.components.length - 1; i >= 0; i--) {
        const comp = App.components[i];
        if (comp.matched && hitTest(comp, mx, my)) {
          targetComp = comp;
          break;
        }
      }

      if (targetComp) {
        // 给构件上色（设置painted属性和patternId）
        targetComp.painted = true;
        targetComp.paintPatternId = paint.patternId;
        showHint(`【上色】${targetComp.name} 涂上了 ${paint.name}`, 2000);
      } else {
        showHint('请将颜料拖到已嵌合的构件上', 1500);
      }

      App.draggingPaint = null;
      return;
    }

    if (App.draggingComponent) {
      const comp = App.draggingComponent;
      let justMatched = false;
      // 检测是否放入回收区域（阶段二）
      if (App.currentStage === 2 && isInRecycleArea(comp.x, comp.y)) {
        App.components = App.components.filter(c => c.id !== comp.id);
        // 同时从组中移除
        for (const gid in App.groups) {
          App.groups[gid] = App.groups[gid].filter(id => id !== comp.id);
          if (App.groups[gid].length === 0) delete App.groups[gid];
        }
        showHint(`【移除】${comp.name} 已回收`, 1500);
      } else {
        // 放下时进行匹配检测
        justMatched = checkMatchOnRelease(comp);
        // 如果刚发生了新匹配，跳过引导放置检测
        // 用户需要重新拾起拼好的组合件，拖到虚线框才算完成
        if (justMatched) {
          showHint('拼接成功！请拾起拼好的横梁拖到金色虚线框内。', 2500);
        }
      }
      // 检测搭建引导放置
      // 步骤3跳过（需重新拾起拼好的横梁拖到虚线框）
      // 步骤4雀替吸附后仍需检测以推进步骤
      const isStep3 = App.buildGuide && App.buildGuide.step === 3;
      if (App.buildGuide && !App.buildGuide.completed && !(isStep3 && justMatched)) {
        checkBuildGuidePlacement(comp);
      }
    }
  } catch (e) {
    console.error('triggerPointerUp error:', e);
  }
  App.draggingComponent = null;
  App.draggingPaint = null;
}
// ========== 彩画解锁 ==========
function checkPatternUnlock() {
  for (const pattern of App.patterns) {
    if (App.unlockedPatterns.includes(pattern.id)) continue;
    if (App.score >= pattern.unlockScore) {
      App.unlockedPatterns.push(pattern.id);
      showHint(`【彩画解锁】${pattern.name} —— ${pattern.description}`, 4000);
      // 将对应颜料显示到托盘
      const paint = App.paintPalette.find(p => p.patternId === pattern.id);
      if (paint && !paint.unlocked) {
        paint.unlocked = true;
        updatePaintPalettePositions();
      }
    }
  }
}

function updatePaintPalettePositions() {
  // 重新排列所有颜料（不管是否解锁）
  // 留出顶部空间给操作说明(18px) + 标题(22px)
  const startY = 300;
  const itemH = 60;
  const gap = 12;
  for (let i = 0; i < App.paintPalette.length; i++) {
    App.paintPalette[i].x = 60;
    App.paintPalette[i].y = startY + i * (itemH + gap);
  }
}

// ========== UI 功能 ==========
function updateScoreDisplay() {
  document.getElementById('score-value').textContent = App.score;
}

function updateGuidePanel() {
  const stageEl = document.getElementById('guide-stage');
  const taskEl = document.getElementById('guide-task');
  if (!stageEl || !taskEl) return;

  if (App.currentStage === 2) {
    stageEl.textContent = '阶段二 · 自由搭建';
    taskEl.textContent = '用各种构件自由搭建传统木构建筑';
  } else if (App.currentStage === 1) {
    if (App.phase1Done) {
      stageEl.textContent = '阶段一 · 已完成';
      taskEl.textContent = '点击"自由搭建"进入阶段二';
    } else if (App.currentTask === 3) {
      stageEl.textContent = '阶段一 · 任务三';
      taskEl.textContent = '请将立柱拖到已嵌合的梁下方';
    } else if (App.currentTask === 2) {
      stageEl.textContent = '阶段一 · 任务二';
      taskEl.textContent = '请将直榫拖向卯眼完成嵌合';
    } else {
      stageEl.textContent = '阶段一 · 任务一';
      taskEl.textContent = '请将燕尾榫拖向燕尾卯完成嵌合';
    }
  }
}

function showHint(text, duration = 3000) {
  const hint = document.getElementById('hint-box');
  hint.textContent = text;
  hint.classList.add('show');

  if (App.hintTimer) clearTimeout(App.hintTimer);
  App.hintTimer = setTimeout(() => {
    hint.classList.remove('show');
  }, duration);
}

// ========== 阶段二：自由搭建 ==========
function initPhase2() {
  // 隐藏自由搭建按钮
  const btnPhase2 = document.getElementById('btn-phase2');
  if (btnPhase2) btnPhase2.style.display = 'none';

  // 显示搭建引导按钮
  const btnBuildGuide = document.getElementById('btn-build-guide');
  if (btnBuildGuide) btnBuildGuide.style.display = 'inline-block';

  // 弹出进入阶段二的弹窗
  const overlay = document.createElement('div');
  overlay.id = 'phase2-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100;display:flex;align-items:center;justify-content:center;';
  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:rgba(43,33,24,0.97);border:1px solid #c4a574;border-radius:12px;padding:32px 40px;max-width:420px;text-align:center;color:#d4c9b8;font-family:inherit;';
  dialog.innerHTML = '<h3 style="color:#c4a574;font-size:1.4rem;margin:0 0 12px 0;">进入阶段二 · 自由搭建</h3><p style="font-size:0.95rem;line-height:1.6;margin:0 0 20px 0;">阶段一完成！现在你可以使用各种构件自由搭建传统木构建筑，也可点击下方「搭建引导」按钮跟随提示逐步搭建一座牌楼。</p><button class="btn primary" id="btn-phase2-ok" style="padding:10px 32px;font-size:1rem;">确认</button>';
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 全局函数：鼠标和手势捏合都能关闭弹窗
  window.closePhase2Modal = function() {
    const el = document.getElementById('phase2-overlay');
    if (el) el.remove();
  };
  document.getElementById('btn-phase2-ok').addEventListener('click', window.closePhase2Modal);

  // 清空阶段一的构件
  App.components = [];
  App.groups = {};
  App.nextGroupId = 1;
  App.matchedPairs = [];
  App.errorCount = {};
  Animations.length = 0;
  App.currentStage = 2;
  updateScoreDisplay();
  updateGuidePanel();

  const cx = App.width / 2;
  const cy = App.height / 2;

  // 生成多种尺寸的直榫+直卯（4种尺寸）
  const sizes = [
    { w: 105, h: 32, label: '小' },
    { w: 135, h: 40, label: '中' },
    { w: 165, h: 44, label: '大' },
    { w: 280, h: 52, label: '特大' },
  ];

  const spacing = 90;
  let idx = 0;

  sizes.forEach((sz, si) => {
    const baseY = cy - 180 + si * spacing;

    // 直榫
    App.components.push({
      id: 'p2_zt_' + si, name: '直榫(' + sz.label + ')', type: 'tenon',
      category: '自由搭建', x: cx - 250, y: baseY,
      width: sz.w, height: sz.h, rotation: 0, matched: false,
      unlocks: [], description: '直榫 - ' + sz.label + '号构件',
      briefNote: '直来直往，承托千秋。',
      origin: '直榫见于商代青铜器的木范结构。',
      rules: { mateWith: ['p2_my_' + si], tolerance: 80, angleTolerance: 15 },
      color: '#8b7355', groupId: null, sizeKey: 'sz' + si,
    });

    // 直卯
    App.components.push({
      id: 'p2_my_' + si, name: '直卯(' + sz.label + ')', type: 'mortise',
      category: '自由搭建', x: cx + 250, y: baseY,
      width: sz.w, height: sz.h, rotation: 0, matched: false,
      unlocks: [], description: '卯眼 - ' + sz.label + '号构件',
      briefNote: '有容乃大，不露锋芒。',
      origin: '卯字本义为"冒"，取覆盖之意。',
      rules: { mateWith: ['p2_zt_' + si], tolerance: 80, angleTolerance: 15 },
      color: '#6b5a45', groupId: null, sizeKey: 'sz' + si,
    });
  });

  // 燕尾榫+燕尾卯（3种尺寸）
  const ywSizes = [
    { w: 115, h: 36, label: '小' },
    { w: 155, h: 44, label: '中' },
    { w: 195, h: 52, label: '大' },
  ];

  ywSizes.forEach((sz, si) => {
    const baseY = cy - 100 + si * spacing;

    App.components.push({
      id: 'p2_yw_' + si, name: '燕尾榫(' + sz.label + ')', type: 'tenon',
      category: '自由搭建', x: cx - 350, y: baseY,
      width: sz.w, height: sz.h, rotation: 0, matched: false,
      unlocks: [], description: '燕尾榫 - ' + sz.label + '号构件',
      briefNote: '形如燕尾，入木三分。',
      origin: '燕尾榫古称"银锭榫"。',
      rules: { mateWith: ['p2_ym_' + si], tolerance: 90, angleTolerance: 15 },
      color: '#9c7e5e', groupId: null, sizeKey: 'yw' + si,
    });

    App.components.push({
      id: 'p2_ym_' + si, name: '燕尾卯(' + sz.label + ')', type: 'mortise',
      category: '自由搭建', x: cx + 350, y: baseY,
      width: sz.w, height: sz.h, rotation: 0, matched: false,
      unlocks: [], description: '燕尾卯 - ' + sz.label + '号构件',
      briefNote: '口窄腹阔，请君入瓮。',
      origin: '燕尾卯需逆燕尾之形而凿。',
      rules: { mateWith: ['p2_yw_' + si], tolerance: 90, angleTolerance: 15 },
      color: '#7a6548', groupId: null, sizeKey: 'yw' + si,
    });
  });

  // 柱（4种高度，每种2根）
  const pillarSpecs = [
    { h: 130, label: '短' },
    { h: 170, label: '中' },
    { h: 210, label: '长' },
    { h: 260, label: '特长' },
  ];
  pillarSpecs.forEach((spec, si) => {
    for (let copy = 0; copy < 2; copy++) {
      App.components.push({
        id: 'p2_zhu_' + si + '_' + copy, name: '柱(' + spec.label + ')', type: 'structure',
        category: '自由搭建', x: cx - 180 + si * 90 + copy * 45, y: 75,
        width: 38, height: spec.h, rotation: 0, matched: false,
        unlocks: [], description: '立柱 - ' + spec.label,
        briefNote: '木秀于林，柱立于堂。',
        origin: '柱之称谓始于殷墟。',
        rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
        color: '#a08060', groupId: null,
      });
    }
  });


  // 雀替（左3份 + 右3份）
  const quetiLeftPositions = [
    { x: cx - 260, y: 145 },
    { x: cx - 300, y: 220 },
    { x: cx - 220, y: 300 },
  ];
  quetiLeftPositions.forEach((pos, i) => {
    App.components.push({
      id: 'p2_nt_l_' + i, name: '雀替(左)', type: 'bracket',
      category: '自由搭建', x: pos.x, y: pos.y,
      width: 65, height: 85, rotation: 0, matched: false,
      unlocks: [], description: '雀替(左)，上承檐檩，下倚柱身，龙纹透雕如云卷风舒，既承重又具装饰之美。',
      briefNote: '上承千斤，下卷祥云。',
      origin: '雀替为传统建筑檐下标配，左右成对。',
      rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
      color: '#8a7050', groupId: null,
    });
  });
  const quetiRightPositions = [
    { x: cx + 150, y: 145 },
    { x: cx + 190, y: 220 },
    { x: cx + 110, y: 300 },
  ];
  quetiRightPositions.forEach((pos, i) => {
    App.components.push({
      id: 'p2_nt_r_' + i, name: '雀替(右)', type: 'bracket',
      category: '自由搭建', x: pos.x, y: pos.y,
      width: 65, height: 85, rotation: 0, matched: false,
      unlocks: [], description: '雀替(右)，与左雀替对称呼应，共承檐角。',
      briefNote: '左右对映，翼然如飞。',
      origin: '雀替左右成对，为传统建筑檐下标配。',
      rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
      color: '#8a7050', groupId: null,
    });
  });

  // 屋檐（大中小三种，已放大三倍）
  const wuSizes = [
    { name: '屋檐(大)', w: 900, h: 320, x: cx - 470, y: 80 },
    { name: '屋檐(中)', w: 540, h: 180, x: cx - 60, y: 75 },
    { name: '屋檐(小)', w: 390, h: 132, x: cx + 280, y: 90 },
  ];
  wuSizes.forEach((sz, i) => {
    App.components.push({
      id: 'p2_wy_' + i, name: sz.name, type: 'eave',
      category: '自由搭建', x: sz.x, y: sz.y,
      width: sz.w, height: sz.h, rotation: 0, matched: false,
      unlocks: [], description: '飞檐翘角，翼角起翘，为传统建筑之冠冕。',
      briefNote: '飞檐如翼，凌空展翅。',
      origin: '屋檐做法始于先秦，至唐宋臻于成熟。',
      rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
      color: '#7a5c3a', groupId: null,
    });
  });

  showHint('【阶段二 - 自由搭建】用各种构件自由搭建传统木构建筑！');
}

function resetBuild() {
  App.score = 0;
  App.matchedPairs = [];
  App.unlockedPatterns = [];
  App.errorCount = {};
  App.groups = {};
  App.nextGroupId = 1;
  App.dragGroupOffset = {};
  App.paintPalette = [];
  App.draggingPaint = null;
  // 重置阶段状态
  App.currentStage = 1;
  App.currentTask = 1;
  App.task1Done = false;
  App.task2Done = false;
  App.task3Done = false;
  App.phase1Done = false;
  App.phase2Done = false;
  Animations.length = 0; // 清空动画队列
  // 隐藏自由搭建按钮
  const btnReset = document.getElementById('btn-phase2');
  if (btnReset) btnReset.style.display = 'none';
  const btnBuildGuide = document.getElementById('btn-build-guide');
  if (btnBuildGuide) btnBuildGuide.style.display = 'none';
  // 清除搭建引导状态
  App.buildGuide = null;
  App.buildGuideTargets = [];
  // 恢复所有构件可见
  for (const comp of App.components) comp.hidden = false;
  const guidePanel = document.getElementById('build-guide-panel');
  if (guidePanel) guidePanel.style.display = 'none';
  updateScoreDisplay();
  updateGuidePanel();
  initComponents();
  showHint('【阶段一 · 任务一】请将燕尾榫拖向燕尾卯完成嵌合。其余构件已锁定。');
}

function toggleGuide() {
  let guide = document.getElementById('guide-panel');
  if (guide) {
    guide.remove();
    return;
  }

  guide = document.createElement('div');
  guide.id = 'guide-panel';
  guide.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 640px; max-height: 80vh; overflow-y: auto;
    background: rgba(43, 33, 24, 0.95); border: 1px solid #5c4033;
    border-radius: 12px; padding: 24px; z-index: 50;
    color: #d4c9b8; font-family: inherit;
  `;

  let html = '<h3 style="color:#c4a574;margin-bottom:16px;font-size:1.3rem;">营造图鉴</h3>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';

  for (const comp of App.components) {
    html += `
      <div style="background:rgba(196,165,116,0.08);border:1px solid #5c4033;border-radius:8px;padding:12px;">
        <div style="color:#c4a574;font-weight:bold;font-size:1rem;margin-bottom:6px;">${comp.name}</div>
        <div style="font-size:0.8rem;color:#8c7e6d;margin-bottom:4px;">${comp.category} · ${comp.type === 'tenon' ? '榫头' : comp.type === 'mortise' ? '卯眼' : '结构'}</div>
        <div style="font-size:0.85rem;line-height:1.5;">${comp.description}</div>
      </div>
    `;
  }

  html += '</div>';
  html += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #5c4033;">';
  html += '<h4 style="color:#c4a574;margin-bottom:10px;">彩画</h4>';
  for (const p of App.patterns) {
    const unlocked = App.unlockedPatterns.includes(p.id);
    html += `<div style="font-size:0.85rem;margin-bottom:6px;${unlocked ? 'color:#c4a574;' : 'color:#5c5c5c;'}">
      ${unlocked ? '✓' : '○'} ${p.name}（${p.type}）— ${unlocked ? '已解锁' : `需营造值 ${p.unlockScore}`}
    </div>`;
  }
  html += '</div>';
  html += '<button onclick="toggleGuide()" style="margin-top:16px;background:#5c4033;color:#d4c9b8;border:none;padding:8px 24px;border-radius:6px;cursor:pointer;font-family:inherit;">关闭</button>';

  guide.innerHTML = html;
  document.body.appendChild(guide);
}

// ========== 搭建引导系统 ==========

function startBuildGuide() {
  // 初始化搭建引导
  App.buildGuide = { step: 1, total: 5, completed: false, stepIds: [], placedTargets: [] };
  App.buildGuideTargets = [];

  // 显示面板
  const panel = document.getElementById('build-guide-panel');
  if (panel) panel.style.display = 'block';

  // 隐藏引导按钮
  const btn = document.getElementById('btn-build-guide');
  if (btn) btn.style.display = 'none';

  // 为引导生成新的构件实例，放在画布底部
  createGuideComponents();

  advanceBuildGuideStep();
  updateBuildGuideVisibility();
  showHint('【搭建引导】跟随指示，搭建一座传统古建筑！', 2500);
}

// 为搭建引导创建全新的构件实例
function createGuideComponents() {
  const cx = App.width / 2;
  const baseY = App.height / 2 + 80;

  // 隐藏所有现有构件
  for (const comp of App.components) {
    comp.hidden = true;
  }
  // 清空组和动画
  App.groups = {};
  App.nextGroupId = 1;

  const guideIds = [
    'p2_zhu_2_0', 'p2_zhu_2_1',
    'p2_zt_3', 'p2_my_3',
    'p2_nt_l_0', 'p2_nt_r_0', 'p2_nt_l_1', 'p2_nt_r_1',
    'p2_wy_0'
  ];

  // 移除已有的同名构件（如果有）
  App.components = App.components.filter(c => !guideIds.includes(c.id));

  // 左柱
  App.components.push({
    id: 'p2_zhu_2_0', name: '立柱', type: 'structure',
    category: '自由搭建', x: cx - 420, y: baseY,
    width: 38, height: 210, rotation: 0, matched: false,
    unlocks: [], description: '立柱为建筑之骨架，直挺如松，承载千钧。',
    briefNote: '直如松柏，顶立苍穹。',
    origin: '柱之制始于穴居时代，历代皆有定制。',
    rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
    color: '#a08060', groupId: null, hidden: false,
  });
  // 右柱
  App.components.push({
    id: 'p2_zhu_2_1', name: '立柱', type: 'structure',
    category: '自由搭建', x: cx - 340, y: baseY,
    width: 38, height: 210, rotation: 0, matched: false,
    unlocks: [], description: '立柱为建筑之骨架，直挺如松，承载千钧。',
    briefNote: '直如松柏，顶立苍穹。',
    origin: '柱之制始于穴居时代，历代皆有定制。',
    rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
    color: '#a08060', groupId: null, hidden: false,
  });
  // 直榫(特大)
  App.components.push({
    id: 'p2_zt_3', name: '直榫(特大)', type: 'tenon',
    category: '自由搭建', x: cx - 200, y: baseY,
    width: 280, height: 52, rotation: 0, matched: false,
    unlocks: [], description: '直榫——直出平入，为最基本的榫卯构造之一。',
    briefNote: '直出平入，稳如磐石。',
    origin: '直榫为最古老的榫卯形式之一，早在河姆渡时期已见雏形。',
    rules: { mateWith: ['p2_my_3'], tolerance: 120, angleTolerance: 25 },
    color: '#8a6b4a', groupId: null, hidden: false,
  });
  // 直卯(特大)
  App.components.push({
    id: 'p2_my_3', name: '直卯(特大)', type: 'mortise',
    category: '自由搭建', x: cx - 80, y: baseY,
    width: 280, height: 52, rotation: 0, matched: false,
    unlocks: [], description: '直卯——与直榫配对，形成最基础的嵌合结构。',
    briefNote: '有容乃大，不露锋芒。',
    origin: '卯字本义为"冒"，取覆盖之意。',
    rules: { mateWith: ['p2_zt_3'], tolerance: 120, angleTolerance: 25 },
    color: '#8a6b4a', groupId: null, hidden: false,
  });
  // 雀替：左柱左、左柱右、右柱左、右柱右
  const queTiIds = ['p2_nt_l_0', 'p2_nt_r_0', 'p2_nt_l_1', 'p2_nt_r_1'];
  const queTiNames = ['雀替(左)', '雀替(右)', '雀替(左)', '雀替(右)'];
  const queTiX = [cx + 60, cx + 160, cx + 260, cx + 360];
  for (let i = 0; i < 4; i++) {
    App.components.push({
      id: queTiIds[i], name: queTiNames[i], type: 'bracket',
      category: '自由搭建', x: queTiX[i], y: baseY,
      width: 65, height: 85, rotation: 0, matched: false,
      unlocks: [], description: '雀替，上承檐檩，下倚柱身，龙纹透雕如云卷风舒，既承重又具装饰之美。',
      briefNote: '上承千斤，下卷祥云。',
      origin: '雀替为传统建筑檐下标配，左右成对。',
      rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
      color: '#8a7050', groupId: null, hidden: false,
    });
  }

  // 屋檐(大) — 放在上方，避免遮挡雀替
  App.components.push({
    id: 'p2_wy_0', name: '屋檐(大)', type: 'eave',
    category: '自由搭建', x: cx + 520, y: baseY - 200,
    width: 900, height: 320, rotation: 0, matched: false,
    unlocks: [], description: '飞檐翘角，翼角起翘，为传统建筑之冠冕。',
    briefNote: '飞檐如翼，凌空展翅。',
    origin: '屋檐做法始于先秦，至唐宋臻于成熟。',
    rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
    color: '#7a5c3a', groupId: null, hidden: false,
  });
}

function closeBuildGuide() {
  App.buildGuide = null;
  App.buildGuideTargets = [];

  // 恢复所有构件可见
  for (const comp of App.components) {
    comp.hidden = false;
  }

  const panel = document.getElementById('build-guide-panel');
  if (panel) panel.style.display = 'none';

  const btn = document.getElementById('btn-build-guide');
  if (btn) btn.style.display = 'inline-block';

  showHint('已退出搭建引导，可自由搭建', 1500);
}

function updateBuildGuideVisibility() {
  const g = App.buildGuide;
  if (!g || !g.stepIds) {
    for (const comp of App.components) comp.hidden = false;
    return;
  }
  // 引导期间：收集所有步骤需要的构件ID
  const allGuideIds = new Set();
  // 左柱、右柱
  allGuideIds.add('p2_zhu_2_0');
  allGuideIds.add('p2_zhu_2_1');
  // 横梁（直榫+直卯，先拼好再架）
  allGuideIds.add('p2_zt_3');
  allGuideIds.add('p2_my_3');
  // 雀替（每柱左右各一，共4个）
  allGuideIds.add('p2_nt_l_0');
  allGuideIds.add('p2_nt_r_0');
  allGuideIds.add('p2_nt_l_1');
  allGuideIds.add('p2_nt_r_1');
  // 屋檐
  allGuideIds.add('p2_wy_0');

  for (const comp of App.components) {
    comp.hidden = !allGuideIds.has(comp.id);
  }
}

function advanceBuildGuideStep() {
  const g = App.buildGuide;
  if (!g) return;

  App.buildGuideTargets = [];
  g.placedTargets = [];
  const cx = App.width / 2;
  const cy = App.height / 2;

  // 设置步骤所需构件，只显示当前步骤需要的
  const stepIds = [];

  if (g.step === 1) {
    // 步骤1：立左柱（吸附后中心在 cx-181, cy+145）
    const targetX = cx - 200;
    const targetY = cy + 40;
    App.buildGuideTargets.push({
      x: targetX, y: targetY, w: 38, h: 210, icon: '柱', compId: 'p2_zhu_2_0', label: '立左柱'
    });
    stepIds.push('p2_zhu_2_0');
    updateGuideStepText('第 1 步 · 立左柱', '将一根立柱拖到左侧金色虚线框内，作为建筑的左柱。');
  } else if (g.step === 2) {
    // 步骤2：立右柱（吸附后中心在 cx+181, cy+145）
    const targetX = cx + 162;
    const targetY = cy + 40;
    App.buildGuideTargets.push({
      x: targetX, y: targetY, w: 38, h: 210, icon: '柱', compId: 'p2_zhu_2_1', label: '立右柱'
    });
    stepIds.push('p2_zhu_2_1');
    updateGuideStepText('第 2 步 · 立右柱', '将另一根立柱拖到右侧金色虚线框内，形成双柱结构。');
  } else if (g.step === 3) {
    // 步骤3：架梁（拼好的榫卯组合，整体宽约300px）
    // 目标：在两根柱子顶部之间放一个梁
    const targetX = cx - 140;
    const targetY = cy - 12;
    App.buildGuideTargets.push({
      x: targetX, y: targetY, w: 280, h: 52, icon: '梁', compId: 'p2_zt_3', label: '横梁'
    });
    stepIds.push('p2_zt_3', 'p2_my_3');
    updateGuideStepText('第 3 步 · 架横梁', '先将特大直榫和特大直卯拼接成完整横梁，再将拼好的横梁整体拖到两柱顶部之间的金色虚线框处。');
  } else if (g.step === 4) {
    // 步骤4：装雀替（每柱顶端左右各一，共4个）
    // 雀替嵌入柱子6px、嵌入横梁8px后的目标位置
    const ty = cy + 32;
    App.buildGuideTargets.push(
      { x: cx - 259, y: ty, w: 65, h: 85, icon: '左', compId: 'p2_nt_l_0', label: '左柱左雀替' },
      { x: cx - 168, y: ty, w: 65, h: 85, icon: '右', compId: 'p2_nt_r_0', label: '左柱右雀替' },
      { x: cx + 103, y: ty, w: 65, h: 85, icon: '左', compId: 'p2_nt_l_1', label: '右柱左雀替' },
      { x: cx + 194, y: ty, w: 65, h: 85, icon: '右', compId: 'p2_nt_r_1', label: '右柱右雀替' }
    );
    stepIds.push('p2_nt_l_0', 'p2_nt_r_0', 'p2_nt_l_1', 'p2_nt_r_1');
    updateGuideStepText('第 4 步 · 装雀替', '将四个雀替分别拖到每根柱子顶端左右两侧。');
  } else if (g.step === 5) {
    // 步骤5：盖大屋檐（放大到900x320，位置再下移）
    const targetX = cx - 450;
    const targetY = cy - 190;
    App.buildGuideTargets.push({
      x: targetX, y: targetY, w: 900, h: 320, icon: '檐', compId: 'p2_wy_0', label: '大屋檐'
    });
    stepIds.push('p2_wy_0');
    updateGuideStepText('第 5 步 · 盖屋檐', '将大屋檐拖到金色虚线框内，完成牌楼搭建！');
  }

  // 设置步骤所需构件
  g.stepIds = stepIds;

  updateBuildGuideVisibility();
}

function updateGuideStepText(step, desc) {
  const stepEl = document.getElementById('bg-step-text');
  const descEl = document.getElementById('bg-desc-text');
  if (stepEl) stepEl.textContent = step;
  if (descEl) descEl.textContent = desc;
}

function advanceGuideIfAllPlaced() {
  const g = App.buildGuide;
  if (!g) return;
  const targets = App.buildGuideTargets;
  const allPlaced = targets.every(tg => g.placedTargets.includes(tg.compId));
  if (allPlaced) {
    g.step++;
    if (g.step > g.total) {
      g.completed = true;
      App.buildGuideTargets = [];
      updateGuideStepText('完成！', '恭喜！你已成功搭建了一座传统牌楼！');
      showHint('【搭建完成】一座传统牌楼已建成！点击任意构件可整体移动。', 4000);

      // 把所有建筑构件加入同一个大组，可整体移动
      const buildingIds = ['p2_zhu_2_0', 'p2_zhu_2_1', 'p2_zt_3', 'p2_my_3',
                           'p2_nt_l_0', 'p2_nt_r_0', 'p2_nt_l_1', 'p2_nt_r_1', 'p2_wy_0'];
      // 清理这些构件的旧组关系
      for (const comp of App.components) {
        if (buildingIds.includes(comp.id)) comp.groupId = null;
      }
      // 过滤掉包含这些构件的旧组
      for (const gid in App.groups) {
        App.groups[gid] = App.groups[gid].filter(id => !buildingIds.includes(id));
        if (App.groups[gid].length === 0) delete App.groups[gid];
      }
      // 创建新的大组
      const buildingGroupId = 'group_building_' + App.nextGroupId++;
      App.groups[buildingGroupId] = [];
      for (const id of buildingIds) {
        const comp = App.components.find(c => c.id === id);
        if (comp) {
          comp.groupId = buildingGroupId;
          App.groups[buildingGroupId].push(id);
        }
      }

      setTimeout(() => {
        const panel = document.getElementById('build-guide-panel');
        if (panel) panel.style.display = 'none';
        App.buildGuide = null;
        for (const comp of App.components) comp.hidden = false;
        const btn = document.getElementById('btn-build-guide');
        if (btn) btn.style.display = 'inline-block';
      }, 3000);
    } else {
      advanceBuildGuideStep();
      showHint(`【搭建引导】进入第 ${g.step} 步！`, 2000);
    }
  } else {
    const remaining = targets.filter(tg => !g.placedTargets.includes(tg.compId));
    const nextLabel = remaining[0] ? remaining[0].label : '';
    showHint(`【搭建引导】${nextLabel ? '请继续放置' + nextLabel : '请继续放置剩余构件'}`, 1800);
  }
}

function checkBuildGuidePlacement(comp) {
  const g = App.buildGuide;
  if (!g) return false;

  // 步骤3特殊处理：必须拖拽已拼接好的横梁组才能放置
  // 单独放直榫或直卯时，只触发匹配检测，不触发目标框检测
  if (g.step === 3) {
    const isMatchedGroup = comp.matched && comp.groupId &&
      App.groups[comp.groupId] &&
      App.groups[comp.groupId].length >= 2;
    if (!isMatchedGroup) return false;

    // 步骤3用组中心检测：计算拼接后整体中心到目标框中心的距离
    const group = App.groups[comp.groupId];
    const members = group.map(id => App.components.find(c => c.id === id)).filter(Boolean);
    const groupCenterX = members.reduce((s, m) => s + m.x, 0) / members.length;
    const groupCenterY = members.reduce((s, m) => s + m.y, 0) / members.length;

    const targets = App.buildGuideTargets;
    const t = targets[0]; // 步骤3只有一个目标
    if (!t || g.placedTargets.includes(t.compId)) return false;

    const tx = t.x + t.w / 2;
    const ty = t.y + t.h / 2;
    const dist = Math.sqrt((groupCenterX - tx) ** 2 + (groupCenterY - ty) ** 2);
    const tolerance = Math.max(t.w, t.h) * 1.0;

    if (dist < tolerance) {
      // 计算组中心到目标中心的偏移量
      const dx = tx - groupCenterX;
      const dy = ty - groupCenterY;

      // 整组按偏移量移动，保持相对位置不变
      for (const member of members) {
        member.x += dx;
        member.y += dy;
      }

      g.placedTargets.push(t.compId);
      showHint(`【✓】${t.label} 放置完成！`, 1800);
      advanceGuideIfAllPlaced();
      return true;
    }
    return false;
  }

  // 步骤4保险：雀替已吸附到柱子即视为已放置，不依赖距离检测
  if (g.step === 4 && comp.type === 'bracket' && comp.matched) {
    const t = App.buildGuideTargets.find(tg => tg.compId === comp.id);
    if (t && !g.placedTargets.includes(comp.id)) {
      g.placedTargets.push(comp.id);
      showHint(`【✓】${t.label} 放置完成！`, 1800);
      advanceGuideIfAllPlaced();
      return true;
    }
    return false;
  }

  // 非步骤3/4：原有逻辑
  const targets = App.buildGuideTargets;
  for (const t of targets) {
    // 确定匹配的构件：可能是拖动构件本身，也可能是组内的其他成员
    let matchedComp = comp;
    if (comp.id !== t.compId && comp.groupId && App.groups[comp.groupId]) {
      const matchedId = App.groups[comp.groupId].find(mid => mid === t.compId);
      if (matchedId) {
        matchedComp = App.components.find(c => c.id === matchedId);
        if (!matchedComp) continue;
      }
    }

    if (matchedComp.id !== t.compId) continue;
    // 避免重复放置
    if (g.placedTargets.includes(t.compId)) return false;

    // 检查是否在目标范围内（以匹配构件的中心检测）
      // 注意：matchedComp.x/y 已经是构件中心点坐标
      const ccx = matchedComp.x;
      const ccy = matchedComp.y;
      const tx = t.x + t.w / 2;
      const ty = t.y + t.h / 2;
      const dist = Math.sqrt((ccx - tx) ** 2 + (ccy - ty) ** 2);
      const tolerance = Math.max(t.w, t.h) * 0.8;

    if (dist < tolerance) {
      // 计算偏移量（匹配构件中心 → 目标中心）
      const dx = tx - matchedComp.x;
      const dy = ty - matchedComp.y;

      // 吸附匹配构件到目标位置（构件坐标是中心点，目标框坐标是左上角，需对齐中心点）
      matchedComp.x = t.x + t.w / 2;
      matchedComp.y = t.y + t.h / 2;

      // 如果是组拖动，组内所有成员按相同偏移移动，防止折叠
      if (matchedComp.groupId && App.groups[matchedComp.groupId]) {
        for (const memberId of App.groups[matchedComp.groupId]) {
          const member = App.components.find(c => c.id === memberId);
          if (member && member !== matchedComp) {
            member.x += dx;
            member.y += dy;
          }
        }
      }

      g.placedTargets.push(t.compId);
      showHint(`【✓】${t.label} 放置完成！`, 1800);

      advanceGuideIfAllPlaced();
      return true;
    }
  }
  return false;
}

// ========== 插画导出（PNG） ==========
function exportSVG() {
  const exportW = 1920;
  const exportH = 1080;

  // 创建导出专用 canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportW;
  exportCanvas.height = exportH;
  const ctx = exportCanvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, exportW, exportH);

  // 计算居中偏移
  const offsetX = (exportW - App.width) / 2;
  const offsetY = (exportH - App.height) / 2;

  // 保存当前交互状态，避免 hover/drag 效果混入导出图
  const savedHover = App.hoverComponent;
  const savedDrag = App.draggingComponent;
  const savedPaintDrag = App.draggingPaint;
  App.hoverComponent = null;
  App.draggingComponent = null;
  App.draggingPaint = null;

  // 绘制每个构件
  for (const comp of App.components) {
    const savedX = comp.x;
    const savedY = comp.y;
    comp.x = savedX + offsetX;
    comp.y = savedY + offsetY;
    drawComponent(ctx, comp);
    comp.x = savedX;
    comp.y = savedY;
  }

  // 恢复交互状态
  App.hoverComponent = savedHover;
  App.draggingComponent = savedDrag;
  App.draggingPaint = savedPaintDrag;

  // 标题
  ctx.fillStyle = '#2b2118';
  ctx.font = 'bold 32px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('榫合万象', exportW / 2, 60);

  ctx.fillStyle = '#8c7e6d';
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillText(`营造值：${App.score} | 已解锁彩画：${App.unlockedPatterns.length}`, exportW / 2, 90);

  // 导出 PNG
  const url = exportCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `Mortise-Cosmos_${new Date().toLocaleDateString().replace(/\//g, '-')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showHint('插画已导出为PNG文件');
}

// ========== 键盘快捷键 ==========
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') {
    App.useMouse = !App.useMouse;
    showHint(App.useMouse ? '已切换为鼠标模式' : '已切换为手势模式');
  }
  if (e.key === 'r' || e.key === 'R') {
    resetBuild();
  }
});
