"""Minimal HWPX (OWPML / KS X 6101) writer.

HWPX is a ZIP container:
  mimetype (stored)  | version.xml | settings.xml
  META-INF/container.xml, META-INF/manifest.xml
  Contents/content.hpf, Contents/header.xml, Contents/section0.xml
"""
import time
import zipfile
from xml.sax.saxutils import escape

NS = (
    'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" '
    'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" '
    'xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" '
    'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" '
    'xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" '
    'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" '
    'xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" '
    'xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" '
    'xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" '
    'xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:opf="http://www.idpf.org/2007/opf/" '
    'xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" '
    'xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" '
    'xmlns:epub="http://www.idpf.org/2007/ops" '
    'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"'
)

XMLDECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

# A4 portrait, in HWPUNIT (1/7200 inch)
PAGE_W, PAGE_H = 59528, 84188
MARGIN_LR, MARGIN_T, MARGIN_B, MARGIN_HF = 8504, 5668, 4252, 4252
BODY_W = PAGE_W - MARGIN_LR * 2  # 42520

# ---------------------------------------------------------------- header.xml

_FONT_LANGS = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"]


def _fontfaces(faces):
    out = [f'<hh:fontfaces itemCnt="{len(_FONT_LANGS)}">']
    for lang in _FONT_LANGS:
        out.append(f'<hh:fontface lang="{lang}" fontCnt="{len(faces)}">')
        for i, name in enumerate(faces):
            out.append(
                f'<hh:font id="{i}" face="{name}" type="TTF" isEmbedded="0">'
                '<hh:typeInfo familyType="FCAT_UNKNOWN" weight="0" proportion="0"'
                ' contrast="0" strokeVariation="0" armStyle="0" letterform="0"'
                ' midline="0" xHeight="0"/></hh:font>'
            )
        out.append("</hh:fontface>")
    out.append("</hh:fontfaces>")
    return "".join(out)


def _border(tag, type_, width, color):
    return f'<hh:{tag} type="{type_}" width="{width}" color="{color}"/>'


def _border_fill(i, borders, fill=None, edges="lrtb"):
    """borders: (type, width, color) applied to the edges named in `edges`."""
    t, w, c = borders
    none = ("NONE", "0.1 mm", "#000000")

    def edge(tag, key):
        et, ew, ec = (t, w, c) if key in edges else none
        return _border(tag, et, ew, ec)

    s = [
        f'<hh:borderFill id="{i}" threeD="0" shadow="0" centerLine="NONE"'
        ' breakCellSeparateLine="0">',
        '<hh:slash type="NONE" Crooked="0" isCounter="0"/>',
        '<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>',
        edge("leftBorder", "l"),
        edge("rightBorder", "r"),
        edge("topBorder", "t"),
        edge("bottomBorder", "b"),
        '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>',
    ]
    if fill:
        s.append(
            '<hc:fillBrush><hc:winBrush faceColor="%s" hatchColor="#333333"'
            ' alpha="0"/></hc:fillBrush>' % fill
        )
    s.append("</hh:borderFill>")
    return "".join(s)


def _char_pr(i, height, bold=False, color="#000000", font_id=0):
    s = [
        f'<hh:charPr id="{i}" height="{height}" textColor="{color}"'
        ' shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE"'
        ' borderFillIDRef="1">',
        '<hh:fontRef hangul="{0}" latin="{0}" hanja="{0}" japanese="{0}"'
        ' other="{0}" symbol="{0}" user="{0}"/>'.format(font_id),
        '<hh:ratio hangul="100" latin="100" hanja="100" japanese="100"'
        ' other="100" symbol="100" user="100"/>',
        '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0"'
        ' symbol="0" user="0"/>',
        '<hh:relSz hangul="100" latin="100" hanja="100" japanese="100"'
        ' other="100" symbol="100" user="100"/>',
        '<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0"'
        ' symbol="0" user="0"/>',
    ]
    if bold:
        s.append("<hh:bold/>")
    s.append("</hh:charPr>")
    return "".join(s)


