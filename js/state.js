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
  hand: { x: 0, y: 0, pinching: false, visible: false, wasPinching: false, pinchStableCount: 0 },
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
  hexiPatternImg: null,       // 和玺彩画素材图片对象
  xuanziPatternImg: null,     // 旋子彩画素材图片对象

  // 雀替：左右分别用对应方向的素材
  quetiLeftImg: null,        // 左侧雀替素材图片
  quetiRightImg: null,       // 右侧雀替素材图片

  // 屋檐
  wuImg: null,               // 屋檐素材图片

  // 彩画托盘（左侧颜料区）
  paintPalette: [],           // [{id, name, patternId, x, y, w, h, unlocked, color}]
  draggingPaint: null,        // 当前拖动的颜料对象

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

  // 搭建引导
  buildGuide: null,          // null=未启动, { step, total, completed, stepIds, placedTargets }
  buildGuideTargets: [],     // [{ x, y, w, h, compId, label }] 当前步骤的目标位置
};

