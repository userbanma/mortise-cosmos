/**
 * 榫合万象 - 主应用逻辑
 * 阶段一：基础环境 + 摄像头 + 画布初始化
 */

// ========== 全局状态 ==========
const App = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  video: null,
  cameraActive: false,

  // 交互状态
  hand: { x: 0, y: 0, pinching: false, visible: false, wasPinching: false },
  mouse: { x: 0, y: 0, down: false },
  useMouse: false, // 默认使用手势，手势不可见时回退到鼠标

  // MediaPipe
  hands: null,
  camera: null,

  // 构件系统
  components: [],
  draggingComponent: null,
  hoverComponent: null,
  dragOffset: { x: 0, y: 0 },
  dragGroupOffset: {}, // 组内各构件相对于拖拽构件的偏移

  // 构件组系统（搭建建筑用）
  groups: {}, // { groupId: [compId1, compId2, ...] }
  nextGroupId: 1,

  // 营造系统
  score: 0,
  matchedPairs: [],
  unlockedPatterns: [],
  errorCount: {},

  // 彩画
  patterns: [],

  // 提示
  hintTimer: null,

  // 阶段任务系统
  currentStage: 1,          // 当前阶段 1=引导阶段 2=自由搭建
  currentTask: 1,           // 阶段一中的子任务 1~3
  task1Done: false,         // 任务一：燕尾榫×燕尾卯嵌合
  task2Done: false,         // 任务二：直榫×直卯嵌合
  task3Done: false,         // 任务三：立柱
  phase1Done: false,        // 阶段一全部完成
  phase2Done: false,        // 阶段二完成（全部构件用完）
};

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

// ========== MediaPipe 手势识别初始化 ==========
async function initMediaPipe() {
  // 检查 MediaPipe 是否加载
  if (typeof Hands === 'undefined') {
    throw new Error('MediaPipe Hands 库未加载');
  }

  // 先手动启动摄像头
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720, facingMode: 'user' }
  });
  App.video.srcObject = stream;
  await new Promise(resolve => {
    App.video.onloadedmetadata = () => resolve();
  });
  await App.video.play();
  App.cameraActive = true;

  // 初始化 Hands
  App.hands = new Hands({
    locateFile: (file) => {
      // 从 CDN 加载 MediaPipe 模型文件（无需本地 lib/ 目录）
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
    }
  });

  App.hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: false  // 关闭自拍镜像，由CSS统一控制画面翻转
  });

  App.hands.onResults(onHandsResults);

  // 使用 requestAnimationFrame 循环发送视频帧给 Hands
  // 添加 processing 标志防止并发调用导致 WASM 崩溃
  let processing = false;
  async function sendFrame() {
    if (!processing && App.cameraActive && App.video.readyState >= 2) {
      processing = true;
      try {
        await App.hands.send({ image: App.video });
      } catch (err) {
        console.error('MediaPipe send error:', err);
      }
      processing = false;
    }
    requestAnimationFrame(sendFrame);
  }
  sendFrame();

  showHint('【阶段一 · 任务一】请将燕尾榫拖向燕尾卯完成嵌合。其余构件已锁定。');
  console.log('[MediaPipe] 手势识别已初始化，请举起手测试');
}

// ========== 手势坐标映射（补偿 object-fit:cover 裁剪） ==========
// object-fit:cover 会保持视频比例并裁剪超出部分来填满容器
// MediaPipe 返回的坐标是基于完整视频帧的 (0-1)，需要映射到屏幕坐标
function mapHandToScreen(normX, normY) {
  const vw = App.video.videoWidth || 1280;
  const vh = App.video.videoHeight || 720;

  // 视频原始宽高比
  const videoRatio = vw / vh;
  // 屏幕宽高比
  const screenRatio = App.width / App.height;

  let offsetX = 0, offsetY = 0, renderW = App.width, renderH = App.height;

  if (videoRatio > screenRatio) {
    // 视频比屏幕宽 → 左右被裁剪
    renderH = App.height;
    renderW = App.height * videoRatio;
    offsetX = (App.width - renderW) / 2;
  } else {
    // 视频比屏幕高 → 上下被裁剪
    renderW = App.width;
    renderH = App.width / videoRatio;
    offsetY = (App.height - renderH) / 2;
  }

  // 先映射到 cover 渲染区域内的像素坐标
  const px = offsetX + normX * renderW;
  const py = offsetY + normY * renderH;

  // CSS scaleX(-1) 翻转，x 坐标需要镜像
  const screenX = App.width - px;
  const screenY = py;

  return { x: screenX, y: screenY };
}

