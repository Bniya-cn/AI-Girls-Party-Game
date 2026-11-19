# 星屿骰夜

2–5 名玩家围桌进行一轮骰子投放练习。大厅进入、围桌席位、可点击的六张场地牌、房主扩展设置和桌边操作共用同一个权威房间状态。规则基于 [Las Vegas Royale 说明书第 2–4、7 页](https://www.ravensburger.org/spielanleitungen/ecm/Spielanleitungen/26918%20%20anl%202362054.pdf?ossl=pds_text_Spielanleitung)。

## 开一桌

需要 Node 22.12 或更新版本。在本目录运行：

```sh
npm ci
npm run build
npm test
npm start
```

进入 [本机桌游室](http://127.0.0.1:4321/)。创建房间后点房间码可复制。测试第二个玩家时，从普通窗口和隐私窗口分别入座。房主在「桌面设置」选择人数、关闭灰骰板或将它接到任意一个场地；全员准备后开始。房主先手是本版线上约定。

本服务仅监听 IPv4 回环地址。静态站点与 WebSocket 共用端口，在 macOS/Linux 可用 `PORT=4322 npm start` 改端口。按 Ctrl+C 停止。

## 桌上操作

- 每人 7 小骰、1 大骰和 2 筹码。两人局增加独立的中立阵营。掷出所有手骰，点击亮起的场地，全数放置相同点数的骰子。大骰的场地实力为 2。
- 掷后可以付一枚筹码跳过。启用 F1 时，投到该场地后选择一整组灰骰，再点击目标场地。灰骰与双人中立骰单独统计。
- 键盘可用 Tab 选牌、Enter 或空格投放。触屏可直接点牌。非行动时点击场地可查阵营与实力。本轮结束后仍能查看每个场地。
- 当前范围是一轮投放。纸币配对、平手剔除和派奖、跨轮与最终胜负均待实现。另 15 面扩展列在房主抽屉内，服务端拒绝启用。标准随机三板、原版与 Boulevard 尚待实现。

## 结构与联机

| 位置 | 职责 |
| --- | --- |
| rules/engine.js、modules.js、block-it.js | 纯状态变更、合法性、模块与 F1 结算前投放 |
| server/rooms.js、http.js、start.js | 房间和席位、服务端骰值、回环静态服务和 WebSocket |
| web/transport.js | 按窗口存储席位凭证、未确认请求和断线重连 |
| web/main.js、index.html、style.css | 昵称与房间码、桌边 HUD、场地目标和设置浮层 |
| web/table.js、models.js、art.js | 三维牌桌、模型替换和插画选择 |
| test/ | 规则、模型加载、真实双客户端协议与静态资源测试 |

每个命令携带动作 ID 和修订号。服务端验证身份和阶段，按房间顺序提交；重发已处理的近期命令会返回原回执。回合动作均由服务端决定，动画只读公开状态。断线会暂停对局，同一窗口恢复原座位。房间与回执在内存中，重启服务无法恢复，全员离线约一小时后会清理。

## 自备美术与模型

未安装图片时，程序会绘制独立的场景、桌游棋子与场地标识。可在本地 `web/public/art/` 放入有权使用的 WebP，再重新构建。每个槽位独立回退：

| 槽位文件名 | 用途 |
| --- | --- |
| evening.webp、host.webp | 横幅环境、透明大厅立牌 |
| venue-1.webp 至 venue-6.webp | 六张实际桌面牌板的透明插画 |
| seat-deepseek.webp、seat-claude.webp、seat-gemini.webp、seat-gpt.webp、seat-qwen.webp | 五个座位的透明头像，按座号分配 |
| f1.webp、chip.webp、star.webp、back.webp | 灰骰板、筹码、星形标记、空座位 |
| empty.webp、ribbons.webp | 等人空态、轮末彩带 |

桌布使用程序织纹。三维不可用时，平面插画牌桌仍支持相同操作。用自有模型时将文件置于 `web/public/models/`，在 `web/models.js` 的 modelPaths 登记 `table`、`venue`、`tile.F1`、`chip` 或骰子键（例如 `die.0.6`），再构建。坐标 Y 向上，骰面与键名一致；模型缺失时保留几何体。优先使用自带纹理的 GLB。
