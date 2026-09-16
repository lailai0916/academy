# Academy 项目简介 PDF

[打开 PDF](academy-project-brief.pdf)。

文案来自[项目简介](../../docs/project-brief.md)。Logo 和配色沿用现有[品牌规范](../../brand-spec.md)，正文连续排版，按内容自动分页。

## 重新生成

需要 Python 3.10+、ReportLab 和支持中文的 TrueType 字体。默认使用 macOS 自带黑体，字体嵌入 PDF。在仓库根目录执行：

```bash
uv run --with reportlab==4.4.9 python scripts/build-project-brief.py
```

其他系统通过 `--font-regular` 和 `--font-bold` 指定可嵌入的字体。支持 `.ttf`、`.ttc`，字体集合使用第一个字体。

生成器读取标题、日期、二级标题和正文，支持加粗与网页链接。生成失败时保留原 PDF。修改后重新渲染各页，检查中文、分页和链接。