def _para_pr(i, align="JUSTIFY", line_spacing=160, margin_prev=0, margin_next=0,
             border_fill=1):
    return (
        f'<hh:paraPr id="{i}" tabPrIDRef="0" condense="0" fontLineHeight="0"'
        ' snapToGrid="1" suppressLineNumbers="0" checked="0">'
        f'<hh:align horizontal="{align}" vertical="BASELINE"/>'
        '<hh:heading type="NONE" idRef="0" level="0"/>'
        '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD"'
        ' widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0"'
        ' lineWrap="BREAK"/>'
        '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
        '<hh:margin><hc:intent value="0" unit="HWPUNIT"/>'
        '<hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/>'
        f'<hc:prev value="{margin_prev}" unit="HWPUNIT"/>'
        f'<hc:next value="{margin_next}" unit="HWPUNIT"/></hh:margin>'
        f'<hh:lineSpacing type="PERCENT" value="{line_spacing}" unit="HWPUNIT"/>'
        f'<hh:border borderFillIDRef="{border_fill}" offsetLeft="0"'
        ' offsetRight="0" offsetTop="0" offsetBottom="0" connect="0"'
        ' ignoreMargin="0"/>'
        "</hh:paraPr>"
    )


def build_header():
    fills = [
        _border_fill(1, ("NONE", "0.1 mm", "#000000")),                        # none
        _border_fill(2, ("SOLID", "0.12 mm", "#4BACC6")),                      # grid
        _border_fill(3, ("SOLID", "0.12 mm", "#4BACC6"), "#9FDCF3"),           # header row
        _border_fill(4, ("SOLID", "0.12 mm", "#4BACC6"), "#EAF6FD"),           # 1st column
        _border_fill(5, ("SOLID", "0.4 mm", "#4BACC6"), "#D6ECF7"),            # title box
        _border_fill(6, ("SOLID", "0.12 mm", "#000000"), edges="t"),           # footnote rule
    ]
    chars = [
        _char_pr(0, 1000),                       # body
        _char_pr(1, 1400, bold=True),            # title
        _char_pr(2, 1100, bold=True),            # table header
        _char_pr(3, 900),                        # table body
        _char_pr(4, 850),                        # footnote / footer
        _char_pr(5, 1300, bold=True),            # page number
    ]
    paras = [
        _para_pr(0, "JUSTIFY", 160),
        _para_pr(1, "CENTER", 150),
        _para_pr(2, "LEFT", 150),
        _para_pr(3, "JUSTIFY", 150),
        _para_pr(4, "LEFT", 150, margin_prev=300, border_fill=6),  # footnote
    ]
    styles = [
        '<hh:style id="0" type="PARA" name="바탕글" engName="Normal"'
        ' paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042"'
        ' lockForm="0"/>'
    ]
    numbering = (
        '<hh:numbering id="1" start="0">'
        + "".join(
            f'<hh:paraHead start="1" level="{lv}" align="LEFT" useInstWidth="1"'
            ' autoIndent="1" widthAdjust="0" textOffsetType="PERCENT"'
            ' textOffset="50" numFormat="DIGIT" charPrIDRef="4294967295"'
            ' checkable="0">^{0}.</hh:paraHead>'.format(lv)
            for lv in range(1, 8)
        )
        + "</hh:numbering>"
    )
    return (
        XMLDECL
        + f'<hh:head {NS} version="1.4" secCnt="1">'
        '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1"'
        ' equation="1"/>'
        "<hh:refList>"
        + _fontfaces(["함초롬바탕", "함초롬돋움"])
        + f'<hh:borderFills itemCnt="{len(fills)}">' + "".join(fills) + "</hh:borderFills>"
        + f'<hh:charProperties itemCnt="{len(chars)}">' + "".join(chars) + "</hh:charProperties>"
        + '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0"'
        ' autoTabRight="0"/></hh:tabProperties>'
        + '<hh:numberings itemCnt="1">' + numbering + "</hh:numberings>"
        + f'<hh:paraProperties itemCnt="{len(paras)}">' + "".join(paras) + "</hh:paraProperties>"
        + f'<hh:styles itemCnt="{len(styles)}">' + "".join(styles) + "</hh:styles>"
        "</hh:refList>"
        '<hh:compatibleDocument targetProgram="HWP201X">'
        '<hh:layoutCompatibility/></hh:compatibleDocument>'
        "</hh:head>"
    )


# --------------------------------------------------------------- section0.xml

_pid = [0]


def _next_id():
    _pid[0] += 1
    return _pid[0]


def _lineseg(width=BODY_W, size=1000):
    h = int(size)
    return (
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0"'
        f' vertsize="{h}" textheight="{h}" baseline="{int(h*0.85)}"'
        f' spacing="{int(h*0.6)}" horzpos="0" horzsize="{width}"'
        ' flags="393216"/></hp:linesegarray>'
    )


def para(text="", char=0, para_pr=0, width=BODY_W, size=1000, extra=""):
    body = f"<hp:t>{escape(text)}</hp:t>" if text else "<hp:t/>"
    return (
        f'<hp:p id="{_next_id()}" paraPrIDRef="{para_pr}" styleIDRef="0"'
        ' pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="{char}">{extra}{body}</hp:run>'
        + _lineseg(width, size)
        + "</hp:p>"
    )


