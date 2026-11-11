"""Build STI Vio-Log Security Assurance handbook DOCX + PDF from markdown."""
from __future__ import annotations

import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
MD_PATH = ROOT / "STI_Vio_Log_Security_Assurance_and_Defense_Handbook.md"
DOCX_PATH = ROOT / "STI_Vio_Log_Security_Assurance_and_Defense_Handbook.docx"
PDF_PATH = ROOT / "STI_Vio_Log_Security_Assurance_and_Defense_Handbook.pdf"
FIG = ROOT / "figures"

NAVY = RGBColor(0x0B, 0x1F, 0x4A)
GOLD = RGBColor(0xC9, 0xA2, 0x27)
STEEL = RGBColor(0x2E, 0x5A, 0x88)
BODY = RGBColor(0x1A, 0x1A, 0x1A)
MUTED = RGBColor(0x4A, 0x55, 0x68)

NAVY_HEX = (11, 31, 74)
GOLD_HEX = (201, 162, 39)
STEEL_HEX = (46, 90, 136)
LIGHT = (232, 240, 248)


def set_run_font(run, name="Calibri", size=11, bold=False, color=BODY, italic=False):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color


def shade_cell(cell, hex_color):
    tc = cell._tePr if hasattr(cell, "_tePr") else cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def set_cell_border(cell):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:color"), "C5D0DE")
        tcBorders.append(el)
    tcPr.append(tcBorders)


def add_page_number(paragraph):
    run1 = paragraph.add_run("Page ")
    set_run_font(run1, size=9, color=MUTED)
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    r = paragraph.add_run()
    r._r.append(fld1)
    r._r.append(instr)
    r._r.append(fld2)
    set_run_font(r, size=9, color=MUTED)
    run2 = paragraph.add_run(" of ")
    set_run_font(run2, size=9, color=MUTED)
    fld3 = OxmlElement("w:fldChar")
    fld3.set(qn("w:fldCharType"), "begin")
    instr2 = OxmlElement("w:instrText")
    instr2.set(qn("xml:space"), "preserve")
    instr2.text = " NUMPAGES "
    fld4 = OxmlElement("w:fldChar")
    fld4.set(qn("w:fldCharType"), "end")
    r2 = paragraph.add_run()
    r2._r.append(fld3)
    r2._r.append(instr2)
    r2._r.append(fld4)
    set_run_font(r2, size=9, color=MUTED)


def add_horizontal_line(paragraph):
    p = paragraph._p
    pPr = p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "0B1F4A")
    pBdr.append(bottom)
    pPr.append(pBdr)


def try_font(size):
    for name in ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded_box(draw, xy, fill, outline, width=3):
    draw.rounded_rectangle(xy, radius=16, fill=fill, outline=outline, width=width)


def center_text(draw, xy, text, font, fill=(255, 255, 255)):
    x0, y0, x1, y1 = xy
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((x0 + x1 - tw) / 2, (y0 + y1 - th) / 2), text, font=font, fill=fill)


def draw_architecture():
    FIG.mkdir(exist_ok=True)
    img = Image.new("RGB", (1600, 900), (248, 250, 252))
    d = ImageDraw.Draw(img)
    title_f = try_font(28)
    box_f = try_font(20)
    small = try_font(16)
    d.text((48, 28), "STI Vio-Log verified architecture (illustrative, not a scan)", font=title_f, fill=NAVY_HEX)
    boxes = [
        (60, 180, 340, 340, "Students & staff\nbrowsers", NAVY_HEX),
        (420, 180, 760, 340, "Vercel SPA\nstiviolog.com\nCSP + /api proxy", STEEL_HEX),
        (840, 180, 1180, 340, "Render Express\nCookie session API\nSocket.IO polling", NAVY_HEX),
        (1260, 180, 1540, 340, "Supabase\nPostgreSQL\nparameterized SQL", STEEL_HEX),
        (420, 520, 760, 680, "Google GIS\nID token (students)", GOLD_HEX),
        (840, 520, 1180, 680, "Brevo email\nOTP / notices", STEEL_HEX),
    ]
    for x0, y0, x1, y1, text, fill in boxes:
        rounded_box(d, (x0, y0, x1, y1), fill, (255, 255, 255), 2)
        lines = text.split("\n")
        h = (y1 - y0) / (len(lines) + 1)
        for i, line in enumerate(lines):
            center_text(d, (x0, y0 + h * i, x1, y0 + h * (i + 2)), line, box_f if i == 0 else small)
    arrows = [(340, 260, 420, 260), (760, 260, 840, 260), (1180, 260, 1260, 260), (590, 340, 590, 520), (1010, 340, 1010, 520)]
    for x0, y0, x1, y1 in arrows:
        d.line((x0, y0, x1, y1), fill=GOLD_HEX, width=6)
    d.text((48, 820), "Cloudflare omitted — not independently verified. Same-origin browser cookies on Vercel.", font=small, fill=MUTED)
    path = FIG / "architecture.png"
    img.save(path, "PNG")
    return path


