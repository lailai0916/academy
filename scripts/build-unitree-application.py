import argparse
import re
import subprocess
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def inline(source):
    text = escape(source.strip(), quote=True)
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
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"`(.+?)`", r"<code>\1</code>", text)
    return text


def markdown_body(source):
    lines = source.splitlines()
    body = []
    index = 0
    while index < len(lines):
        line = lines[index].rstrip()
        if not line or line.startswith("<!--"):
            index += 1
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            level = 1 if level == 1 else 2
            body.append(f"<h{level}>{inline(line.lstrip('#').strip())}</h{level}>")
            index += 1
            continue
        if re.match(r"^[-*] ", line):
            items = []
            while index < len(lines) and re.match(
                r"^[-*] ", lines[index].strip()
            ):
                items.append(f"<li>{inline(lines[index].strip()[2:])}</li>")
                index += 1
            body.append("<ul>" + "".join(items) + "</ul>")
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
        body.append(f"<p>{inline(' '.join(paragraph))}</p>")
    return "\n".join(body)


def html_document(source):
    body = markdown_body(source)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="author" content="陈家治">
<title>Academy 项目申请书</title>
<style>
@page {{ size: A4; margin: 18mm 20mm; }}
html {{ font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; font-size: 10.5pt; line-height: 1.65; color: #000; }}
body {{ margin: 0; }}
h1 {{ font-size: 1.7em; line-height: 1.3; margin: 0 0 .55em; }}
h2 {{ font-size: 1.2em; line-height: 1.4; margin: .9em 0 .3em; }}
p {{ margin: 0 0 .65em; }}
ul {{ margin: .2em 0 .7em; padding-left: 1.5em; }}
li {{ margin: .15em 0; }}
a {{ color: inherit; text-decoration: none; }}
code {{ font-family: ui-monospace, monospace; font-size: .95em; }}
</style>
</head>
<body>
{body}
</body>
</html>
"""


def build(source, output, chrome):
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_html = output.with_suffix(".building.html")
    temporary_pdf = output.with_suffix(".building.pdf")
    temporary_html.write_text(
        html_document(source.read_text(encoding="utf-8")),
        encoding="utf-8",
    )
    temporary_pdf.unlink(missing_ok=True)
    try:
        result = subprocess.run(
            [
                str(chrome),
                "--headless",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--print-to-pdf={temporary_pdf}",
                temporary_html.resolve().as_uri(),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode or not temporary_pdf.is_file():
            raise RuntimeError(result.stderr.strip() or "Chrome did not create a PDF.")
        temporary_pdf.replace(output)
    finally:
        temporary_html.unlink(missing_ok=True)
        temporary_pdf.unlink(missing_ok=True)


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
        "--chrome",
        type=Path,
        default=Path(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        ),
    )
    args = parser.parse_args()
    if not args.chrome.is_file():
        parser.error(f"Chrome not found: {args.chrome}")
    build(args.source, args.output, args.chrome)
    print(f"Built {args.output}")


if __name__ == "__main__":
    main()
