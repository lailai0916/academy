import argparse
import base64
import io
import re
import xml.etree.ElementTree as ET
from html import escape
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
BLUE = HexColor("#0071e3")
INK = HexColor("#1c1c1e")
MUTED = HexColor("#63636a")
LINE = HexColor("#dedee3")
WIDTH, HEIGHT = A4
MARGIN = 54


def read_source(path):
    source = path.read_text(encoding="utf-8").strip()
    chunks = re.split(r"\n\s*\n", source)
    if len(chunks) < 3 or not chunks[0].startswith("# "):
        raise ValueError("The brief needs a title, metadata and body.")
    return chunks[0][2:], chunks[1], chunks[2:]


def inline(source):
    lines = source.splitlines()
    text = ""
    for line in lines:
        if text.endswith("  "):
            text = text.rstrip() + "\n"
        elif text and text[-1].isascii() and line and line[0].isascii():
            text += " "
        text += line
    text = escape(text)
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        r'<a href="\2" color="#0071e3">\1</a>',
        text,
    )
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return text.replace("\n", "<br/>")


def load_logo():
    root = ET.parse(ROOT / "apps/web/public/brand/logo.svg").getroot()
    node = root.find(".//{http://www.w3.org/2000/svg}image")
    if node is None:
        raise ValueError("The brand SVG must contain its embedded PNG image.")
    data = node.attrib["{http://www.w3.org/1999/xlink}href"]
    if not data.startswith("data:image/png;base64,"):
        raise ValueError("Unsupported embedded logo format.")
    return ImageReader(io.BytesIO(base64.b64decode(data.split(",", 1)[1])))


def build(output, title, metadata, chunks):
    body = ParagraphStyle(
        "Body",
        fontName="Academy",
        fontSize=11.5,
        leading=20,
        textColor=INK,
        wordWrap="CJK",
        spaceAfter=10,
        allowWidows=0,
        allowOrphans=0,
    )
    heading = ParagraphStyle(
        "Heading",
        parent=body,
        fontName="AcademyBold",
        fontSize=16,
        leading=24,
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True,
    )
    title_style = ParagraphStyle(
        "Title",
        parent=heading,
        fontName="Helvetica-Bold",
        fontSize=29,
        leading=38,
        spaceBefore=0,
        spaceAfter=10,
    )
    metadata_style = ParagraphStyle(
        "Metadata", parent=body, fontSize=9, leading=15, textColor=MUTED
    )
    story = [
        Paragraph(escape(title), title_style),
        Paragraph(escape(metadata), metadata_style),
        Spacer(1, 8),
    ]
    for chunk in chunks:
        if chunk.startswith("## "):
            story.append(Paragraph(inline(chunk[3:]), heading))
        elif re.match(r"^(?:#{1,6} |[-*] |\d+\. |\|)", chunk):
            raise ValueError("The brief supports prose and second-level headings only.")
        else:
            story.append(Paragraph(inline(chunk), body))

    logo = load_logo()

    def decorate(c, doc):
        c.saveState()
        if doc.page == 1:
            c.drawImage(logo, WIDTH - MARGIN - 39, HEIGHT - 96, 39, 39, mask="auto")
        else:
            c.setFont("Helvetica-Bold", 10)
            c.setFillColor(INK)
            c.drawString(MARGIN, HEIGHT - 39, title)
            c.setStrokeColor(LINE)
            c.setLineWidth(0.5)
            c.line(MARGIN, HEIGHT - 48, WIDTH - MARGIN, HEIGHT - 48)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(MARGIN, 47, WIDTH - MARGIN, 47)
        c.setFont("Academy", 8)
        c.setFillColor(MUTED)
        c.drawString(MARGIN, 31, metadata)
        c.setFont("Helvetica", 9)
        c.setFillColor(BLUE)
        c.drawRightString(WIDTH - MARGIN, 31, str(doc.page))
        c.restoreState()

    document = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=60,
        bottomMargin=65,
        title=f"{title} | 项目简介",
        author=title,
        subject=metadata,
    )
    document.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return document.page


def main():
    parser = argparse.ArgumentParser(description="Build the Academy project introduction.")
    parser.add_argument("--source", type=Path, default=ROOT / "docs/project-brief.md")
    parser.add_argument("--output", type=Path, default=ROOT / "output/pdf/academy-project-brief.pdf")
    parser.add_argument("--font-regular", type=Path, default=Path("/System/Library/Fonts/STHeiti Light.ttc"))
    parser.add_argument("--font-bold", type=Path, default=Path("/System/Library/Fonts/STHeiti Medium.ttc"))
    args = parser.parse_args()
    for name, path in (("Academy", args.font_regular), ("AcademyBold", args.font_bold)):
        if not path.is_file():
            parser.error(f"Chinese font not found: {path}. Supply --font-regular and --font-bold.")
        pdfmetrics.registerFont(TTFont(name, str(path), subfontIndex=0))
    pdfmetrics.registerFontFamily("Academy", normal="Academy", bold="AcademyBold")
    title, metadata, chunks = read_source(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".building.pdf")
    try:
        pages = build(temporary, title, metadata, chunks)
        temporary.replace(args.output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Built {args.output} ({pages} pages)")


if __name__ == "__main__":
    main()