// ========== MediaPipe 结果回调 ==========
function onHandsResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8];   // 食指指尖
    const thumbTip = landmarks[4];   // 拇指指尖

    // 调试：首次检测到手时打印日志
    if (!App.hand.visible) {
      console.log('[MediaPipe] 检测到手，食指原始坐标:', indexTip.x.toFixed(3), indexTip.y.toFixed(3));
    }

    // MediaPipe 返回基于视频原始尺寸的归一化坐标 (0-1)
    // 需要补偿 object-fit:cover 裁剪带来的偏移
    const mapped = mapHandToScreen(indexTip.x, indexTip.y);
    const x = mapped.x;
    const y = mapped.y;

    // 计算捏合距离（食指与拇指的屏幕距离）
    const thumbMapped = mapHandToScreen(thumbTip.x, thumbTip.y);
    const pinchDist = Math.hypot(x - thumbMapped.x, y - thumbMapped.y);
    const isPinching = pinchDist < 40; // 40像素阈值

    App.hand.x = x;
    App.hand.y = y;
    App.hand.pinching = isPinching;
    App.hand.visible = true;
    App.useMouse = false; // 手势可见时优先使用手势

    // 将手势事件转换为交互事件
    if (isPinching && !App.hand.wasPinching) {
      triggerPointerDown(x, y);
    } else if (isPinching && App.hand.wasPinching) {
      triggerPointerMove(x, y);
    } else if (!isPinching && App.hand.wasPinching) {
      triggerPointerUp();
    }

    App.hand.wasPinching = isPinching;

    // 更新手势光标
    updateHandCursor(x, y, isPinching);
  } else {
    // 手消失时，如果正在拖拽则释放
    if (App.hand.wasPinching) {
      triggerPointerUp();
      App.hand.wasPinching = false;
    }
    App.hand.visible = false;
    App.useMouse = true; // 回退到鼠标
  }
}

// ========== 构件初始化 ==========
function initComponents() {
  const cx = App.width / 2;
  const cy = App.height / 2;

  App.components = [
    {
      id: 'zhitui_01', name: '直榫', type: 'tenon',
      category: '柱枋节点',
      x: cx - 200, y: cy,
      width: 120, height: 50,
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
      x: cx + 200, y: cy,
      width: 120, height: 50,
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
      x: cx - 200, y: cy + 120,
      width: 140, height: 55,
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
      x: cx + 200, y: cy + 120,
      width: 140, height: 55,
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
      x: cx, y: cy - 150,
      width: 50, height: 120,
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
    return true;
  }
  return false;
}

function triggerPointerDown(x, y) {
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
  if (App.draggingComponent) {
    // 放下时进行匹配检测
    checkMatchOnRelease(App.draggingComponent);
  }
  App.draggingComponent = null;
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
    return;
  }

  if (!comp.rules || comp.rules.mateWith.length === 0) return;

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
      return;
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
}

// 柱吸附到组合体：形成柱+梁的T型结构
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

