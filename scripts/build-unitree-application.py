import argparse
import re
from html import escape
from pathlib import Path

from reportlab.lib.colors import black
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]


def inline(source):
    text = escape(source.strip(), quote=False)
    text = text.replace(
        r"$\operatorname{sat}(6)=30$",
        "<i>sat</i>(6) = 30",
    ).replace(
        r"$\operatorname{sat}(7)=55$",
        "<i>sat</i>(7) = 55",
    )
    text = re.sub(
        r"&lt;(https?://[^&]+)&gt;",
        lambda match: f'<a href="{match.group(1)}">{match.group(1)}</a>',
        text,
    )
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        r'<a href="\2">\1</a>',
        text,
    )
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r'<font name="Courier">\1</font>', text)
    return text


def parse_blocks(source):
    lines = source.splitlines()
    blocks = []
    index = 0
    while index < len(lines):
        line = lines[index].rstrip()
        if not line or line.startswith("<!--"):
            index += 1
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            blocks.append(("heading", level, line[level:].strip()))
            index += 1
            continue
        if re.match(r"^[-*] ", line):
            items = []
            while index < len(lines) and re.match(
                r"^[-*] ", lines[index].strip()
            ):
                items.append(lines[index].strip()[2:])
                index += 1
            blocks.append(("list", items))
            continue
        paragraph = [line]
        index += 1
        while index < len(lines):
            candidate = lines[index].rstrip()
            if (
                not candidate
                or candidate.startswith("#")
                or candidate.startswith("<!--")
                or re.match(r"^[-*] ", candidate.strip())
            ):
                break
            paragraph.append(candidate)
            index += 1
        blocks.append(("paragraph", " ".join(paragraph)))
    return blocks


def create_styles():
    body = ParagraphStyle(
        "Body",
        fontName="Academy",
        fontSize=10.5,
        leading=17,
        textColor=black,
        wordWrap="CJK",
        spaceAfter=8,
        allowWidows=0,
        allowOrphans=0,
    )
    return {
        "body": body,
        "h1": ParagraphStyle(
            "Heading 1",
            parent=body,
            fontName="AcademyBold",
            fontSize=18,
            leading=24,
            spaceBefore=8,
            spaceAfter=8,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "Heading 2",
            parent=body,
            fontName="AcademyBold",
            fontSize=12.5,
            leading=18,
            spaceBefore=7,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=body,
            leftIndent=15,
            firstLineIndent=-10,
            spaceAfter=3,
        ),
    }


def build(source, output, styles):
    story = []
    for block in parse_blocks(source.read_text(encoding="utf-8")):
        if block[0] == "heading":
            style = styles["h1" if block[1] == 1 else "h2"]
            story.append(Paragraph(inline(block[2]), style))
        elif block[0] == "paragraph":
            story.append(Paragraph(inline(block[1]), styles["body"]))
        elif block[0] == "list":
            for item in block[1]:
                story.append(
                    Paragraph(f"•&nbsp;&nbsp;{inline(item)}", styles["bullet"])
                )
            story.append(Spacer(1, 2))

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".building.pdf")
    document = SimpleDocTemplate(
        str(temporary),
        pagesize=A4,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
        title="Academy 项目申请书",
        author="陈家治",
        subject="宇树科技「天才少年」计划项目申请",
        creator="lailai's Academy",
    )
    document.build(story)
    temporary.replace(output)


def main():
    parser = argparse.ArgumentParser(description="Build the Academy application PDF.")
    parser.add_argument(
        "--source",
        type=Path,
        default=ROOT / "docs/unitree-genius-application.md",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "output/pdf/unitree-genius-application.pdf",
    )
    parser.add_argument(
        "--font-regular",
        type=Path,
        default=Path("/System/Library/Fonts/STHeiti Light.ttc"),
    )
    parser.add_argument(
        "--font-bold",
        type=Path,
        default=Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    )
    args = parser.parse_args()
    for name, path in (
        ("Academy", args.font_regular),
        ("AcademyBold", args.font_bold),
    ):
        if not path.is_file():
            parser.error(f"Chinese font not found: {path}")
        pdfmetrics.registerFont(TTFont(name, str(path), subfontIndex=0))
    pdfmetrics.registerFontFamily(
        "Academy",
        normal="Academy",
        bold="AcademyBold",
    )
    build(args.source, args.output, create_styles())
    print(f"Built {args.output}")


if __name__ == "__main__":
    main()
