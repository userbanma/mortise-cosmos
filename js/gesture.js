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
    
    // 迟滞阈值：捏合 < 35px 才算捏住，松开 > 50px 才算松开
    // 中间状态保持上一次的状态，防止抖动
    let isPinching = App.hand.pinching;
    if (pinchDist < 35) {
      isPinching = true;
    } else if (pinchDist > 55) {
      isPinching = false;
    }

    App.hand.x = x;
    App.hand.y = y;
    App.hand.pinching = isPinching;
    App.hand.visible = true;
    App.useMouse = false; // 手势可见时优先使用手势

    // 将手势事件转换为交互事件
    if (isPinching && !App.hand.wasPinching) {
      // 检测是否捏合在按钮上
      const btn = getButtonAt(x, y);
      if (btn) {
        btn.click();
      } else {
        triggerPointerDown(x, y);
      }
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
