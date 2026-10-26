# BetterLumi v1.0.1

本地优先的健康日志 PWA，使用 React、TypeScript、Vite、Dexie/IndexedDB 和 i18next，无后端或登录。

## 在 Windows 运行

```powershell
cd "C:\path\to\BetterLumi"
npm.cmd ci
npm.cmd run dev
```

也可双击 Start-BetterLumi.cmd。开发地址固定为 http://localhost:5173；端口已被占用时会报错，不会自动换端口。IndexedDB 按站点来源隔离，因此访问不同主机名或端口会看到不同的本地数据。

## 手机局域网测试

开发服务监听局域网，保留 5173 和 strictPort。手机与电脑连接同一 Wi-Fi 后访问 `http://<电脑的 WLAN IPv4>:5173/`。完整 Windows 命令、数据来源隔离、HTTP/PWA 限制和真机检查步骤见 [手机测试说明](docs/mobile-device-testing.md)。

## 当前功能和数据约定

- 四个底部入口：Today、Recipes、Pantry、More；日历已集成到 Today。
- 食谱支持制作份数、每份营养、照片、分类和独立餐食快照；包含一款静态内置博洛尼亚肉酱宽面。显示取整不改变内部营养精度，旧餐食保留保存时的快照。
- Pantry 将 32 项静态内置食材与用户食材组合浏览，支持来源说明、默认/自定义标签、搜索、营养参考量和食用单位换算；内置数据不写入用户食材表。
- 内置运动提供七类运动、15 个强度预设及 MET 估算，支持手动热量和可编辑训练标签；历史记录保存最终数值与来源快照。
- Calculator 支持实时饮食/运动规划、均衡/高蛋白宏量分配和显式应用到当前个人目标，保留历史版本。
- 运动计划支持周期安排和完成记录，关联实际运动日志；实际记录与计划估值分开计算。
- 营养目标支持每日/周均及允许偏差设置；运动目标支持每日/周总量，保留独立生效日期和目标版本。
- 补充剂、体重、待办笔记、中文/英文和四套主题均本地持久保存。Today 使用固定的编辑式品牌封面。
- IndexedDB 当前版本为 6；主界面导出 JSON 备份格式为 BetterLumi version 9，支持读取版本 2–9。兼容层与既有迁移继续保留。不要重命名数据库或清空存储来解决界面问题。

## 开发检查

```powershell
npm.cmd run typecheck
npm.cmd run check:code
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
npm.cmd run preview
```

TypeScript 同时检查未使用的局部变量和参数。check:code 检查应用模块可达性及中英文字面量翻译引用，不自动删除动态键或兼容路径。项目目前没有配置 ESLint。

浏览器测试使用独立 Chrome 上下文，不使用日常浏览器的 localhost:5173 数据。本轮完整浏览器验证尚未通过，发布状态为 **NOT READY TO PUBLISH**；具体结果、失败文件及复现注意事项见 [发布验证](docs/publication-validation.md)。勿通过改回旧界面、删除测试或放宽数据断言让测试通过。

predev / prebuild 会准备本地 OCR 资源。node_modules、dist、work、测试产物及生成的 public/ocr 均不纳入 Git。

生产 PWA 和离线功能需运行生产构建并通过 HTTPS 提供（桌面 localhost 可用于测试）；iPhone Safari 安装和离线体验仍需真机验证。请定期导出 JSON 备份。

## 维护基线

原始开发仓库在本地私密保留 v1.0.1 标签、backup/v1.0.1 分支和 maintenance/v1.0.1-cleanup 维护历史。公开仓库从经过隐私清理的当前源码快照开始，不包含这些私人开发提交或引用。package.json 中的历史包版本号仍为 0.1.0，本轮没有进行发布元数据升级。

根目录其余中文更新说明记录历史迭代，可能包含已被后续需求取代的布局说明；以当前源码和维护报告为准。

## GitHub 与未来部署

计划使用仓库名 **BetterLumi**。本项目不需要后端、登录凭据或环境变量即可本地运行。`package.json` 的 `private: true` 用于防止误发到 npm，并不决定 GitHub 仓库是否公开。

首次上传前的隐私检查、Git 历史注意事项和部署约定见 [发布准备说明](docs/github-preparation.md)。健康记录存在浏览器 IndexedDB 中，不随源码上传；导出的 JSON 备份可能包含完整私人记录和图片，请存放在仓库外。`.gitignore` 已排除应用默认备份文件名和常见本地数据目录，但不能替代人工检查。

静态部署的安装命令为 `npm ci`，构建命令为 `npm run build`，输出目录为 `dist`。当前资源和 PWA 路径以域名根目录为基础，适合 `https://your-domain.example/`；GitHub Pages 的 `/BetterLumi/` 子路径需要另行适配，不能直接假定可用。站点需配置单页应用路由回退并使用 HTTPS，完整验证 PWA 后再公开。

更换域名或协议会更换浏览器存储来源，不会自动搬迁 localhost 的记录。如需迁移，在应用内导出并导入私人备份，不要把备份提交到 Git。