// ========== 彩画解锁 ==========
function checkPatternUnlock() {
  for (const pattern of App.patterns) {
    if (App.unlockedPatterns.includes(pattern.id)) continue;
    if (App.score >= pattern.unlockScore) {
      App.unlockedPatterns.push(pattern.id);
      showHint(`【彩画解锁】${pattern.name} —— ${pattern.description}`, 4000);
    }
  }
}

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
      const order = { tenon: 0, mortise: 1, structure: 2 };
      return (order[ca?.type] || 0) - (order[cb?.type] || 0);
    });
    for (const id of sorted) {
      const comp = App.components.find(c => c.id === id);
      if (comp) { drawComponent(ctx, comp); drawn.add(id); }
    }
  }
  // 画未匹配的构件
  for (const comp of App.components) {
    if (!drawn.has(comp.id)) {
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

  requestAnimationFrame(renderLoop);
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
  // 柱：带斗状柱头与覆盆柱础的立柱
  const capH = h * 0.1;
  const baseH = h * 0.1;
  const capW1 = w * 1.5;   // 柱头顶宽
  const capW2 = w * 1.15;  // 柱头底宽
  const baseW1 = w * 1.15; // 柱础顶宽
  const baseW2 = w * 1.5;  // 柱础底宽
  const bodyTop = -h/2 + capH;
  const bodyBot = h/2 - baseH;

  ctx.beginPath();
  // 左上柱头顶
  ctx.moveTo(-capW1/2, -h/2);
  ctx.lineTo(capW1/2, -h/2);
  // 右下收至柱身
  ctx.lineTo(capW2/2, bodyTop);
  ctx.lineTo(w/2, bodyTop + 2);
  // 柱身右侧
  ctx.lineTo(w/2, bodyBot - 2);
  // 右下柱础
  ctx.lineTo(baseW1/2, bodyBot);
  ctx.lineTo(baseW2/2, h/2);
  ctx.lineTo(-baseW2/2, h/2);
  // 左下柱础
  ctx.lineTo(-baseW1/2, bodyBot);
  ctx.lineTo(-w/2, bodyBot - 2);
  // 柱身左侧
  ctx.lineTo(-w/2, bodyTop + 2);
  // 左上收至柱头
  ctx.lineTo(-capW2/2, bodyTop);
  ctx.closePath();
}

function drawEaveShape(ctx, w, h) {
  // 屋檐：梯形，上窄下宽
  const topW = w * 0.6;
  ctx.beginPath();
  ctx.moveTo(-topW / 2, -h / 2);
  ctx.lineTo(topW / 2, -h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(-w / 2, h / 2);
  ctx.closePath();
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

  // 柱：斗状柱头线 + 覆盆柱础线 + 纵向木纹
  if (comp.id === 'zhu_01' || comp.id.startsWith('p2_zhu_')) {
    ctx.strokeStyle = 'rgba(43,33,24,0.14)';
    ctx.lineWidth = 1;
    const capH = h * 0.1;
    const baseH = h * 0.1;
    const bodyTop = -h/2 + capH;
    const bodyBot = h/2 - baseH;
    ctx.beginPath();
    ctx.moveTo(-w * 0.6, bodyTop);
    ctx.lineTo(w * 0.6, bodyTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.6, bodyBot);
    ctx.lineTo(w * 0.6, bodyBot);
    ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 8, bodyTop + 4);
      ctx.lineTo(i * 8, bodyBot - 4);
      ctx.stroke();
    }
  }

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

  // 绘制已解锁的彩画装饰
  if (comp.matched) {
    drawPatternOverlay(ctx, comp, halfW, halfH);
  }

  // 悬停时绘制传统文化注释气泡
  if (isHover && comp.briefNote) {
    drawNoteBubble(ctx, comp, halfW, halfH);
  }

  ctx.restore();
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
  // 根据已解锁彩画绘制简单装饰
  if (App.unlockedPatterns.includes('hexi_01')) {
    ctx.strokeStyle = 'rgba(196, 165, 116, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-halfW + 5, -halfH + 5);
    ctx.lineTo(-halfW + 15, -halfH + 5);
    ctx.lineTo(-halfW + 15, -halfH + 15);
    ctx.stroke();
  }
  if (App.unlockedPatterns.includes('xuanzi_01')) {
    ctx.fillStyle = 'rgba(143, 188, 143, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
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
    { w: 100, h: 40, label: '小' },
    { w: 130, h: 50, label: '中' },
    { w: 160, h: 55, label: '大' },
    { w: 200, h: 65, label: '特大' },
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
    { w: 110, h: 45, label: '小' },
    { w: 150, h: 55, label: '中' },
    { w: 190, h: 65, label: '大' },
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
      briefNote: '口阔腹窄，请君入瓮。',
      origin: '燕尾卯需逆燕尾之形而凿。',
      rules: { mateWith: ['p2_yw_' + si], tolerance: 90, angleTolerance: 15 },
      color: '#7a6548', groupId: null, sizeKey: 'yw' + si,
    });
  });

  // 柱（3根，不同高度）
  const pillarH = [100, 140, 180];
  pillarH.forEach((ph, si) => {
    App.components.push({
      id: 'p2_zhu_' + si, name: '柱(高' + ph + ')', type: 'structure',
      category: '自由搭建', x: cx - 50 + si * 80, y: 80,
      width: 45, height: ph, rotation: 0, matched: false,
      unlocks: [], description: '立柱 - 高' + ph,
      briefNote: '木秀于林，柱立于堂。',
      origin: '柱之称谓始于殷墟。',
      rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
      color: '#a08060', groupId: null,
    });
  });

  // 屋檐（2个，梯形）
  App.components.push({
    id: 'p2_wy_0', name: '屋檐(左)', type: 'eave',
    category: '自由搭建', x: cx - 120, y: 80,
    width: 180, height: 50, rotation: 0, matched: false,
    unlocks: [], description: '飞檐翘角，翼角起翘，为传统建筑之冠冕。',
    briefNote: '飞檐如翼，凌空展翅。',
    origin: '屋檐做法始于先秦，至唐宋臻于成熟。',
    rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
    color: '#7a5c3a', groupId: null,
  });

  App.components.push({
    id: 'p2_wy_1', name: '屋檐(右)', type: 'eave',
    category: '自由搭建', x: cx + 120, y: 80,
    width: 180, height: 50, rotation: 0, matched: false,
    unlocks: [], description: '飞檐翘角，与左檐对称呼应。',
    briefNote: '翼角对飞，气韵生动。',
    origin: '檐角起翘之制，见于南方建筑。',
    rules: { mateWith: [], tolerance: 0, angleTolerance: 0 },
    color: '#7a5c3a', groupId: null,
  });

  showHint('【阶段二 - 自由搭建】用各种构件自由搭建传统木构建筑！按R键可旋转构件。');
}

