import argparse
import base64
import io
import re
import xml.etree.ElementTree as ET
from html import escape
from pathlib import Path

from PIL import Image
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = A4
MARGIN = 48
BLUE = HexColor("#0071e3")
BLUE_SOFT = HexColor("#eaf4ff")
INK = HexColor("#1d1d1f")
MUTED = HexColor("#6e6e73")
LINE = HexColor("#d9d9de")
SURFACE = HexColor("#f5f5f7")
GREEN = HexColor("#248a3d")
ORANGE = HexColor("#b25f00")


def load_logo():
    root = ET.parse(ROOT / "apps/web/public/brand/logo.svg").getroot()
    node = root.find(".//{http://www.w3.org/2000/svg}image")
    if node is None:
        raise ValueError("The brand SVG must contain an embedded PNG.")
    data = node.attrib["{http://www.w3.org/1999/xlink}href"]
    return ImageReader(io.BytesIO(base64.b64decode(data.split(",", 1)[1])))


def read_pages(path):
    source = path.read_text(encoding="utf-8").strip()
    return [page.strip() for page in source.split("<!-- page -->")]


def inline(source):
    source = source.strip()
    text = escape(source, quote=False)
    text = text.replace(
        r"$\operatorname{sat}(6)=30$",
        "<i>sat</i>(6) = 30",
    ).replace(
        r"$\operatorname{sat}(7)=55$",
        "<i>sat</i>(7) = 55",
    )
    text = re.sub(
        r"&lt;(https?://[^&]+)&gt;",
        lambda match: f'<a href="{match.group(1)}" color="#0071e3">{match.group(1)}</a>',
        text,
    )
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        r'<a href="\2" color="#0071e3">\1</a>',
        text,
    )
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r'<font name="Courier">\1</font>', text)
    return text


def blocks(page):
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
            table = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                table.append(cells)
                index += 1
            if len(table) > 1 and all(re.fullmatch(r":?-{3,}:?", cell) for cell in table[1]):
                table.pop(1)
            output.append(("table", table))
            continue
        if re.match(r"^[-*] ", line):
            items = []
            while index < len(lines) and re.match(r"^[-*] ", lines[index].strip()):
                items.append(lines[index].strip()[2:])
                index += 1
            output.append(("list", "bullet", items))
            continue
        if re.match(r"^\d+\. ", line):
            items = []
            while index < len(lines) and re.match(r"^\d+\. ", lines[index].strip()):
                items.append(re.sub(r"^\d+\. ", "", lines[index].strip()))
                index += 1
            output.append(("list", "number", items))
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
                or re.match(r"^\d+\. ", candidate.strip())
            ):
                break
            paragraph.append(candidate)
            index += 1
        output.append(("paragraph", " ".join(paragraph)))
    return output


class Rule(Flowable):
    def __init__(self, width, color=LINE, thickness=0.6):
        super().__init__()
        self.width = width
        self.height = thickness
        self.color = color
        self.thickness = thickness

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)


class LearningFlow(Flowable):
    labels = ["诊断", "讲解与追问", "分步练习", "独立测评", "延迟复测"]

    def __init__(self, width):
        super().__init__()
        self.width = width
        self.height = 66

    def draw(self):
        gap = 9
        box_width = (self.width - gap * 4) / 5
        for index, label in enumerate(self.labels):
            x = index * (box_width + gap)
            self.canv.setFillColor(BLUE if index in (0, 3, 4) else SURFACE)
            self.canv.setStrokeColor(BLUE if index in (0, 3, 4) else LINE)
            self.canv.roundRect(x, 21, box_width, 34, 8, fill=1, stroke=1)
            self.canv.setFillColor(colors.white if index in (0, 3, 4) else INK)
            self.canv.setFont("AcademyBold", 8.2)
            self.canv.drawCentredString(x + box_width / 2, 34, label)
            if index < 4:
                arrow_x = x + box_width + 2
                self.canv.setStrokeColor(MUTED)
                self.canv.setFillColor(MUTED)
                self.canv.line(arrow_x, 38, arrow_x + gap - 4, 38)
                self.canv.line(arrow_x + gap - 7, 41, arrow_x + gap - 4, 38)
                self.canv.line(arrow_x + gap - 7, 35, arrow_x + gap - 4, 38)
        self.canv.setFillColor(MUTED)
        self.canv.setFont("Academy", 7.8)
        self.canv.drawString(0, 4, "记录：原始作答 · 帮助程度 · 题目版本 · 日期 · 评分依据")


