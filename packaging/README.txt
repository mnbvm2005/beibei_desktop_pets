杯杯打包工具

在仓库根目录执行以下命令。需要 Python 3.9+、Node.js 22+、npm。
Mac 发行包必须在 macOS 上构建，需要系统 codesign 工具。
Windows 包可以在 Mac 上构建；这里的资源编辑脚本不需要 Wine。

1. 安装打包工具依赖

  cd packaging
  npm install
  cd ..

2. 从官方 Electron Release 下载运行时和校验清单

固定版本：Electron 44.7.0（与 app/package.json 一致）。
官方下载页：https://github.com/electron/electron/releases/tag/v44.7.0
下载放入 .cache/downloads/。以下命令仅下载构建所需文件：

  mkdir -p .cache/downloads
  curl -fL --retry 3 -o .cache/downloads/SHASUMS256.txt https://github.com/electron/electron/releases/download/v44.7.0/SHASUMS256.txt
  curl -fL --retry 3 -o .cache/downloads/electron-v44.7.0-win32-x64.zip https://github.com/electron/electron/releases/download/v44.7.0/electron-v44.7.0-win32-x64.zip
  curl -fL --retry 3 -o .cache/downloads/electron-v44.7.0-darwin-arm64.zip https://github.com/electron/electron/releases/download/v44.7.0/electron-v44.7.0-darwin-arm64.zip

只构建一个平台时，只需下载该平台的 ZIP 和 SHASUMS256.txt。
package.py 会先根据官方清单核验 SHA256，不匹配时停止。
runtime-provenance.json 记录原始发行包使用的运行时来源与已核验哈希；
原始下载使用镜像传输、官方 SHA 清单核对。重新构建默认使用上述官方地址。

3. 构建

  python3 packaging/package.py --platform win
  python3 packaging/package.py --platform mac

或在 macOS 上同时构建：

  python3 packaging/package.py --platform all

只验证并解压运行时：

  python3 packaging/package.py --platform all --extract-only

运行时下载：.cache/downloads/
运行时解压：.cache/runtime/
临时构建目录：.cache/staging/
输出 ZIP 与 SHA256：dist/

脚本从 app/ 复制应用，从 docs/usage.txt 复制完整说明；
README-win.txt / README-mac.txt 会成为各平台包中的“使用说明.txt”。
Electron LICENSE 和 Chromium 许可证会保留在运行包内。

Windows 图标与版本资源由 set-windows-resources.mjs 写入，依赖 resedit 3.1.0
和 pe-library 2.0.1。写出后重新解析 PE，检查非资源节与原始运行时完全一致。
Node 默认从 PATH 查找，也可通过 BEIBEI_NODE 环境变量指定可执行文件。

Mac 使用本地 ad-hoc 签名并执行 codesign --verify --deep --strict；
这不是 Apple Developer ID 签名或公证。Windows 也没有商业 Authenticode 签名。
Windows 包尚未通过 Windows 真机验证。

将 dist/ 中的 ZIP 和 .sha256 文件上传到 GitHub Release 的 Assets；
不要把运行时缓存、node_modules、.app 或大运行包提交到源码仓库。