def _cell(text_lines, col, row, colspan, rowspan, width, height,
          char=3, para_pr=2, fill=2, valign="CENTER"):
    inner_w = max(width - 1020, 1000)
    ps = "".join(
        para(line, char=char, para_pr=para_pr, width=inner_w,
             size=900 if char == 3 else 1100)
        for line in (text_lines or [""])
    )
    return (
        f'<hp:tc name="" header="0" hasMargin="1" protect="0" editable="0"'
        f' dirty="0" borderFillIDRef="{fill}">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK"'
        f' vertAlign="{valign}" linkListIDRef="0" linkListNextIDRef="0"'
        ' textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        + ps
        + "</hp:subList>"
        f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/>'
        f'<hp:cellSpan colSpan="{colspan}" rowSpan="{rowspan}"/>'
        f'<hp:cellSz width="{width}" height="{height}"/>'
        '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        "</hp:tc>"
    )


def table(rows, col_widths, row_heights, header_rows=1):
    """rows: list of list of cell dicts {lines, char, para_pr, fill, align}."""
    total_w = sum(col_widths)
    total_h = sum(row_heights)
    trs = []
    for r, row in enumerate(rows):
        tcs = []
        for c, cell in enumerate(row):
            span = cell.get("colspan", 1)
            w = sum(col_widths[c:c + span])
            tcs.append(
                _cell(
                    cell.get("lines", [""]), c, r, span, cell.get("rowspan", 1),
                    w, row_heights[r],
                    char=cell.get("char", 3),
                    para_pr=cell.get("para_pr", 2),
                    fill=cell.get("fill", 2),
                    valign=cell.get("valign", "CENTER"),
                )
            )
        trs.append("<hp:tr>" + "".join(tcs) + "</hp:tr>")
    tbl = (
        f'<hp:tbl id="{_next_id()}" zOrder="0" numberingType="TABLE"'
        ' textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0"'
        ' dropcapstyle="None" pageBreak="CELL" repeatHeader="1"'
        f' rowCnt="{len(rows)}" colCnt="{len(col_widths)}" cellSpacing="0"'
        ' borderFillIDRef="2" noAdjust="0">'
        f'<hp:sz width="{total_w}" widthRelTo="ABSOLUTE" height="{total_h}"'
        ' heightRelTo="ABSOLUTE" protect="0"/>'
        '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1"'
        ' allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA"'
        ' horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0"'
        ' horzOffset="0"/>'
        '<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
        '<hp:inMargin left="510" right="510" top="141" bottom="141"/>'
        + "".join(trs)
        + "</hp:tbl>"
    )
    return (
        f'<hp:p id="{_next_id()}" paraPrIDRef="1" styleIDRef="0" pageBreak="0"'
        ' columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="0">{tbl}</hp:run>'
        + _lineseg(total_w, total_h)
        + "</hp:p>"
    )


_SECPR = (
    '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134"'
    ' tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT"'
    ' outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0"'
    ' masterPageCnt="0">'
    '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0" strtnum="0"/>'
    '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>'
    '<hp:visibility hideFirstHeader="0" hideFirstFooter="0"'
    ' hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL"'
    ' hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>'
    '<hp:lineNumberShape restartType="0" countBy="0" distance="0"'
    ' startNumber="0"/>'
    f'<hp:pagePr landscape="WIDELY" width="{PAGE_W}" height="{PAGE_H}"'
    ' gutterType="LEFT_ONLY">'
    f'<hp:margin header="{MARGIN_HF}" footer="{MARGIN_HF}" gutter="0"'
    f' left="{MARGIN_LR}" right="{MARGIN_LR}" top="{MARGIN_T}"'
    f' bottom="{MARGIN_B}"/></hp:pagePr>'
    '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar=""'
    ' suffixChar=")" supscript="0"/>'
    '<hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/>'
    '<hp:noteSpacing betweenNotes="850" belowLine="567" aboveLine="567"/>'
    '<hp:numbering type="CONTINUOUS" newNum="1"/>'
    '<hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>'
    '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar=""'
    ' suffixChar=")" supscript="0"/>'
    '<hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/>'
    '<hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/>'
    '<hp:numbering type="CONTINUOUS" newNum="1"/>'
    '<hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>'
    + "".join(
        f'<hp:pageBorderFill type="{t}" borderFillIDRef="1" textBorder="PAPER"'
        ' headerInside="0" footerInside="0" fillArea="PAPER">'
        '<hp:offset left="1417" right="1417" top="1417" bottom="1417"/>'
        "</hp:pageBorderFill>"
        for t in ("BOTH", "EVEN", "ODD")
    )
    + "</hp:secPr>"
)