class StageTimeline(Flowable):
    def __init__(self, width):
        super().__init__()
        self.width = width
        self.height = 76

    def draw(self):
        stages = [
            ("10 月", "测清一条链路", 1, BLUE),
            ("11 月—1 月", "扩展 6 个专题", 3, GREEN),
            ("2 月—4 月", "计划与试用", 3, ORANGE),
        ]
        total = sum(stage[2] for stage in stages)
        gap = 8
        usable = self.width - gap * 2
        x = 0
        for month, title, weight, color in stages:
            width = usable * weight / total
            self.canv.setFillColor(color)
            self.canv.roundRect(x, 31, width, 20, 7, fill=1, stroke=0)
            self.canv.setFillColor(INK)
            self.canv.setFont("AcademyBold", 8.5)
            self.canv.drawString(x, 16, title)
            self.canv.setFillColor(MUTED)
            self.canv.setFont("Academy", 7.5)
            self.canv.drawString(x, 4, month)
            x += width + gap


def qr_drawing(url, label, size=55):
    widget = QrCodeWidget(url)
    bounds = widget.getBounds()
    scale_x = size / (bounds[2] - bounds[0])
    scale_y = size / (bounds[3] - bounds[1])
    drawing = Drawing(size, size, transform=[scale_x, 0, 0, scale_y, 0, 0])
    drawing.add(widget)
    return Table(
        [[drawing, Paragraph(inline(label), STYLES["qr_label"])]],
        colWidths=[size + 7, 73],
        rowHeights=[size],
        style=TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        ),
    )


def markdown_table(rows, width):
    columns = len(rows[0])
    if columns == 2:
        widths = [width * 0.23, width * 0.77]
    elif columns == 3:
        widths = [width * 0.28, width * 0.16, width * 0.56]
    else:
        widths = [width / columns] * columns
    data = []
    for row_index, row in enumerate(rows):
        data.append(
            [
                Paragraph(inline(cell), STYLES["table_head" if row_index == 0 else "table"])
                for cell in row
            ]
        )
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
        ("TEXTCOLOR", (0, 0), (-1, 0), INK),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if rows[-1][0] == "合计":
        style.extend(
            [
                ("BACKGROUND", (0, -1), (-1, -1), BLUE_SOFT),
                ("LINEABOVE", (0, -1), (-1, -1), 1, BLUE),
            ]
        )
    table.setStyle(TableStyle(style))
    return table


