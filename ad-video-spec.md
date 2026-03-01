# Claude Code Canvas — 30 秒廣告影片技術規格

## 影片基本資訊

- 名稱：One Canvas, Many Agents
- 時長：30 秒（900 frames @ 30fps）
- 解析度：1920×1080 (16:9)，另需 1080×1080 (1:1) 版本給 Twitter
- FPS：30
- 風格：Motion Graphics / 純文字動畫（無旁白配音）
- 背景音樂：節奏感強的電子/科技風配樂（需要自行準備 mp3）

---

## 色彩系統

所有顏色需定義為常數：

| 名稱 | HEX | 用途 |
|------|-----|------|
| bg-dark | #0F0F0F | 開場暗色背景 |
| bg-canvas | #F8F9FA | 畫布背景色 |
| pod-blue | #3B82F6 | Pod 卡片 - Analyst |
| pod-coral | #F97316 | Pod 卡片 - Developer |
| pod-pink | #EC4899 | Pod 卡片 - Reviewer |
| pod-green | #22C55E | Pod 卡片 - Tester |
| connection-line | #6366F1 | 連接線顏色（靛藍色） |
| particle-glow | #818CF8 | 連線上流動的光粒子 |
| text-primary | #FFFFFF | 暗背景上的主文字 |
| text-dark | #1F2937 | 亮背景上的主文字 |
| text-accent | #A78BFA | 強調文字（紫色） |
| success-green | #22C55E | 完成勾勾的顏色 |
| terminal-green | #4ADE80 | 終端機文字顏色 |
| cursor-blink | #4ADE80 | 終端機游標顏色 |

---

## 專案結構

```
ad-video/
├── src/
│   ├── Root.tsx                    # Composition 定義（16:9 和 1:1）
│   ├── AdVideo.tsx                 # 主影片組件，用 Series 組合所有場景
│   ├── scenes/
│   │   ├── Scene1_Terminal.tsx     # 0-3 秒：終端機痛點場景
│   │   ├── Scene2_Transition.tsx   # 3-5 秒：碎裂轉場
│   │   ├── Scene3_FirstPod.tsx     # 5-8 秒：第一個 Pod 彈入
│   │   ├── Scene4_BuildFlow.tsx    # 8-14 秒：快節奏建立工作流
│   │   ├── Scene5_Execute.tsx      # 14-20 秒：工作流執行動畫
│   │   ├── Scene6_Complete.tsx     # 20-24 秒：鳥瞰完成畫面
│   │   └── Scene7_Logo.tsx        # 24-30 秒：Logo + CTA
│   ├── components/
│   │   ├── Pod.tsx                 # Pod 卡片組件
│   │   ├── ConnectionLine.tsx      # 連接線 + 光粒子組件
│   │   ├── Terminal.tsx            # 終端機模擬組件
│   │   ├── TypewriterText.tsx      # 打字機效果文字組件
│   │   ├── ParticleFlow.tsx        # 連線上流動光粒子
│   │   ├── CheckMark.tsx           # 完成勾勾動畫
│   │   └── Logo.tsx               # 產品 Logo 組件
│   ├── constants/
│   │   └── colors.ts              # 色彩常數定義
│   └── styles/
│       └── tailwind.css           # Tailwind 樣式
├── public/
│   ├── background-music.mp3       # 背景音樂（需自備）
│   └── logo.svg                   # 產品 Logo SVG
├── remotion.config.ts
├── package.json
└── tsconfig.json
```

---

## 逐場景詳細規格

### Scene 1：終端機痛點（Frame 0-90，共 3 秒）

**目的**：用模擬終端機展示「手動在多個 Agent 之間複製貼上」的痛苦。

