---
name: hwpx
description: Use this skill whenever a Korean word processor file (.hwpx or .hwp, 한글/아래아한글/한컴오피스/HWP/HWPX) is the input or the output. That includes converting PDF, DOCX, Markdown, or scanned pages into .hwpx; creating a Korean report, 공문, 계획서, 보고서, 가정통신문, or 결재 문서 as an .hwpx file; reading or extracting text and tables out of an existing .hwpx; and editing or rebuilding one. Trigger even when the user only says "한글 파일로 바꿔 줘", "한글로 만들어 줘", "hwp로 저장해 줘", or names a .hwpx/.hwp file in passing — Korean schools and public offices mean this format, not Microsoft Word. Do NOT use for .docx (use the docx skill) or for plain PDF work with no Korean-format deliverable (use the pdf skill).
---

# HWPX (한글 문서) 작성·검증

HWPX is the open, ZIP-based format of Hancom Office Hangul (한글), standardised
as OWPML / KS X 6101. `.hwp` is the older, undocumented binary format.

**This skill writes `.hwpx`, never `.hwp`.** Hangul 2014 and newer open `.hwpx`
natively. If the user insists on binary `.hwp`, tell them to save-as from
Hangul — there is no reliable open-source writer for it.

## Hard constraints — do not skip these

1. **LibreOffice cannot help.** It has no HWP or HWPX filter. `soffice
   --convert-to` will say "source file could not be loaded" for any .hwpx,
   valid or not. That message is *not* evidence your file is broken.
2. **No Hangul in the sandbox.** You cannot open the result in the real
   program. Say so plainly when you deliver, rather than claiming it is
   verified to render correctly. Run `scripts/validate_hwpx.py` and report
   what that actually proves: the file is structurally conformant.
3. **`mimetype` must be the first ZIP entry and STORED (uncompressed).**
   Getting this wrong is the single most common way to make Hangul reject a
   file outright.
4. **Element order inside XML is significant.** OWPML uses `xs:sequence`.
   Re-ordering children of `hp:tc`, `hp:tbl`, `hh:charPr`, or `hh:refList`
   produces a file Hangul refuses. See `reference.md`.

## Setup

```bash
pip install python-hwpx lxml            # writing + validation
pip install pdfplumber pypdfium2        # only when the source is a PDF
```

If `import lxml` or `import pdfplumber` dies with `ModuleNotFoundError:
_cffi_backend` or a `pyo3_runtime.PanicException`, the image's `cffi` is
broken. Fix with:

```bash
pip install --force-reinstall --upgrade cffi
```

## Creating an .hwpx

Use `scripts/hwpx_writer.py`. It builds a complete OWPML package with
paragraphs, styled tables, cell shading, and borders.

```python
import sys; sys.path.insert(0, ".claude/skills/hwpx/scripts")
from hwpx_writer import para, table, build_section, write_hwpx, BODY_W

HDR = dict(char=2, para_pr=1, fill=3, valign="CENTER")   # blue header row
KEY = dict(char=3, para_pr=1, fill=4, valign="CENTER")   # tinted first column
TXT = dict(char=3, para_pr=2, fill=2, valign="TOP")      # plain body cell

rows = [
    [dict(HDR, lines=["교시"]), dict(HDR, lines=["과목"])],
    [dict(KEY, lines=["1교시"]), dict(TXT, lines=["국어", "3-1반"])],
]
section = build_section([
    table(rows, col_widths=[8000, 34520], row_heights=[2000, 3000]),
    para("", char=0),
    para("| 12 |  서울특별시교육청", char=4, para_pr=4, size=850),
])
write_hwpx("결과.hwpx", "주간 시간표", section, preview_text="주간 시간표")
```

Each entry in `lines` becomes its own paragraph inside the cell, so pass a
list of lines rather than a string with `\n`.

### Preset IDs defined in the writer

| charPr | 용도 | paraPr | 정렬 |
|---|---|---|---|
| 0 | 본문 10pt | 0 | 양쪽 혼합 |
| 1 | 제목 14pt 굵게 | 1 | 가운데 |
| 2 | 표 머리글 11pt 굵게 | 2 | 왼쪽 |
| 3 | 표 본문 9pt | 3 | 양쪽 |
| 4 | 각주·쪽 8.5pt | 4 | 왼쪽 + 윗줄(각주 구분선) |

| borderFill | 모양 |
|---|---|
| 1 | 테두리 없음 |
| 2 | 표 격자 |
| 3 | 머리글 행 (하늘색 채움) |
| 4 | 첫 열 (연한 하늘색 채움) |
| 5 | 제목 배너 (굵은 테두리) |
| 6 | 윗줄만 — 각주 구분선 |

Layout units are HWPUNIT (1/7200 inch). A4 portrait is 59528 × 84188 and
`BODY_W` (42520) is the printable width — **column widths must sum to
`BODY_W`** or the table will overflow the page.

## Converting a PDF

1. Try `pdfplumber` text extraction first.
2. **If it returns 0 characters but thousands of `curves`, the glyphs were
   flattened to vector outlines.** There is no text layer to recover. Render
   the pages and read them yourself:

   ```python
   import pypdfium2 as pdfium
   pdf = pdfium.PdfDocument("in.pdf")
   pdf[0].render(scale=3).to_pil().save("p1.png")   # ~300 dpi
   ```

   Then open the PNG with the Read tool and transcribe. Do not guess at text
   you cannot see, and do not silently "fix" typos in the source — reproduce
   them and mention them when you deliver.
3. Rebuild the layout as real tables and paragraphs. A page image pasted into
   a document is not a conversion; the user wants editable cells.

## Reading or editing an existing .hwpx

```python
from hwpx.document import HwpxDocument
doc = HwpxDocument.open("문서.hwpx")
for t in doc.tables:
    print(t.row_count, t.column_count, t.cell(0, 0).text)
for p in doc.paragraphs:
    print(p.text)
doc.save("수정.hwpx")
```

## Always validate before delivering

```bash
python3 .claude/skills/hwpx/scripts/validate_hwpx.py 결과.hwpx
```

Must print `RESULT: PASS`. One advisory is expected and fine — *"manifest does
not reference a version part"* — because Hangul's own output has it too.

Then tell the user, honestly:

- what passed (ZIP layout, OWPML schema, package rules, round-trip read)
- that it was **not** opened in Hangul itself, so they should check it
- anything you had to interpret or approximate from the source