function resetBuild() {
  App.score = 0;
  App.matchedPairs = [];
  App.unlockedPatterns = [];
  App.errorCount = {};
  App.groups = {};
  App.nextGroupId = 1;
  App.dragGroupOffset = {};
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

// ========== SVG 导出 ==========
function exportSVG() {
  const w = 1920;
  const h = 1080;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  svg += `<rect width="100%" height="100%" fill="#f4f1ea"/>`;

  // 计算居中偏移
  const offsetX = (w - App.width) / 2;
  const offsetY = (h - App.height) / 2;

  for (const comp of App.components) {
    const cx = comp.x + offsetX;
    const cy = comp.y + offsetY;
    const halfW = comp.width / 2;
    const halfH = comp.height / 2;

    svg += `<g transform="translate(${cx}, ${cy}) rotate(${comp.rotation})">`;
    svg += `<rect x="${-halfW}" y="${-halfH}" width="${comp.width}" height="${comp.height}" rx="4" fill="${comp.matched ? '#c4a574' : comp.color}" stroke="${comp.matched ? '#e8c97a' : '#4a3728'}" stroke-width="2"/>`;
    svg += `<text x="0" y="0" text-anchor="middle" dominant-baseline="central" fill="#2b2118" font-size="14" font-weight="bold">${comp.name}</text>`;
    if (comp.matched) {
      svg += `<circle cx="${halfW - 10}" cy="${-halfH + 10}" r="6" fill="#2e5c4f"/>`;
    }
    svg += `</g>`;
  }

  // 标题
  svg += `<text x="${w/2}" y="60" text-anchor="middle" fill="#2b2118" font-size="32" font-weight="bold" font-family="serif">榫合万象</text>`;
  svg += `<text x="${w/2}" y="90" text-anchor="middle" fill="#8c7e6d" font-size="14">营造值：${App.score} | 已解锁彩画：${App.unlockedPatterns.length}</text>`;

  svg += `</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `榫合万象_${new Date().toLocaleDateString().replace(/\//g, '-')}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showHint('插画已导出为SVG文件');
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
