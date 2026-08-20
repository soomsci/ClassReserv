#!/usr/bin/env python3
"""Validate .hwpx files. Run this on every file before handing it to the user.

    python3 validate_hwpx.py out/*.hwpx

Four independent checks:
  1. ZIP layout      - 'mimetype' first and STORED, required parts present
  2. OWPML schema    - header.xml / section0.xml against Hancom's XSD
  3. Package rules   - container/manifest/content.hpf coherence
  4. Round-trip读     - reopen with python-hwpx and report tables / text

Exit code is non-zero if any file fails a hard check.

Needs: pip install python-hwpx lxml
"""
import sys
import zipfile
from pathlib import Path

REQUIRED_PARTS = [
    "mimetype",
    "version.xml",
    "settings.xml",
    "META-INF/container.xml",
    "META-INF/manifest.xml",
    "Contents/content.hpf",
    "Contents/header.xml",
    "Contents/section0.xml",
]

# Advisory messages that genuine Hangul-produced files also trigger.
BENIGN = ("manifest does not reference a version part",)


def check_zip(path):
    """mimetype must be the first entry and uncompressed, per the OCF rules."""
    problems = []
    z = zipfile.ZipFile(path)
    names = z.namelist()
    if names[0] != "mimetype":
        problems.append(f"'mimetype' must be the first zip entry, found '{names[0]}'")
    elif z.getinfo("mimetype").compress_type != zipfile.ZIP_STORED:
        problems.append("'mimetype' must be STORED (uncompressed)")
    mt = z.read("mimetype").decode("utf-8", "replace") if "mimetype" in names else ""
    if mt != "application/hwp+zip":
        problems.append(f"mimetype content is {mt!r}, expected 'application/hwp+zip'")
    for part in REQUIRED_PARTS:
        if part not in names:
            problems.append(f"missing required part: {part}")
    if z.testzip() is not None:
        problems.append("corrupt zip member")
    return problems


def check_schema(path):
    """Validate the two XML parts against the official OWPML schemas.

    hwpx.tools.validator.validate_document() does NOT apply the schemas even
    when you pass them, so drive lxml directly with the loaded XMLSchema.
    """
    from lxml import etree
    from hwpx.tools import validator as dv

    problems = []
    schemas = dv.load_default_schemas()
    z = zipfile.ZipFile(path)
    for part, schema in (
        ("Contents/header.xml", schemas.header),
        ("Contents/section0.xml", schemas.section),
    ):
        doc = etree.fromstring(z.read(part))
        if not schema.validate(doc):
            for err in schema.error_log[:10]:
                problems.append(f"{part}:{err.line}: {err.message}")
    return problems


def check_package(path):
    from hwpx.tools import package_validator as pv

    hard, soft = [], []
    for issue in getattr(pv.validate_package(path), "issues", []):
        (soft if any(b in str(issue) for b in BENIGN) else hard).append(str(issue))
    for issue in getattr(pv.validate_editor_open_safety(path), "issues", []):
        hard.append(f"editor-open: {issue}")
    return hard, soft


def check_roundtrip(path):
    from hwpx.document import HwpxDocument

    doc = HwpxDocument.open(path)
    tables = [(t.row_count, t.column_count) for t in doc.tables]
    text = [p.text for p in doc.paragraphs if (p.text or "").strip()]
    return tables, text


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    failed = False
    for arg in argv:
        path = Path(arg)
        print("=" * 68)
        print(path.name)
        problems = check_zip(path)
        if problems:
            failed = True
            for p in problems:
                print("  [zip]    FAIL", p)
        else:
            print("  [zip]    ok")

        problems = check_schema(path)
        if problems:
            failed = True
            for p in problems:
                print("  [schema] FAIL", p)
        else:
            print("  [schema] ok - header.xml and section0.xml are OWPML-valid")

        hard, soft = check_package(path)
        for p in hard:
            failed = True
            print("  [pkg]    FAIL", p)
        for p in soft:
            print("  [pkg]    note (Hangul does this too):", p)
        if not hard:
            print("  [pkg]    ok")

        try:
            tables, text = check_roundtrip(path)
            print(f"  [read]   ok - tables={tables} text_paras={len(text)}")
            for t in text[:5]:
                print("             |", t[:70])
        except Exception as exc:  # a reader crash means Hangul may choke too
            failed = True
            print("  [read]   FAIL", type(exc).__name__, exc)

    print("=" * 68)
    print("RESULT:", "FAIL" if failed else "PASS")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