def create_styles():
    base = ParagraphStyle(
        "Body",
        fontName="Academy",
        fontSize=9.6,
        leading=14.6,
        textColor=INK,
        wordWrap="CJK",
        spaceAfter=7,
        allowWidows=0,
        allowOrphans=0,
    )
    return {
        "body": base,
        "small": ParagraphStyle(
            "Small", parent=base, fontSize=8.2, leading=12.5, textColor=MUTED
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base,
            fontName="AcademyBold",
            fontSize=28,
            leading=36,
            spaceAfter=13,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base,
            fontName="AcademyBold",
            fontSize=19,
            leading=26,
            spaceAfter=13,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=base,
            fontName="AcademyBold",
            fontSize=11.5,
            leading=16,
            spaceBefore=5,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "label": ParagraphStyle(
            "Label",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=BLUE,
            tracking=1.2,
            spaceAfter=10,
        ),
        "meta": ParagraphStyle(
            "Meta", parent=base, fontSize=9.2, leading=14.5, textColor=MUTED
        ),
        "lead": ParagraphStyle(
            "Lead", parent=base, fontSize=11.2, leading=18, spaceAfter=10
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base,
            leftIndent=15,
            firstLineIndent=-10,
            bulletIndent=0,
            spaceAfter=3,
        ),
        "table": ParagraphStyle(
            "Table", parent=base, fontSize=7.8, leading=11.2, spaceAfter=0
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=base,
            fontName="AcademyBold",
            fontSize=7.9,
            leading=11.2,
            spaceAfter=0,
        ),
        "qr_label": ParagraphStyle(
            "QRLabel",
            parent=base,
            fontName="AcademyBold",
            fontSize=8.2,
            leading=12,
            spaceAfter=0,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base,
            fontSize=7.4,
            leading=10,
            textColor=MUTED,
            alignment=TA_RIGHT,
        ),
        "cover_meta": ParagraphStyle(
            "CoverMeta",
            parent=base,
            fontName="AcademyBold",
            fontSize=9.2,
            leading=13,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=0,
        ),
    }


def cover_story(page, screenshot, width):
    lines = page.splitlines()
    title = lines[0][2:].strip()
    metadata = []
    index = 1
    while index < len(lines) and not lines[index].strip():
        index += 1
    while index < len(lines) and lines[index].strip():
        metadata.append(lines[index].strip().rstrip())
        index += 1
    remainder = "\n".join(lines[index:]).strip()
    parsed = blocks(remainder)
    paragraphs = []
    links = []
    for block in parsed:
        if block[0] == "paragraph":
            paragraphs.append(block[1])
        elif block[0] == "list":
            links.extend(block[2])
    story = [
        Spacer(1, 12),
        Paragraph("UNITREE GENIUS PROGRAM · PROJECT APPLICATION", STYLES["label"]),
        Paragraph(inline(title), STYLES["h1"]),
        Paragraph("把课程、独立测评和长期复习接在一起", STYLES["lead"]),
        Spacer(1, 3),
    ]
    meta_data = []
    for line in metadata:
        if "：" in line:
            key, value = line.split("：", 1)
            meta_data.append(
                [
                    Paragraph(inline(key), STYLES["small"]),
                    Paragraph(inline(value), STYLES["cover_meta"]),
                ]
            )
    meta_table = Table(meta_data, colWidths=[65, width - 65])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.extend([meta_table, Spacer(1, 12)])
    for paragraph in paragraphs:
        story.append(Paragraph(inline(paragraph), STYLES["body"]))
    if screenshot and screenshot.is_file():
        image = Image.open(screenshot)
        crop_height = min(image.height, int(image.width / 2.85))
        cropped = image.crop((0, 0, image.width, crop_height))
        buffer = io.BytesIO()
        cropped.save(buffer, format="PNG")
        buffer.seek(0)
        story.extend(
            [
                Spacer(1, 4),
                RLImage(buffer, width=width, height=width / 2.85),
                Spacer(1, 7),
            ]
        )
    link_cells = []
    for link in links:
        name, url = link.split("：", 1)
        link_cells.append(
            Paragraph(
                f"<b>{inline(name)}</b><br/><a href=\"{url.strip('<>')}\" color=\"#0071e3\">{inline(url)}</a>",
                STYLES["small"],
            )
        )
    if link_cells:
        story.append(
            Table(
                [link_cells[:2], link_cells[2:4]],
                colWidths=[width / 2, width / 2],
                style=TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                ),
            )
        )
    return story


