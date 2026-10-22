# BetterLumi：局域网手机测试

## 启动（Windows PowerShell）

```powershell
cd "C:\path\to\BetterLumi"
npm.cmd run dev
```

Vite 显式监听 0.0.0.0，端口仍为 5173，strictPort 仍为 true。电脑原地址 http://localhost:5173 保持不变。若提示端口占用，先检查是否已有本项目服务；可以直接使用原服务，不要让它换到 5174，也不要终止不明进程。

## 找到电脑 IPv4 地址

```powershell
ipconfig
```

查看已连接的 WLAN / Wi-Fi 适配器的 IPv4 地址，不要选虚拟网卡、VPN 或断开连接的适配器。地址可能随路由器 DHCP 变化，以当时 ipconfig 输出为准。

## 手机打开

1. 手机和电脑连接同一个家庭/可信局域网；电脑保持开机，开发服务保持运行。
2. 在 iPhone Safari 或 Android Chrome 地址栏输入完整地址：
   **http://<电脑的 WLAN IPv4>:5173/**
3. 通用格式为 **http://<电脑的 WLAN IPv4>:5173/**。不要在手机输入 localhost 或 0.0.0.0。
4. 若打不开，先在电脑浏览器打开上述局域网地址。若电脑可访问、手机不可访问，检查访客 Wi-Fi/设备隔离、VPN，以及 Windows 防火墙是否允许 Node.js 通过专用网络。若系统弹出授权，只允许当前可信的专用网络；无需关闭防火墙或配置路由器端口转发。

没有部署到公网，也没有配置公网域名或隧道。

## 数据和来源

IndexedDB 按来源（协议、主机、端口）隔离，且每台设备/浏览器有自己的本地存储。

- 手机 IP 地址下的空数据不表示电脑 localhost 数据丢失。
- 手机、电脑、Safari、Chrome、HTTP、HTTPS 及不同 IP/端口的存储不能自动互通。
- 若希望使用电脑记录测试，可先从电脑主 More → 备份与恢复导出，再将文件传到手机并导入。导入前先备份手机已有数据；不要通过清空存储来排查连接问题。
- 本次没有迁移、重命名或清空数据库，也没有自动复制用户数据。

## 真机检查清单

- 中英文分别打开 Today、Recipes、Pantry、More，确认大标题不溢出。
- 竖屏、横屏、滚动到底部：检查刘海/底部安全区、四个固定导航按钮和最后一条记录可见性。
- 打开新增餐食、食谱、食材及运动弹窗：检查内部滚动、保存/取消和关闭按钮；弹出软键盘后，输入框和主要操作应可触达。
- 切换日历日期、周/月视图，确认记录按日期切换。
- 新建一个测试食材，刷新后确认仍存在；验证零值与未记录不会混淆。仅在独立的测试数据中操作。
- 测试照片选取、替换和移除；相机拍摄、软键盘、拖拽及系统分享需真机确认。

现有 viewport 为 width=device-width, initial-scale=1, viewport-fit=cover；导航与弹窗已使用 safe-area-inset，表单弹窗已有内部滚动和 visualViewport 适配。本轮没有为测试改动视觉设计。

## HTTP 与 PWA 的限制

局域网 HTTP 可以测试页面、记录、图片文件选择和响应式布局，但它不是安全上下文。

- Service Worker 需要 HTTPS（电脑 localhost 有开发例外）；手机的 http://192.168.x.x 不享有该例外。
- 当前 Vite 配置没有启用开发 Service Worker。即使添加到主屏幕，也不能据此确认离线缓存、更新提示和完整安装体验。
- 完整 PWA 测试需要生产构建和手机信任的 HTTPS 证书；这是下一步本地测试配置，不需要公开部署。自签名证书仅点“继续访问”并不等价于已建立可靠的安全上下文。
- 浏览器可能限制剪贴板、相机等安全上下文 API。普通照片文件选择与系统拍摄支持需真机实测。
- 本轮发现 LAN HTTP 下缺少 crypto.randomUUID 会阻止启动，已加入使用 crypto.getRandomValues 的 UUID v4 兼容路径；已有 ID 和记录不变，未使用 Math.random。

可在停止开发服务后，以相同端口查看生产包（仍是 HTTP，不能完整测试离线）：

```powershell
npm.cmd run build
npm.cmd run preview -- --host 0.0.0.0 --port 5173 --strictPort
```

不要同时启动两个占用 5173 的服务。

## 浏览器验证范围

Chrome 的手机视口/触摸模拟可以检查布局、滚动和表单，但不能代替真机软键盘、刘海安全区或 Safari。此 Windows 环境没有 Safari，也没有已安装的 Playwright WebKit 浏览器，因此不会宣称已经通过 Safari/iPhone 真机验证。

## 参考

- [Vite server options](https://vite.dev/config/server-options)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN Crypto.randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
- [MDN Crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)

## 本轮已执行的检查

- http://localhost:5173/ 与 http://<电脑的 WLAN IPv4>:5173/ 均返回 HTTP 200；局域网页面启动后无 JavaScript 异常。
- 确认 5173 已占用时，新的 Vite 实例明确报错而不会切换端口；未停止已有服务。
- TypeScript、代码检查、生产构建通过；构建仍有原有大于 500 kB 的包体积提示。
- 130 项单元测试通过，包括原生 UUID 和不安全上下文兼容路径。
- 4 项 Chrome 手机模拟测试通过（390/430px、中英文），实际使用独立 LAN HTTP 测试来源 <电脑的 WLAN IPv4>:5190；检查导航、零值记录保存/刷新、固定底栏以及缩小至 500px 高度后的弹窗滚动和操作。
- 独立测试上下文没有使用日常浏览器的 localhost:5173 数据。没有 Safari/实体手机或受信任 HTTPS 的安装/离线实测结果。

如需重跑 LAN 浏览器测试（测试数据与日常应用隔离）：

```powershell
$env:BETTERLUMI_LAN_HOST = "<电脑的 WLAN IPv4>"
npx.cmd playwright test tests/mobile-device-lan.spec.ts
```

5190 仅供自动化测试；手机日常手动测试继续使用 5173。
