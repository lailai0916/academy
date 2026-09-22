# Academy PDF

- [项目简介](academy-project-brief.pdf)
- [宇树科技「天才少年」计划项目申请书](unitree-genius-application.pdf)

文案分别来自[项目简介](../../docs/project-brief.md)和[宇树科技申请书](../../docs/unitree-genius-application.md)。项目简介沿用现有[品牌规范](../../brand-spec.md)；申请书只按 Markdown 的标题、段落和列表生成 A4 文档。

## 重新生成

需要 Python 3.10+ 和 Google Chrome。申请书使用系统网页字体，中文为苹方简体，英文与数字为 SF Pro。在仓库根目录执行：

```bash
uv run --with reportlab==4.4.9 python scripts/build-project-brief.py
python3 scripts/build-unitree-application.py
```

其他系统通过 `--chrome` 指定 Chrome 可执行文件。

修改后重新渲染各页，检查中文、分页和链接。