def content_story(page, page_index, width):
    story = []
    parsed = blocks(page)
    for block_index, block in enumerate(parsed):
        kind = block[0]
        if kind == "heading":
            level, content = block[1], block[2]
            style = STYLES["h2"] if level == 2 else STYLES["h3"]
            story.append(Paragraph(inline(content), style))
            if level == 2:
                if page_index == 3:
                    story.extend([LearningFlow(width), Spacer(1, 5)])
                elif page_index == 4:
                    story.extend([StageTimeline(width), Spacer(1, 4)])
        elif kind == "paragraph":
            style = STYLES["lead"] if block_index == 1 else STYLES["body"]
            story.append(Paragraph(inline(block[1]), style))
        elif kind == "table":
            story.extend([markdown_table(block[1], width), Spacer(1, 7)])
        elif kind == "list":
            list_kind, items = block[1], block[2]
            for item_index, item in enumerate(items):
                bullet = "•" if list_kind == "bullet" else f"{item_index + 1}."
                story.append(
                    Paragraph(
                        f"{bullet}&nbsp;&nbsp;{inline(item)}",
                        STYLES["bullet"],
                    )
                )
            story.append(Spacer(1, 3))
    if page_index == 6:
        story.extend(
            [
                Spacer(1, 6),
                Rule(width),
                Spacer(1, 9),
                Table(
                    [
                        [
                            qr_drawing("https://academy.lailai.one", "项目网站"),
                            qr_drawing("https://resume.lailai.one/zh/", "公开简历"),
                            qr_drawing("https://lailai.one", "个人网站"),
                        ]
                    ],
                    colWidths=[width / 3] * 3,
                    style=TableStyle(
                        [
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 0),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                            ("TOPPADDING", (0, 0), (-1, -1), 0),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                        ]
                    ),
                ),
            ]
        )
    return story


def build(source, screenshot, output):
    pages = read_pages(source)
    if len(pages) != 7:
        raise ValueError(f"Expected seven application pages, found {len(pages)}.")
    content_width = WIDTH - 2 * MARGIN
    story = cover_story(pages[0], screenshot, content_width)
    for index, page in enumerate(pages[1:], start=1):
        story.append(PageBreak())
        story.extend(content_story(page, index, content_width))
    logo = load_logo()
    section_titles = [
        "项目申请",
        "背景与定位",
        "当前进展",
        "学习方法",
        "实施计划",
        "经费与验收",
        "申请人",
    ]

    def decorate(canvas, document):
        page_number = document.page
        canvas.saveState()
        if page_number == 1:
            canvas.setFillColor(BLUE)
            canvas.rect(0, HEIGHT - 7, WIDTH, 7, fill=1, stroke=0)
            canvas.drawImage(logo, WIDTH - MARGIN - 32, HEIGHT - MARGIN - 3, 32, 32, mask="auto")
        else:
            canvas.drawImage(logo, MARGIN, HEIGHT - 43, 18, 18, mask="auto")
            canvas.setFont("AcademyBold", 8.3)
            canvas.setFillColor(INK)
            canvas.drawString(MARGIN + 25, HEIGHT - 34, "lailai's Academy")
            canvas.setFont("Academy", 8)
            canvas.setFillColor(MUTED)
            canvas.drawRightString(
                WIDTH - MARGIN,
                HEIGHT - 34,
                section_titles[min(page_number - 1, len(section_titles) - 1)],
            )
            canvas.setStrokeColor(LINE)
            canvas.setLineWidth(0.5)
            canvas.line(MARGIN, HEIGHT - 48, WIDTH - MARGIN, HEIGHT - 48)
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, 38, WIDTH - MARGIN, 38)
        canvas.setFont("Academy", 7.3)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN, 25, "宇树科技「天才少年」计划项目申请书 · 2026 年 9 月 22 日")
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(BLUE)
        canvas.drawRightString(WIDTH - MARGIN, 25, f"{page_number} / 7")
        canvas.restoreState()

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".building.pdf")
    document = SimpleDocTemplate(
        str(temporary),
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=56,
        bottomMargin=48,
        title="Academy：面向浙江高中生的开源 AI 自学平台",
        author="陈家治",
        subject="宇树科技「天才少年」计划项目申请书",
        creator="lailai's Academy",
    )
    document.build(story, onFirstPage=decorate, onLaterPages=decorate)
    temporary.replace(output)


def main():
    parser = argparse.ArgumentParser(description="Build the Unitree Genius application PDF.")
    parser.add_argument(
        "--source",
        type=Path,
        default=ROOT / "docs/unitree-genius-application.md",
    )
    parser.add_argument(
        "--screenshot",
        type=Path,
        default=ROOT / "tmp/pdfs/unitree/academy-home.png",
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
    global STYLES
    STYLES = create_styles()
    build(args.source, args.screenshot, args.output)
    print(f"Built {args.output}")


if __name__ == "__main__":
    main()
