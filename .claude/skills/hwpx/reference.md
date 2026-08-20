# OWPML / HWPX 구조 메모

Read this when `hwpx_writer.py` needs extending — new shapes, images,
headers/footers, real footnotes — or when a file is rejected by Hangul.

## Package layout

A `.hwpx` is a ZIP. This is what Hangul itself emits, and what the writer
reproduces:

| Part | Notes |
|---|---|
| `mimetype` | **first entry, STORED**, exactly `application/hwp+zip` |
| `version.xml` | `hv:HCFVersion`, `xmlVersion="1.4"` |
| `settings.xml` | `ha:HWPApplicationSetting`, caret position |
| `META-INF/container.xml` | lists `content.hpf`, `PrvText.txt`, `container.rdf` as rootfiles |
| `META-INF/manifest.xml` | **empty** `odf:manifest` — the real part list is in content.hpf |
| `META-INF/container.rdf` | RDF description of the document |
| `Contents/content.hpf` | OPF package: metadata + manifest + spine |
| `Contents/header.xml` | `hh:head` — fonts, borders, char/para properties, styles |
| `Contents/section0.xml` | `hs:sec` — the body |
| `Preview/PrvText.txt` | plain-text preview |

`content.hpf` does **not** list `version.xml`; the engine falls back to it by
convention. `package_validator` warns about this on genuine Hangul files too.

## Namespaces

Declare all of them on the root of every part. `hwpx_writer.NS` holds the
full string.

| prefix | URI |
|---|---|
| `hh` | `http://www.hancom.co.kr/hwpml/2011/head` |
| `hs` | `http://www.hancom.co.kr/hwpml/2011/section` |
| `hp` | `http://www.hancom.co.kr/hwpml/2011/paragraph` |
| `hc` | `http://www.hancom.co.kr/hwpml/2011/core` |
| `ha` | `http://www.hancom.co.kr/hwpml/2011/app` |
| `hp10` | `http://www.hancom.co.kr/hwpml/2016/paragraph` |

## Element order — the part that bites

OWPML is `xs:sequence`. These orders are mandatory:

```
hh:head        -> beginNum, refList, compatibleDocument?
hh:refList     -> fontfaces, borderFills, charProperties, tabProperties,
                  numberings, bullets?, paraProperties, styles
hh:borderFill  -> slash, backSlash, leftBorder, rightBorder, topBorder,
                  bottomBorder, diagonal, fillBrush?
hh:charPr      -> fontRef, ratio, spacing, relSz, offset,
                  then bold? italic? underline? ...
hh:paraPr      -> align, heading, breakSetting, autoSpacing, margin,
                  lineSpacing, border
hp:p           -> run+, linesegarray
hp:tbl         -> sz, pos, outMargin, inMargin, tr+
hp:tc          -> subList, cellAddr, cellSpan, cellSz, cellMargin
```

`hh:fontfaces` needs one `hh:fontface` per language — HANGUL, LATIN, HANJA,
JAPANESE, OTHER, SYMBOL, USER — even when they all name the same font.

Every `hp:p` needs a `hp:linesegarray` with at least one `hp:lineseg`.
Hangul recalculates layout on open, so approximate values are fine, but an
absent element is a parse error.

## Units

- Layout: **HWPUNIT** = 1/7200 inch. A4 portrait 59528 × 84188.
- Font height: 1/100 pt. `height="1000"` is 10 pt.
- Border width: an enumerated *string*, not a number —
  `"0.1 mm"`, `"0.12 mm"`, `"0.4 mm"`, `"1.0 mm"` …

## Validation, and what it is worth

`scripts/validate_hwpx.py` runs four checks. Know their limits:

- **ZIP + package checks are strict.** A failure here means Hangul will
  almost certainly refuse the file.
- **The XSD is permissive.** In a negative control, injecting a bogus
  `<hp:bogusElement/>` into `section0.xml` still validated. So schema PASS
  means "no detected violation", not "definitely correct".
- **The round-trip read is the strongest signal available offline** — it
  proves an independent OWPML parser recovers the tables and text.

None of them prove the file renders correctly in Hangul. Nothing in the
sandbox can. Say so when delivering.

## Known gaps in `hwpx_writer.py`

Not implemented; add here if a task needs them.

- Images / `BinData` parts
- Headers, footers, real page numbering (page numbers are plain paragraphs)
- Real footnote controls — `paraPr` 4 draws a top border that *looks* like
  the separator, but the note is body text, not an `hp:footNote`
- Merged cells: `colSpan`/`rowSpan` attributes are written, but the writer
  does not adjust the surrounding grid, so spans need manual cell layout
- Rounded rectangles — title banners are 1×1 tables with square corners