def draw_auth_flow():
    FIG.mkdir(exist_ok=True)
    img = Image.new("RGB", (1600, 1000), (248, 250, 252))
    d = ImageDraw.Draw(img)
    title_f = try_font(28)
    box_f = try_font(18)
    small = try_font(16)
    d.text((48, 24), "Authentication and authorization (actual model)", font=title_f, fill=NAVY_HEX)
    steps = [
        "1. Browser opens stiviolog.com (Vercel)",
        "2. Login / Google ID token / admin MFA",
        "3. API sets HttpOnly sti_session + sti_csrf",
        "4. Later requests send cookies; writes send X-CSRF-Token",
        "5. authenticateToken hashes cookie, loads users.role from DB",
        "6. authorizeRoles / permissions / requireExactRoles / department",
        "7. Parameterized SQL; 401/403 if denied",
    ]
    y = 100
    for i, step in enumerate(steps):
        fill = NAVY_HEX if i % 2 == 0 else STEEL_HEX
        rounded_box(d, (120, y, 1480, y + 90), fill, (255, 255, 255), 2)
        d.text((160, y + 28), step, font=box_f, fill=(255, 255, 255))
        if i < len(steps) - 1:
            d.polygon([(800, y + 90), (820, y + 108), (780, y + 108)], fill=GOLD_HEX)
        y += 118
    d.text((48, 950), "Production does not mint Bearer JWT. Frontend hiding a button is not authorization.", font=small, fill=MUTED)
    path = FIG / "auth-flow.png"
    img.save(path, "PNG")
    return path


def add_formatted_text(paragraph, text, size=11, color=BODY):
    parts = re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text)
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            set_run_font(run, size=size, bold=True, color=NAVY)
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            set_run_font(run, name="Consolas", size=size - 1, color=STEEL)
        else:
            run = paragraph.add_run(part)
            set_run_font(run, size=size, color=color)


def configure_styles(doc: Document):
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    header = section.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.text = ""
    r = hp.add_run("STI Vio-Log  |  Security Assurance & Capstone Defense Handbook")
    set_run_font(r, size=9, color=NAVY, bold=True)
    hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_horizontal_line(hp)
    footer = section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.text = ""
    r = fp.add_run("Internal academic document  ·  No secrets  ·  v1.0  ·  ")
    set_run_font(r, size=9, color=MUTED)
    add_page_number(fp)
    fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.font.color.rgb = BODY
    pf = normal.paragraph_format
    pf.space_after = Pt(8)
    pf.line_spacing_rule = WD_LINE_SPACING.SINGLE
    for i, size in ((1, 18), (2, 14), (3, 12)):
        style = doc.styles[f"Heading {i}"]
        style.font.name = "Calibri"
        style.font.bold = True
        style.font.size = Pt(size)
        style.font.color.rgb = NAVY
        style.paragraph_format.space_before = Pt(14 if i == 1 else 10)
        style.paragraph_format.space_after = Pt(6)


