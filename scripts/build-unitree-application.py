import argparse
import re
from html import escape
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = A4
MARGIN = 54
INK = HexColor("#1d1d1f")
MUTED = HexColor("#6e6e73")
LINE = HexColor("#d2d2d7")
LINK = HexColor("#0066cc")
SURFACE = HexColor("#f5f5f7")


def read_pages(path):
    source = path.read_text(encoding="utf-8").strip()
    return [page.strip() for page in source.split("<!-- page -->")]


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
        lambda match: (
            f'<a href="{match.group(1)}" color="#0066cc">{match.group(1)}</a>'
        ),
        text,
    )
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        r'<a href="\2" color="#0066cc">\1</a>',
        text,
    )
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r'<font name="Courier">\1</font>', text)
    return text


def parse_blocks(page):
    lines = page.splitlines()
    output = []
    index = 0
    while index < len(lines):
        line = lines[index].rstrip()
        if not line:
            index += 1
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            output.append(("heading", level, line[level:].strip()))
            index += 1
            continue
        if line.startswith("|"):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                row = [
                    cell.strip()
                    for cell in lines[index].strip().strip("|").split("|")
                ]
                rows.append(row)
                index += 1
            if len(rows) > 1 and all(
                re.fullmatch(r":?-{3,}:?", cell) for cell in rows[1]
            ):
                rows.pop(1)
            output.append(("table", rows))
            continue
        if re.match(r"^[-*] ", line):
            items = []
            while index < len(lines) and re.match(r"^[-*] ", lines[index].strip()):
                items.append(lines[index].strip()[2:])
                index += 1
            output.append(("list", items))
            continue
        paragraph = [line]
        index += 1
        while index < len(lines):
            candidate = lines[index].rstrip()
            if (
                not candidate
                or candidate.startswith("#")
                or candidate.startswith("|")
                or re.match(r"^[-*] ", candidate.strip())
            ):
                break
            paragraph.append(candidate)
            index += 1
        output.append(("paragraph", " ".join(paragraph)))
    return output


def create_styles():
    body = ParagraphStyle(
        "Body",
        fontName="Academy",
        fontSize=10.5,
        leading=17,
        textColor=INK,
        wordWrap="CJK",
        spaceAfter=9,
        allowWidows=0,
        allowOrphans=0,
    )
    return {
        "body": body,
        "h1": ParagraphStyle(
            "H1",
            parent=body,
            fontName="AcademyBold",
            fontSize=24,
            leading=32,
            spaceAfter=18,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=body,
            fontName="AcademyBold",
            fontSize=14,
            leading=20,
            spaceBefore=9,
            spaceAfter=7,
            keepWithNext=True,
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=body,
            fontSize=9.5,
            leading=15,
            textColor=MUTED,
            spaceAfter=15,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=body,
            leftIndent=15,
            firstLineIndent=-10,
            bulletIndent=0,
            spaceAfter=4,
        ),
        "table": ParagraphStyle(
            "Table",
            parent=body,
            fontSize=9,
            leading=13,
            spaceAfter=0,
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=body,
            fontName="AcademyBold",
            fontSize=9,
            leading=13,
            spaceAfter=0,
        ),
    }


def render_table(rows, width, styles):
    data = []
    for row_index, row in enumerate(rows):
        style = styles["table_head" if row_index == 0 else "table"]
        data.append([Paragraph(inline(cell), style) for cell in row])
    columns = len(rows[0])
    widths = [width * 0.73, width * 0.27] if columns == 2 else [width / columns] * columns
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
                ("LINEBELOW", (0, 0), (-1, 0), 0.8, LINE),
                ("LINEBELOW", (0, 1), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def page_story(page, page_index, width, styles):
    story = []
    for block_index, block in enumerate(parse_blocks(page)):
        if block[0] == "heading":
            level, content = block[1], block[2]
            story.append(
                Paragraph(
                    inline(content),
                    styles["h1" if level == 1 else "h2"],
                )
            )
        elif block[0] == "paragraph":
            style = (
                styles["meta"]
                if page_index == 0 and block_index == 1
                else styles["body"]
            )
            story.append(Paragraph(inline(block[1]), style))
        elif block[0] == "list":
            for item in block[1]:
                story.append(
                    Paragraph(
                        f"•&nbsp;&nbsp;{inline(item)}",
                        styles["bullet"],
                    )
                )
            story.append(Spacer(1, 2))
        elif block[0] == "table":
            story.extend(
                [
                    render_table(block[1], width, styles),
                    Spacer(1, 9),
                ]
            )
    return story


def build(source, output, styles):
    pages = read_pages(source)
    if len(pages) != 3:
        raise ValueError(f"Expected three pages, found {len(pages)}.")
    content_width = WIDTH - 2 * MARGIN
    story = []
    for page_index, page in enumerate(pages):
        if page_index:
            story.append(PageBreak())
        story.extend(page_story(page, page_index, content_width, styles))

    def decorate(canvas, document):
        page_number = document.page
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        if page_number > 1:
            canvas.setFont("Academy", 8)
            canvas.setFillColor(MUTED)
            canvas.drawString(MARGIN, HEIGHT - 35, "Academy 项目申请书")
            canvas.line(MARGIN, HEIGHT - 43, WIDTH - MARGIN, HEIGHT - 43)
        canvas.line(MARGIN, 40, WIDTH - MARGIN, 40)
        canvas.setFont("Academy", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN, 26, "陈家治 · 浙江省杭州第二中学")
        canvas.drawRightString(WIDTH - MARGIN, 26, f"{page_number} / 3")
        canvas.restoreState()

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".building.pdf")
    document = SimpleDocTemplate(
        str(temporary),
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=58,
        bottomMargin=52,
        title="Academy 项目申请书",
        author="陈家治",
        subject="宇树科技「天才少年」计划项目申请",
        creator="lailai's Academy",
    )
    document.build(story, onFirstPage=decorate, onLaterPages=decorate)
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
    for name, path in (("Academy", args.font_regular), ("AcademyBold", args.font_bold)):
        if not path.is_file():
            parser.error(f"Chinese font not found: {path}")
        pdfmetrics.registerFont(TTFont(name, str(path), subfontIndex=0))
    pdfmetrics.registerFontFamily(
        "Academy",
        normal="Academy",
        bold="AcademyBold",
    )
    styles = create_styles()
    build(args.source, args.output, styles)
    print(f"Built {args.output}")


if __name__ == "__main__":
    main()
