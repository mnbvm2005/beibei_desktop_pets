#!/usr/bin/env python3
"""Package the local Beibei application with checksum-verified Electron runtimes.

Run from any directory: python3 packaging/package.py [--platform all|win|mac]
Runtime downloads and extraction live in .cache/, never in the application sources.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import stat
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = '44.7.0'
PRODUCT = '杯杯'
BUNDLE_ID = 'org.beibei.pet'
APP = ROOT / 'app'
DOWNLOADS = ROOT / '.cache' / 'downloads'
RUNTIME = ROOT / '.cache' / 'runtime'
STAGING = ROOT / '.cache' / 'staging'
OUTPUTS = ROOT / 'dist'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def verify_runtime(platform: str) -> Path:
    name = f'electron-v{VERSION}-{platform}.zip'
    path = DOWNLOADS / name
    lines = (DOWNLOADS / 'SHASUMS256.txt').read_text().splitlines()
    checksums = {line.split()[-1].lstrip('*'): line.split()[0] for line in lines if line.strip()}
    expected = checksums.get(name)
    if not expected:
        raise RuntimeError(f'Official SHASUMS256.txt has no entry for {name}')
    actual = sha256(path)
    if actual != expected:
        raise RuntimeError(f'Checksum mismatch: {name}: {actual} != {expected}')
    return path


def extract_runtime(platform: str) -> Path:
    archive = verify_runtime(platform)
    target = RUNTIME / platform
    marker = target / '.verified-electron.json'
    checksum = sha256(archive)
    if marker.exists():
        record = json.loads(marker.read_text())
        if record.get('sha256') == checksum:
            return target
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    with zipfile.ZipFile(archive) as z:
        for member in z.infolist():
            path = target / member.filename
            if not path.resolve().is_relative_to(target.resolve()):
                raise RuntimeError(f'Unsafe archive path: {member.filename}')
            mode = member.external_attr >> 16
            if member.is_dir():
                path.mkdir(parents=True, exist_ok=True)
                if mode:
                    path.chmod(stat.S_IMODE(mode))
            elif stat.S_ISLNK(mode):
                path.parent.mkdir(parents=True, exist_ok=True)
                link = z.read(member).decode('utf-8')
                if not (path.parent / link).resolve().is_relative_to(target.resolve()):
                    raise RuntimeError(f'Unsafe archive symlink: {member.filename}')
                path.symlink_to(link)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                with z.open(member) as src, path.open('wb') as dst:
                    shutil.copyfileobj(src, dst)
                if mode:
                    path.chmod(stat.S_IMODE(mode))
    marker.write_text(json.dumps({'version': VERSION, 'sha256': checksum}, indent=2) + '\n')
    return target


def copy_app(resources: Path) -> None:
    target = resources / 'app'
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(APP, target, ignore=shutil.ignore_patterns('.DS_Store', 'node_modules', '.git', '*.log'))
    package = target / 'package.json'
    metadata = json.loads(package.read_text())
    metadata['productName'] = PRODUCT
    package.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    default_app = resources / 'default_app.asar'
    if default_app.exists():
        default_app.unlink()


def zip_tree(root: Path, output: Path) -> None:
    # Unix mode bits and symlinks are explicit so executable permissions survive.
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for path in sorted(root.rglob('*')):
            relative = path.relative_to(root.parent).as_posix()
            info = zipfile.ZipInfo.from_file(path, relative)
            info.create_system = 3
            mode = path.lstat().st_mode
            info.external_attr = mode << 16
            if path.is_symlink():
                info = zipfile.ZipInfo(relative)
                info.create_system = 3
                info.external_attr = mode << 16
                z.writestr(info, os.readlink(path))
            elif path.is_file():
                z.write(path, relative)
            elif path.is_dir():
                z.writestr(info, b'')


def add_readme(target: Path, platform: str) -> None:
    full_guide = ROOT / 'docs' / 'usage.txt'
    if full_guide.exists():
        shutil.copy2(full_guide, target / '杯杯-使用说明.txt')
    custom = ROOT / 'packaging' / f'README-{platform}.txt'
    if custom.exists():
        shutil.copy2(custom, target / '使用说明.txt')
    else:
        text = ('杯杯桌宠\n\nWindows：先解压整个文件夹，再双击 Beibei.exe。不要只复制 exe；旁边的资源文件是程序的一部分。\n' if platform == 'win' else
                '杯杯桌宠\n\nMac（Apple 芯片）：将 杯杯.app 拖入“应用程序”，然后打开。\n')
        text += '\n操作：拖拽杯杯把它拎起来，松手让它落下；右键打开菜单，退出也在菜单里。\n'
        text += '\n此版本没有商业代码签名。仅从你信任的人那里接收此压缩包。\n'
        (target / '使用说明.txt').write_text(text)


def package_win() -> Path:
    runtime = extract_runtime('win32-x64')
    target = STAGING / f'{PRODUCT}-Windows-x64'
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(runtime, target, symlinks=True, ignore=shutil.ignore_patterns('.verified-electron.json'))
    icon = APP / 'icon.ico'
    original_exe = target / 'electron.exe'
    output_exe = target / 'Beibei.exe'
    if icon.exists():
        node = os.environ.get('BEIBEI_NODE') or shutil.which('node')
        if not node:
            raise RuntimeError('Node.js is required for the Windows icon. Install Node.js or set BEIBEI_NODE.')
        metadata = json.loads((APP / 'package.json').read_text())
        subprocess.run([node, str(ROOT / 'packaging' / 'set-windows-resources.mjs'),
                        str(original_exe), str(output_exe), str(icon),
                        metadata.get('version', '1.0.0')], check=True)
        original_exe.unlink()
    else:
        original_exe.rename(output_exe)
    copy_app(target / 'resources')
    add_readme(target, 'win')
    output = OUTPUTS / f'{PRODUCT}-Windows-x64.zip'
    zip_tree(target, output)
    return output


def package_mac() -> Path:
    if sys.platform != 'darwin':
        raise RuntimeError('Build the Mac distribution on macOS to ad-hoc sign the changed application bundle.')
    runtime = extract_runtime('darwin-arm64')
    target = STAGING / f'{PRODUCT}-Mac-Apple芯片'
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    bundle = target / f'{PRODUCT}.app'
    shutil.copytree(runtime / 'Electron.app', bundle, symlinks=True)
    resources = bundle / 'Contents' / 'Resources'
    copy_app(resources)
    for name in ('LICENSE', 'LICENSES.chromium.html', 'version'):
        original = runtime / name
        if original.exists():
            shutil.copy2(original, target / name)
    info_path = bundle / 'Contents' / 'Info.plist'
    with info_path.open('rb') as f:
        info = plistlib.load(f)
    app_metadata = json.loads((APP / 'package.json').read_text())
    info.update(CFBundleDisplayName=PRODUCT, CFBundleName=PRODUCT,
                CFBundleIdentifier=BUNDLE_ID,
                CFBundleShortVersionString=app_metadata.get('version', '1.0.0'),
                CFBundleVersion=app_metadata.get('version', '1.0.0'),
                LSUIElement=True)
    icon = APP / 'icon.icns'
    if icon.exists():
        shutil.copy2(icon, resources / 'Beibei.icns')
        info['CFBundleIconFile'] = 'Beibei.icns'
    with info_path.open('wb') as f:
        plistlib.dump(info, f)
    # Re-sign modified metadata/resources. This is local ad-hoc signing, not
    # Apple Developer ID signing or notarization, and needs no signing account.
    subprocess.run(['/usr/bin/codesign', '--force', '--deep', '--sign', '-', str(bundle)], check=True)
    subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(bundle)], check=True)
    add_readme(target, 'mac')
    output = OUTPUTS / f'{PRODUCT}-Mac-Apple芯片.zip'
    if output.exists():
        output.unlink()
    # Write standard UTF-8 filename flags as well as Unix modes and symlinks;
    # ditto's legacy ZIP names can appear garbled in non-Apple ZIP readers.
    zip_tree(target, output)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', choices=['all', 'win', 'mac'], default='all')
    parser.add_argument('--extract-only', action='store_true')
    args = parser.parse_args()
    platforms = ['win', 'mac'] if args.platform == 'all' else [args.platform]
    if args.extract_only:
        for platform in platforms:
            print(extract_runtime('win32-x64' if platform == 'win' else 'darwin-arm64'), flush=True)
        return
    package = APP / 'package.json'
    if not package.exists():
        raise RuntimeError(f'Application package missing: {package}')
    metadata = json.loads(package.read_text())
    entry = metadata.get('main', 'index.js')
    if not (APP / entry).is_file():
        raise RuntimeError(f'Application entry point missing: {entry}')
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    STAGING.mkdir(parents=True, exist_ok=True)
    for platform in platforms:
        output = package_win() if platform == 'win' else package_mac()
        digest = sha256(output)
        output.with_suffix(output.suffix + '.sha256').write_text(f'{digest}  {output.name}\n')
        print(f'{output}  {output.stat().st_size:,} bytes  sha256:{digest}', flush=True)


if __name__ == '__main__':
    main()