def add_cover(doc: Document):
    banner = doc.add_table(rows=1, cols=1)
    banner.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = banner.cell(0, 0)
    shade_cell(cell, "0B1F4A")
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("STI GLOBAL CITY")
    set_run_font(r, size=14, bold=True, color=RGBColor(255, 255, 255))
    p2 = cell.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p2.add_run("Discipline Office Portal")
    set_run_font(r, size=11, color=GOLD)
    doc.add_paragraph()
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("STI Vio-Log: A Web-Based Student Violation Monitoring\nand Incident Management System for STI Global City")
    set_run_font(r, size=16, bold=True, color=NAVY)
    doc.add_paragraph()
    h = doc.add_paragraph()
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = h.add_run("SECURITY ASSURANCE &\nCAPSTONE DEFENSE HANDBOOK")
    set_run_font(r, size=22, bold=True, color=NAVY)
    s = doc.add_paragraph()
    s.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = s.add_run("Security Architecture, Implemented Protection Mechanisms,\nVulnerability Assessment, Evidence Documentation,\nand Technical Defense Preparation")
    set_run_font(r, size=12, italic=True, color=STEEL)
    doc.add_paragraph()
    meta = [
        ("Prepared for", "STI Global City Capstone Defense"),
        ("Prepared by", "STI Vio-Log Development Team"),
        ("Document version", "1.0"),
        ("Date of assessment", "10 November 2026"),
        ("Source commit", "1255e0e"),
        ("Verdict", "CONDITIONALLY READY"),
        ("Scope", "Source, local tests, public unauthenticated production smoke"),
    ]
    table = doc.add_table(rows=len(meta), cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (k, v) in enumerate(meta):
        c0, c1 = table.cell(i, 0), table.cell(i, 1)
        shade_cell(c0, "0B1F4A")
        shade_cell(c1, "F4F7FB")
        set_cell_border(c0)
        set_cell_border(c1)
        p = c0.paragraphs[0]
        r = p.add_run(k)
        set_run_font(r, size=10, bold=True, color=RGBColor(255, 255, 255))
        p = c1.paragraphs[0]
        r = p.add_run(v)
        set_run_font(r, size=10, color=BODY)
    note = doc.add_paragraph()
    add_formatted_text(
        note,
        "This handbook is not an OWASP, NIST, or ISO certificate. Production authentication is an opaque cookie session, not JWT. Cloudflare is not verified.",
        size=10,
        color=MUTED,
    )
    doc.add_page_break()


def add_toc(doc: Document):
    p = doc.add_paragraph()
    r = p.add_run("Table of contents")
    set_run_font(r, size=18, bold=True, color=NAVY)
    hint = doc.add_paragraph()
    add_formatted_text(
        hint,
        "In Microsoft Word: right-click the field below and choose Update Field. The PDF build updates fields automatically.",
        size=10,
        color=MUTED,
    )
    paragraph = doc.add_paragraph()
    run = paragraph.add_run()
    fldBegin = OxmlElement("w:fldChar")
    fldBegin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = ' TOC \\o "1-2" \\h \\z \\u '
    fldSeparate = OxmlElement("w:fldChar")
    fldSeparate.set(qn("w:fldCharType"), "separate")
    fldEnd = OxmlElement("w:fldChar")
    fldEnd.set(qn("w:fldCharType"), "end")
    run._r.append(fldBegin)
    run._r.append(instr)
    run._r.append(fldSeparate)
    run._r.append(fldEnd)
    doc.add_page_break()


def add_table(doc, rows):
    if not rows:
        return
    cols = len(rows[0])
    table = doc.add_table(rows=len(rows), cols=cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    for r_i, row in enumerate(rows):
        for c_i, val in enumerate(row):
            cell = table.cell(r_i, c_i)
            set_cell_border(cell)
            if r_i == 0:
                shade_cell(cell, "0B1F4A")
            elif r_i % 2 == 0:
                shade_cell(cell, "F4F7FB")
            cell.text = ""
            p = cell.paragraphs[0]
            run = p.add_run(val)
            if r_i == 0:
                set_run_font(run, size=9, bold=True, color=RGBColor(255, 255, 255))
            else:
                set_run_font(run, size=8, color=BODY)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
    doc.add_paragraph()


def parse_and_build(doc: Document, md_text: str):
    lines = md_text.splitlines()
    i = 0
    skipped_title = False
    in_code = False
    code_lines: list[str] = []
    table_rows: list[list[str]] = []

    def flush_table():
        nonlocal table_rows
        if table_rows:
            body = [row for row in table_rows if not all(set(c) <= set("-: ") for c in row)]
            add_table(doc, body)
            table_rows = []

    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            flush_table()
            if in_code:
                p = doc.add_paragraph()
                run = p.add_run("\n".join(code_lines))
                set_run_font(run, name="Consolas", size=8, color=STEEL)
                p.paragraph_format.left_indent = Cm(0.4)
                in_code = False
                code_lines = []
            else:
                in_code = True
                code_lines = []
            i += 1
            continue
        if in_code:
            code_lines.append(line)
            i += 1
            continue
        if line.startswith("|") and "|" in line[1:]:
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            table_rows.append(cells)
            i += 1
            continue
        flush_table()
        if not line.strip() or line.strip() == "---":
            i += 1
            continue
        if line.startswith("![") and "](" in line:
            m = re.search(r"\(([^)]+)\)", line)
            if m:
                img_path = (ROOT / m.group(1)).resolve()
                if img_path.exists():
                    doc.add_picture(str(img_path), width=Cm(16.5))
                    cap = doc.add_paragraph()
                    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    add_formatted_text(cap, Path(m.group(1)).stem.replace("-", " ").title(), size=9, color=MUTED)
            i += 1
            continue
        if line.startswith("# ") and not skipped_title:
            skipped_title = True
            i += 1
            continue
        if line.startswith("# "):
            doc.add_heading(line[2:].strip(), level=1)
            i += 1
            continue
        if line.startswith("## "):
            doc.add_heading(line[3:].strip(), level=1)
            i += 1
            continue
        if line.startswith("### "):
            doc.add_heading(line[4:].strip(), level=2)
            i += 1
            continue
        if line.startswith("#### "):
            doc.add_heading(line[5:].strip(), level=3)
            i += 1
            continue
        if line.startswith("- "):
            p = doc.add_paragraph(style="List Bullet")
            add_formatted_text(p, line[2:].strip())
            i += 1
            continue
        if re.match(r"^\d+\.\s", line):
            p = doc.add_paragraph(style="List Number")
            add_formatted_text(p, re.sub(r"^\d+\.\s", "", line).strip())
            i += 1
            continue
        p = doc.add_paragraph()
        add_formatted_text(p, line.strip())
        i += 1
    flush_table()


def build_docx():
    draw_architecture()
    draw_auth_flow()
    md = MD_PATH.read_text(encoding="utf-8")
    doc = Document()
    configure_styles(doc)
    add_cover(doc)
    add_toc(doc)
    parse_and_build(doc, md)
    doc.save(DOCX_PATH)
    return DOCX_PATH


def word_available():
    from shutil import which
    return bool(which("WINWORD") or which("WINWORD.EXE"))


def build_pdf_word():
    import pythoncom
    import win32com.client

    pythoncom.CoInitialize()
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    try:
        doc = word.Documents.Open(str(DOCX_PATH))
        for toc in doc.TablesOfContents:
            toc.Update()
        doc.Repaginate()
        doc.Save()
        doc.SaveAs(str(PDF_PATH), FileFormat=17)
        doc.Close(False)
    finally:
        word.Quit()
        pythoncom.CoUninitialize()
    return PDF_PATH


def strip_md(text: str) -> str:
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text.replace("\u2014", "-").replace("\u2013", "-")


def build_pdf_fpdf():
    from fpdf import FPDF

    cal = "C:/Windows/Fonts/calibri.ttf"
    calb = "C:/Windows/Fonts/calibrib.ttf"
    cons = "C:/Windows/Fonts/consola.ttf"
    md = MD_PATH.read_text(encoding="utf-8")

    class HandbookPDF(FPDF):
        def header(self):
            if self.page_no() == 1:
                return
            self.set_font("Calibri", "B", 9)
            self.set_text_color(*NAVY_HEX)
            self.cell(0, 8, "STI Vio-Log  |  Security Assurance & Capstone Defense Handbook", new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(*NAVY_HEX)
            self.line(20, 16, 190, 16)
            self.ln(4)

        def footer(self):
            self.set_y(-15)
            self.set_font("Calibri", "", 8)
            self.set_text_color(74, 85, 104)
            self.cell(0, 8, f"Internal academic document  ·  No secrets  ·  v1.0  ·  Page {self.page_no()}/{{nb}}", align="C")

    pdf = HandbookPDF(format="A4", unit="mm")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("Calibri", "", cal)
    pdf.add_font("Calibri", "B", calb if Path(calb).exists() else cal)
    pdf.add_font("Calibri", "I", cal)
    if Path(cons).exists():
        pdf.add_font("Consolas", "", cons)
    pdf.add_page()
    pdf.set_fill_color(*NAVY_HEX)
    pdf.rect(20, 20, 170, 28, "F")
    pdf.set_xy(20, 24)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Calibri", "B", 14)
    pdf.cell(170, 8, "STI GLOBAL CITY", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Calibri", "", 11)
    pdf.set_text_color(*GOLD_HEX)
    pdf.set_x(20)
    pdf.cell(170, 8, "Discipline Office Portal", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(10)
    pdf.set_text_color(*NAVY_HEX)
    pdf.set_font("Calibri", "B", 16)
    pdf.multi_cell(0, 8, "STI Vio-Log: A Web-Based Student Violation Monitoring and Incident Management System for STI Global City", align="C")
    pdf.ln(4)
    pdf.set_font("Calibri", "B", 20)
    pdf.multi_cell(0, 9, "SECURITY ASSURANCE &\nCAPSTONE DEFENSE HANDBOOK", align="C")
    pdf.ln(3)
    pdf.set_font("Calibri", "I", 11)
    pdf.set_text_color(*STEEL_HEX)
    pdf.multi_cell(0, 6, "Security Architecture, Implemented Protection Mechanisms, Vulnerability Assessment, Evidence Documentation, and Technical Defense Preparation", align="C")
    pdf.ln(8)
    pdf.set_font("Calibri", "", 10)
    pdf.set_text_color(26, 26, 26)
    cover_rows = [
        ("Prepared for", "STI Global City Capstone Defense"),
        ("Prepared by", "STI Vio-Log Development Team"),
        ("Document version", "1.0"),
        ("Date of assessment", "10 November 2026"),
        ("Source commit", "1255e0e"),
        ("Verdict", "CONDITIONALLY READY"),
        ("Scope", "Source, local tests, public unauthenticated smoke"),
    ]
    for k, v in cover_rows:
        pdf.set_fill_color(*NAVY_HEX)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Calibri", "B", 9)
        pdf.cell(50, 8, k, fill=True, border=1)
        pdf.set_fill_color(244, 247, 251)
        pdf.set_text_color(26, 26, 26)
        pdf.set_font("Calibri", "", 9)
        pdf.cell(120, 8, v, fill=True, border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Calibri", "", 9)
    pdf.set_text_color(74, 85, 104)
    pdf.multi_cell(0, 5, "This handbook is not an OWASP, NIST, or ISO certificate. Production authentication is an opaque cookie session, not JWT. Cloudflare is not verified. Microsoft Word was not installed on the build machine, so this PDF is generated with the same A4 content as the Word file.")

    pdf.add_page()
    pdf.set_font("Calibri", "B", 16)
    pdf.set_text_color(*NAVY_HEX)
    pdf.cell(0, 10, "Table of contents", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Calibri", "", 11)
    pdf.set_text_color(26, 26, 26)
    toc_items = [
        "1. Executive security summary",
        "2. System overview",
        "3. Security architecture",
        "4. Security mechanisms",
        "5. Attack prevention and defense matrix",
        "6. Security evidence",
        "7. Security testing results",
        "8. Vulnerability assessment",
        "9. Security limitations and recommendations",
        "10. Capstone defense question bank",
        "11. Advanced panelist challenges",
        "12. Practical attack scenarios",
        "13. Defense speaking guide",
        "14. Security control matrix",
        "15. Final security assessment",
        "Appendices",
    ]
    for item in toc_items:
        pdf.cell(0, 7, item, new_x="LMARGIN", new_y="NEXT")

    lines = md.splitlines()
    i = 0
    in_code = False
    code_buf: list[str] = []
    skipped_title = False
    table_rows: list[list[str]] = []

    def flush_table():
        nonlocal table_rows
        if not table_rows:
            return
        body = [row for row in table_rows if not all(set(c) <= set("-: ") for c in row)]
        table_rows = []
        if not body:
            return
        cols = len(body[0])
        usable = 170
        col_w = usable / cols
        pdf.set_font("Calibri", "", 7)
        for r_i, row in enumerate(body):
            if r_i == 0:
                pdf.set_fill_color(*NAVY_HEX)
                pdf.set_text_color(255, 255, 255)
                pdf.set_font("Calibri", "B", 7)
            else:
                pdf.set_fill_color(244, 247, 251) if r_i % 2 == 0 else pdf.set_fill_color(255, 255, 255)
                pdf.set_text_color(26, 26, 26)
                pdf.set_font("Calibri", "", 7)
            row = (row + [""] * cols)[:cols]
            # Estimate row height from wrapped text
            heights = []
            for val in row:
                heights.append(max(6, pdf.get_string_width(strip_md(val)[:400]) / (col_w - 1) * 3.4 + 4))
            h = min(28, max(heights))
            if pdf.get_y() + h > 270:
                pdf.add_page()
            x0 = pdf.get_x()
            y0 = pdf.get_y()
            for c_i, val in enumerate(row):
                pdf.set_xy(x0 + c_i * col_w, y0)
                pdf.rect(x0 + c_i * col_w, y0, col_w, h, "DF")
                pdf.set_xy(x0 + c_i * col_w + 0.6, y0 + 0.6)
                pdf.multi_cell(col_w - 1.2, 3.2, strip_md(val)[:500], max_line_height=3.2)
            pdf.set_xy(pdf.l_margin, y0 + h)
        pdf.set_x(pdf.l_margin)
        pdf.ln(2)

    pdf.add_page()
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            flush_table()
            if in_code:
                pdf.set_x(pdf.l_margin)
                pdf.set_font("Consolas" if Path(cons).exists() else "Calibri", "", 7)
                pdf.set_text_color(*STEEL_HEX)
                pdf.multi_cell(0, 4, "\n".join(code_buf)[:4000])
                in_code = False
                code_buf = []
            else:
                in_code = True
                code_buf = []
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue
        if line.startswith("|") and "|" in line[1:]:
            table_rows.append([c.strip() for c in line.strip().strip("|").split("|")])
            i += 1
            continue
        flush_table()
        if not line.strip() or line.strip() == "---":
            i += 1
            continue
        if line.startswith("![") and "](" in line:
            m = re.search(r"\(([^)]+)\)", line)
            if m:
                img_path = ROOT / m.group(1)
                if img_path.exists():
                    if pdf.get_y() > 160:
                        pdf.add_page()
                    pdf.image(str(img_path), w=170)
                    pdf.set_font("Calibri", "I", 8)
                    pdf.set_text_color(74, 85, 104)
                    pdf.cell(0, 5, img_path.stem.replace("-", " ").title(), align="C", new_x="LMARGIN", new_y="NEXT")
            i += 1
            continue
        if line.startswith("# ") and not skipped_title:
            skipped_title = True
            i += 1
            continue
        if line.startswith("## "):
            if pdf.get_y() > 250:
                pdf.add_page()
            pdf.set_x(pdf.l_margin)
            pdf.set_font("Calibri", "B", 14)
            pdf.set_text_color(*NAVY_HEX)
            pdf.multi_cell(0, 8, strip_md(line[3:].strip()))
            i += 1
            continue
        if line.startswith("### "):
            pdf.set_x(pdf.l_margin)
            pdf.set_font("Calibri", "B", 12)
            pdf.set_text_color(*NAVY_HEX)
            pdf.multi_cell(0, 7, strip_md(line[4:].strip()))
            i += 1
            continue
        if line.startswith("#### "):
            pdf.set_x(pdf.l_margin)
            pdf.set_font("Calibri", "B", 11)
            pdf.set_text_color(*STEEL_HEX)
            pdf.multi_cell(0, 6, strip_md(line[5:].strip()))
            i += 1
            continue
        if line.startswith("- ") or re.match(r"^\d+\.\s", line):
            pdf.set_font("Calibri", "", 10)
            pdf.set_text_color(26, 26, 26)
            pdf.set_x(24)
            pdf.multi_cell(pdf.w - pdf.r_margin - 24, 5, strip_md(re.sub(r"^(?:- |\d+\.\s)", "• ", line).strip()))
            i += 1
            continue
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Calibri", "", 10)
        pdf.set_text_color(26, 26, 26)
        pdf.multi_cell(0, 5, strip_md(line.strip()))
        i += 1
    flush_table()
    pdf.output(str(PDF_PATH))
    return PDF_PATH


def main():
    print("Building DOCX…", flush=True)
    build_docx()
    print("Wrote", DOCX_PATH, "bytes", DOCX_PATH.stat().st_size, flush=True)
    if word_available():
        print("Building PDF via Word…", flush=True)
        build_pdf_word()
    else:
        print("Word not installed; building PDF via fpdf2 from the same markdown…", flush=True)
        build_pdf_fpdf()
    print("Wrote", PDF_PATH, "bytes", PDF_PATH.stat().st_size, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