_COLPR = (
    '<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1"'
    ' sameSz="1" sameGap="0"/></hp:ctrl>'
)


def build_section(blocks):
    """blocks: list of XML strings; the first paragraph carries secPr."""
    first = (
        f'<hp:p id="{_next_id()}" paraPrIDRef="1" styleIDRef="0" pageBreak="0"'
        ' columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="0">{_SECPR}{_COLPR}<hp:t/></hp:run>'
        + _lineseg()
        + "</hp:p>"
    )
    return XMLDECL + f"<hs:sec {NS}>" + first + "".join(blocks) + "</hs:sec>"


# ------------------------------------------------------------------ packaging

_VERSION = (
    XMLDECL
    + '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version"'
    ' tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1"'
    ' buildNumber="0" os="1" xmlVersion="1.4" application="Hancom Office Hangul"'
    ' appVersion="9, 1, 1, 5656 WIN32LEWindows_Unknown_Version"/>'
)

_CONTAINER = (
    XMLDECL
    + '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container"'
    ' xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles>'
    '<ocf:rootfile full-path="Contents/content.hpf"'
    ' media-type="application/hwpml-package+xml"/>'
    '<ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/>'
    '<ocf:rootfile full-path="META-INF/container.rdf"'
    ' media-type="application/rdf+xml"/>'
    "</ocf:rootfiles></ocf:container>"
)

# Hangul emits an empty ODF manifest; the real part list lives in content.hpf.
_MANIFEST = (
    XMLDECL
    + '<odf:manifest'
    ' xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>'
)

_CONTAINER_RDF = (
    XMLDECL
    + '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    '<rdf:Description rdf:about="Contents/content.hpf">'
    '<rdf:type rdf:resource="http://www.hancom.co.kr/schema/2011/hpf#Document"/>'
    "</rdf:Description></rdf:RDF>"
)

_SETTINGS = (
    XMLDECL
    + '<ha:HWPApplicationSetting'
    ' xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"'
    ' xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app">'
    '<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>'
    '<config:config-item-set config:name="HwpUserSetting">'
    '<config:config-item-set config:name="ViewProperties">'
    '<config:config-item config:name="ZoomType" config:type="int">0</config:config-item>'
    '</config:config-item-set></config:config-item-set>'
    "</ha:HWPApplicationSetting>"
)


def _content_hpf(title, stamp):
    return (
        XMLDECL
        + f"<opf:package {NS} version=\"\" unique-identifier=\"\" id=\"\">"
        "<opf:metadata>"
        f"<opf:title>{escape(title)}</opf:title>"
        "<opf:language>ko</opf:language>"
        '<opf:meta name="creator" content="text"/>'
        '<opf:meta name="subject" content="text"/>'
        '<opf:meta name="description" content="text"/>'
        '<opf:meta name="lastsaveby" content="text"/>'
        f'<opf:meta name="CreatedDate" content="text">{stamp}</opf:meta>'
        f'<opf:meta name="ModifiedDate" content="text">{stamp}</opf:meta>'
        '<opf:meta name="keyword" content="text"/>'
        "</opf:metadata>"
        "<opf:manifest>"
        '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>'
        '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>'
        '<opf:item id="settings" href="settings.xml" media-type="application/xml"/>'
        "</opf:manifest>"
        '<opf:spine><opf:itemref idref="header" linear="yes"/>'
        '<opf:itemref idref="section0" linear="yes"/></opf:spine>'
        "</opf:package>"
    )


def write_hwpx(path, title, section_xml, preview_text=""):
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        # mimetype must be the first entry and stored uncompressed
        zi = zipfile.ZipInfo("mimetype")
        zi.compress_type = zipfile.ZIP_STORED
        z.writestr(zi, b"application/hwp+zip")
        z.writestr("version.xml", _VERSION.encode("utf-8"))
        z.writestr("settings.xml", _SETTINGS.encode("utf-8"))
        z.writestr("META-INF/container.xml", _CONTAINER.encode("utf-8"))
        z.writestr("META-INF/manifest.xml", _MANIFEST.encode("utf-8"))
        z.writestr("META-INF/container.rdf", _CONTAINER_RDF.encode("utf-8"))
        z.writestr("Contents/content.hpf", _content_hpf(title, stamp).encode("utf-8"))
        z.writestr("Contents/header.xml", build_header().encode("utf-8"))
        z.writestr("Contents/section0.xml", section_xml.encode("utf-8"))
        z.writestr("Preview/PrvText.txt", preview_text.encode("utf-8"))