**畫面描述**：
- 全螢幕暗色背景 (#0F0F0F)
- 畫面中央偏上，有一個終端機視窗（帶圓角、頂部有紅黃綠三個圓點）
- 終端機視窗尺寸：寬 800px，高 300px，圓角 12px
- 終端機背景色：#1A1A2E，邊框：1px solid #333
- 頂部欄高 36px，三個圓點直徑 12px，間距 8px，顏色：#FF5F57 #FFBD2E #28CA42

**動畫時間軸**：

| Frame | 動畫 |
|-------|------|
| 0-5 | 終端機視窗從 opacity 0 fade in 到 opacity 1（interpolate, [0,5], [0,1]） |
| 5 | 游標開始閃爍（每 15 frame 切換可見/不可見） |
| 5-25 | 第一行文字逐字打出：`> Ask Agent A to analyze requirements...`（每 frame 打出 1-2 個字元，用 terminal-green 色） |
| 25-30 | 停頓，游標繼續閃爍 |
| 30-35 | 第二行文字逐字打出：`> Copy output...`（速度稍快） |
| 35-40 | 停頓 |
| 40-50 | 第三行文字逐字打出：`> Paste to Agent B...`（速度稍快） |
| 50-55 | 停頓 |
| 55-65 | 第四行文字逐字打出：`> Ask Agent B to implement...`（速度稍快） |
| 65-70 | 停頓 |
| 70-80 | 第五行文字快速打出：`> Copy output... paste to Agent C... repeat...` |
| 80-90 | 整個終端機畫面開始微微震動（translateX 隨機在 -2px 到 2px 之間抖動），暗示挫折感 |

**文字樣式**：
- 字體：monospace（使用 font-family: 'Courier New', monospace）
- 字號：18px
- 行高：28px
- 左邊距 20px
- 每行前面有 `> ` 前綴，顏色 #666

---

### Scene 2：碎裂轉場（Frame 90-150，共 2 秒）

**目的**：戲劇性的轉場，從痛點切換到產品畫面。

**畫面描述**：
- 前 15 幀（90-105）：終端機畫面碎裂效果
- 後 15 幀（105-120）：白色畫布從中心擴張出現
- 最後 30 幀（120-150）：文字 "There's a better way." 淡入

**動畫時間軸**：

| Frame | 動畫 |
|-------|------|
| 90-105 | **碎裂效果**：將終端機畫面分成 4x3 的格子（12 塊），每一塊用 spring 動畫同時進行：(1) 隨機方向位移（translateX/Y 100-300px）(2) 隨機旋轉（rotate 15-45deg）(3) scale 從 1 縮到 0.3 (4) opacity 從 1 到 0。每塊的 spring config: damping: 12, stiffness: 100。用 clip-path 切割每一塊。 |
| 105-120 | **畫布展開**：一個白色圓形從畫面中心開始，clipPath 用 circle()，半徑從 0 擴張到 150%（用 interpolate，easing: Easing.bezier(0.25, 0.1, 0.25, 1)），直到覆蓋整個畫面。背景色切換為 bg-canvas (#F8F9FA) |
| 120-150 | 文字 **"There's a better way."** 從畫面中央淡入。字體：sans-serif (Inter 或系統字體)，字號：56px，顏色 text-dark，font-weight: 600。動畫：opacity interpolate [120,135] [0,1]，同時 translateY interpolate [120,135] [30,0]。在 frame 150 附近開始 fade out（opacity interpolate [140,150] [1,0]） |

---

### Scene 3：第一個 Pod 彈入（Frame 150-240，共 3 秒）

**目的**：展示產品的核心視覺元素 — Pod 卡片。

**畫面描述**：
- 乾淨的淺色畫布背景 (#F8F9FA)
- 背景有淡淡的格點圖案（dot grid），圓點顏色 #E5E7EB，間距 30px，圓點半徑 1.5px
- 一個 Pod 卡片從畫面中心彈入

**Pod 卡片設計規格**：
- 尺寸：寬 220px，高 140px
- 圓角：16px
- 背景色：白色 #FFFFFF
- 邊框：2px solid，顏色取決於 Pod 類型（此處為 pod-blue #3B82F6）
- 陰影：0 4px 24px rgba(0,0,0,0.08)
- 卡片頂部有 8px 高的色條（滿寬，取 Pod 顏色）
- 卡片內容區域（padding 16px）：
  - 第一行：Pod 名稱，字號 18px，font-weight 700，顏色 text-dark
  - 第二行：模型標籤，小圓角標籤（padding 2px 8px，圓角 4px，背景色為 Pod 顏色的 10% 透明度，文字顏色為 Pod 顏色），字號 12px，內容如 "Opus"
  - 底部：狀態指示器，一個小圓點（8px）+ 文字 "idle"，圓點顏色 #9CA3AF（灰色）

**動畫時間軸**：

| Frame | 動畫 |
|-------|------|
| 150-155 | 畫布背景已就位（dot grid 靜態顯示） |
| 155-180 | Pod 卡片「Analyst」用 **spring** 動畫彈入。初始狀態：scale(0), opacity 0, translateY(50px)。spring config: fps: 30, damping: 10, mass: 0.8, stiffness: 180。scale 從 0 到 1，opacity 0 到 1，translateY 50 到 0 |
| 180-200 | Pod 彈入完成後，模型標籤 "Opus" 用小的 spring 動畫出現（scale 0→1，delay 比 Pod 晚 5 frames） |
| 200-240 | Pod 靜止展示。底部狀態圓點和文字微微呼吸動畫（opacity 在 0.5-1 之間用 sin 波動） |

**Pod 在畫布上的位置**：
- 此場景中，Pod 在畫面正中央（left: 50%, top: 50%, transform: translate(-50%, -50%)）

---

### Scene 4：快節奏建立工作流（Frame 240-420，共 6 秒）

**目的**：展示多個 Pod 依序出現並用連線串接，是影片的核心段落。

**畫面描述**：
- 畫布上已有 Analyst Pod（從 Scene 3 延續）
- 依序出現 Developer、Reviewer、Tester 三個 Pod
- 每個 Pod 出現後，從前一個 Pod 拉出連接線

**四個 Pod 的最終位置（畫面座標）**：
- Analyst：x: 250, y: 350（偏左上）
- Developer：x: 650, y: 250（中上）
- Reviewer：x: 1050, y: 350（偏右上）
- Tester：x: 1450, y: 250（右上）

**注意**：Scene 3 結束時 Analyst 在中央，Scene 4 開始時需要用 interpolate 將 Analyst 滑動到最終位置。

**各 Pod 的顏色和標籤**：
- Analyst：pod-blue #3B82F6，模型 "Opus"
- Developer：pod-coral #F97316，模型 "Sonnet"
- Reviewer：pod-pink #EC4899，模型 "Sonnet"
- Tester：pod-green #22C55E，模型 "Haiku"

**連接線設計規格**：
- 線條：SVG path，從前一個 Pod 右邊中點到下一個 Pod 左邊中點
- 路徑形狀：三次貝茲曲線（cubic bezier），控制點讓線條有自然弧度
- 線寬：3px
- 顏色：connection-line #6366F1
- 線條上有一個小標籤，寫著 "Auto"（背景 #EEF2FF，文字 #6366F1，字號 11px，圓角 4px，padding 2px 6px），位於曲線中點

**動畫時間軸**：

| Frame | 動畫 |
|-------|------|
| 240-260 | Analyst Pod 從畫面中央用 interpolate 滑動到最終位置 x:250, y:350。easing: Easing.bezier(0.25, 0.1, 0.25, 1) |
| 260-285 | Developer Pod 用 spring 彈入到 x:650, y:250（同 Scene 3 的 Pod 彈入方式） |
| 270-295 | 連接線 Analyst→Developer：用 SVG path 的 stroke-dasharray + stroke-dashoffset 動畫，線條從 Analyst 端「畫」向 Developer 端（25 frames 完成）。使用 evolvePath 或 dashoffset 技術 |
| 295-300 | "Auto" 標籤在連線中點用 scale spring 彈出 |
| 300-325 | Reviewer Pod 用 spring 彈入到 x:1050, y:350 |
| 310-335 | 連接線 Developer→Reviewer 動畫畫出 |
| 335-340 | "Auto" 標籤彈出 |
| 340-365 | Tester Pod 用 spring 彈入到 x:1450, y:250 |
| 350-375 | 連接線 Reviewer→Tester 動畫畫出 |
| 375-380 | "Auto" 標籤彈出 |
| 380-420 | 文字 **"Drag. Connect. Automate."** 在畫面底部中央逐詞出現。每個詞間隔 10 frames：(1) "Drag." frame 380 spring 彈入 (2) "Connect." frame 390 spring 彈入 (3) "Automate." frame 400 spring 彈入。字號 42px，font-weight 700，顏色 text-dark #1F2937。每個詞用 spring scale 0→1 彈入 |

---

### Scene 5：工作流執行動畫（Frame 420-600，共 6 秒）

**目的**：展示所有 Agent 自動執行、資料自動在 Pod 之間傳遞的視覺效果。

**畫面描述**：
- 接續 Scene 4 的畫布佈局（4 個 Pod + 3 條連線）
- "Drag. Connect. Automate." 文字先淡出
- Pod 依序進入執行狀態，連線上有光粒子流動

**Pod 執行狀態視覺**：
- idle 狀態：圓點灰色 #9CA3AF，文字 "idle"
- chatting 狀態：圓點改為綠色 #22C55E 並有脈衝動畫（scale 在 1-1.5 之間 sin 波動 + opacity 0.5-1），文字改為 "chatting..."，整個 Pod 卡片邊框改為 Pod 顏色 + 外發光效果（box-shadow: 0 0 20px rgba(Pod顏色, 0.3)）
- done 狀態：圓點改為 success-green #22C55E（靜態），右上角出現一個綠色勾勾 ✓

**光粒子流動效果**：
- 在連線的 SVG path 上，有一個圓形光點（半徑 6px，顏色 particle-glow #818CF8，帶模糊發光 filter: blur(4px)）
- 光點沿著 path 從起點移動到終點，用 interpolate 控制 offset
- 移動週期：40 frames 從頭到尾
- 光點後面可以有一個拖尾效果（3 個漸次變小變淡的圓點跟在後面，間隔 5% offset）

**動畫時間軸**：

| Frame | 動畫 |
|-------|------|
| 420-435 | "Drag. Connect. Automate." 文字 fade out（opacity 1→0） |
| 425 | 畫面上方出現文字 **"Agents talk to each other — automatically."**（opacity 0→1，translateY 20→0，duration 15 frames）。字號 36px，font-weight 600，顏色 text-dark，位置：top: 80px, 水平置中 |
| 430 | Analyst Pod 進入 chatting 狀態（邊框發光 + 狀態圓點脈衝） |
| 430-480 | Analyst 執行中（50 frames 模擬執行時間） |
| 480 | Analyst 完成，狀態改為 done（勾勾用 spring 彈出，damping: 15） |
| 480-520 | 連線 1（Analyst→Developer）光粒子開始流動（40 frames） |
| 520 | Developer Pod 進入 chatting 狀態 |
| 520-560 | Developer 執行中 |
| 560 | Developer 完成，狀態改為 done |
| 550-590 | 連線 2（Developer→Reviewer）光粒子開始流動 |
| 575 | Reviewer Pod 進入 chatting 狀態 |
| 575-600 | Reviewer 開始執行（繼續到 Scene 6） |

---

### Scene 6：鳥瞰完成（Frame 600-720，共 4 秒）

**目的**：展示整個工作流完成的全景，給人「大功告成」的滿足感。

**畫面描述**：
- 承接 Scene 5，Reviewer 完成後 Tester 也完成
- 畫面逐漸縮小（zoom out），讓使用者看到完整的工作流全景
- 所有 Pod 都顯示完成狀態

**動畫時間軸**：

| Frame | 動畫 |
|-------|------|
| 600-610 | Reviewer 完成，done 狀態 |
| 600-640 | 連線 3（Reviewer→Tester）光粒子流動 |
| 630 | Tester 進入 chatting 狀態 |
| 630-660 | Tester 執行中 |
| 660 | Tester 完成，所有 4 個 Pod 都是 done 狀態 |
| 660-690 | **鳥瞰 zoom out**：整個畫布內容用 scale 從 1.0 縮小到 0.75（interpolate，easing: Easing.bezier(0.25, 0.1, 0.25, 1)），讓畫面有更多留白 |
| 680-720 | 文字 **"From idea to done. One canvas."** 在畫面下方中央淡入。字號 40px，font-weight 700，顏色 text-dark。動畫：opacity [680,700] [0,1]，translateY [680,700] [20,0] |
| 700-720 | 所有 Pod 的成功勾勾做一次統一的 pulse 動畫（scale 1→1.3→1，用 spring） |

---

### Scene 7：Logo + CTA（Frame 720-900，共 6 秒）

**目的**：品牌展示和行動召喚。

**畫面描述**：
- 前面的畫布內容淡出
- 產品 Logo 和名稱從中央出現
- 安裝指令和 GitHub 連結出現在下方

**Logo 設計**（如果沒有 Logo SVG，用文字代替）：
- 主標題："Claude Code Canvas"
- 字體：sans-serif，font-weight 800，字號 64px
- "Claude" 顏色 text-accent #A78BFA，"Code Canvas" 顏色 text-dark #1F2937
- 副標題："Your Multi-Agent Workspace"
- 字號 24px，font-weight 400，顏色 #6B7280

**CTA 區域**：
- 安裝指令框：背景 #1A1A2E，圓角 12px，padding 12px 24px
- 指令文字：`curl -fsSL https://... | sh`，monospace 字體，字號 18px，顏色 terminal-green
- 右邊有一個複製 icon（可選）

**動畫時間軸**：

| Frame | 動畫 |
|-------|------|
| 720-740 | 前場景（畫布 + Pod + 文字）一起 fade out（opacity 1→0） |
| 735-740 | 背景色從 bg-canvas 漸變到白色 #FFFFFF |
| 745-775 | 主標題 "Claude Code Canvas" 用 spring 彈入（scale 0→1，damping: 12）。"Claude" 先出現（frame 745），"Code Canvas" 跟隨出現（frame 755），有輕微的 stagger 效果 |
| 775-795 | 副標題 "Your Multi-Agent Workspace" 從下方滑入淡入（translateY 15→0，opacity 0→1，duration 15 frames） |
| 800-820 | 安裝指令框從下方滑入（translateY 20→0，opacity 0→1） |
| 820-900 | 所有元素靜態展示，主標題有微微的 glow 動畫（text-shadow 的 blur 在 10px-20px 之間 sin 波動，顏色 rgba(167, 139, 250, 0.3)） |

---

## 背景音樂規格

- 風格：電子/科技感（lo-fi tech beat 或 minimal electronic）
- BPM：建議 100-120（配合畫面節奏）
- 音量：0.3-0.5（不要太大聲，因為是純文字動畫為主）
- 淡入：前 1 秒 volume 從 0 到目標值
- 淡出：最後 2 秒 volume 從目標值到 0
- 推薦找免費商用音樂：Pixabay Music, Uppbeat, Mixkit

---

## Remotion 技術實作備註

### 初始化專案
```bash
npx create-video@latest ad-video
cd ad-video
npm install @remotion/tailwind-v4 tailwindcss
```

### Root.tsx 定義
需要定義兩個 Composition：
1. `ad-16-9`：1920×1080, 30fps, 900 frames
2. `ad-1-1`：1080×1080, 30fps, 900 frames（用 useVideoConfig 動態調整佈局）

### 核心 API 使用
- `useCurrentFrame()` — 取得當前影格
- `useVideoConfig()` — 取得 fps, width, height
- `interpolate(frame, inputRange, outputRange, { extrapolateRight: 'clamp' })` — 所有 interpolate 都要加 clamp 避免超出範圍
- `spring({ frame, fps, config })` — Pod 彈入、文字彈出等彈簧動畫
- `Sequence` — 包裹各場景，設定 from 和 durationInFrames
- `AbsoluteFill` — 每個場景的根容器
- `Series` — 在主組件中順序排列場景

### SVG Path 動畫
連接線使用 SVG `<path>` 元素，用 `stroke-dasharray` + `stroke-dashoffset` 做畫線動畫：
```
strokeDasharray = pathLength
strokeDashoffset = interpolate(frame, [startFrame, endFrame], [pathLength, 0], { extrapolateRight: 'clamp' })
```

### 光粒子效果
用 SVG `<circle>` 元素，位置透過 `getPointAtLength()` 沿著連線 path 移動。需要先用 `getTotalLength()` 取得路徑總長度。

### 渲染指令
```bash
# 16:9 版本
npx remotion render src/index.ts ad-16-9 out/ad-16-9.mp4

# 1:1 版本
npx remotion render src/index.ts ad-1-1 out/ad-1-1.mp4
```

---

## 注意事項

1. 所有 `interpolate` 呼叫都要加上 `{ extrapolateRight: 'clamp' }` 防止值溢出
2. 字體使用系統字體即可：`font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`，終端機部分用 `'Courier New', monospace`
3. 1:1 版本需要調整 Pod 位置（垂直排列而非水平），文字字號可能需要稍微縮小
4. 碎裂效果如果太複雜，可以簡化為：畫面快速 zoom in + blur + fade out 再切換到白色背景
