# Academy PDF

- [项目简介](academy-project-brief.pdf)
- [宇树科技「天才少年」计划项目申请书](unitree-genius-application.pdf)

文案分别来自[项目简介](../../docs/project-brief.md)和[宇树科技申请书](../../docs/unitree-genius-application.md)。Logo 和配色沿用现有[品牌规范](../../brand-spec.md)。

## 重新生成

需要 Python 3.10+、ReportLab 和支持中文的 TrueType 字体。默认使用 macOS 自带黑体，字体嵌入 PDF。在仓库根目录执行：

```bash
uv run --with reportlab==4.4.9 python scripts/build-project-brief.py
uv run --with reportlab==4.4.9 --with pillow python scripts/build-unitree-application.py
```

申请书封面默认读取 `tmp/pdfs/unitree/academy-home.png`。先按 2.85:1 的可视区域截取当前官网，或通过 `--screenshot` 指定替代图片。

其他系统通过 `--font-regular` 和 `--font-bold` 指定可嵌入的字体。支持 `.ttf`、`.ttc`，字体集合使用第一个字体。

修改后重新渲染各页，检查中文、分页、二维码和链接。
