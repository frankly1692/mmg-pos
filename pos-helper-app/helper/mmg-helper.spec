# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('../.venv/Lib/site-packages/escpos/capabilities.json', 'escpos'),
    ],
    hiddenimports=[
        'escpos',
        'escpos.printer',
        'escpos.exceptions',
        'escpos.capabilities',
        'escpos.tabulate',
        'escpos.image',
        'websockets',
        'websockets.asyncio',
        'websockets.asyncio.server',
        'websockets.legacy',
        'websockets.legacy.server',
        'serial',
        'serial.tools',
        'serial.tools.list_ports',
        'pystray',
        'pystray._win32',
        'tkinter',
        'tkinter.ttk',
        'tkinter.messagebox',
        'pydash',
        'pytz',
        'PIL',
        'PIL.Image',
        'qrcode',
        'qrcode.image.base',
        'qrcode.image.pure',
        'barcode',
        'barcode.writer',
    ] + collect_submodules('websockets'),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['setuptools', 'pip', 'wheel', 'pkg_resources'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='mmg-helper',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # tray app: no console window; logs go to helper.log
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
