"""Rebuild Saleh_Alsubaie_CV.pdf (2026-10-17) as an editable DOCX that mirrors the PDF layout.
Measurements were taken from the PDF with pdfplumber: A4, 34 pt side margins, Source Sans Pro,
name 15 pt bold, subtitle 10.5 pt, contact 9 pt, section headings 11 pt bold over a 0.6 pt rule,
body 9 pt on a 10.7 pt line pitch, bullets at +4 pt with text at +12 pt, dates right-aligned.
The text is copied verbatim from the PDF. Nothing is added or reworded."""
import sys
from docx import Document
from docx.shared import Pt, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = sys.argv[1] if len(sys.argv) > 1 else "Saleh_Alsubaie_CV_MASTER.docx"
FONT = "Source Sans Pro"
PAGE_W, PAGE_H = Pt(595.28), Pt(841.89)
MARGIN = Pt(34)
TEXT_W = 595.28 - 68

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = PAGE_W, PAGE_H
sec.left_margin = sec.right_margin = MARGIN
sec.top_margin = Pt(20); sec.bottom_margin = Pt(20)
sec.header_distance = Pt(10); sec.footer_distance = Pt(10)

st = doc.styles["Normal"]
st.font.name = FONT; st.font.size = Pt(9)
rpr = st.element.get_or_add_rPr()
rf = rpr.find(qn("w:rFonts"))
for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"): rf.set(qn(a), FONT)
pf = st.paragraph_format
pf.space_before = Pt(0); pf.space_after = Pt(0)
pf.line_spacing_rule = WD_LINE_SPACING.EXACTLY; pf.line_spacing = Pt(10.7)
doc.core_properties.title = "Saleh Abdullah Alsubaie CV"
doc.core_properties.author = "Saleh Abdullah Alsubaie"

def para(align=None, before=0, after=0, line=10.7):
    p = doc.add_paragraph()
    f = p.paragraph_format
    f.space_before = Pt(before); f.space_after = Pt(after)
    f.line_spacing_rule = WD_LINE_SPACING.EXACTLY; f.line_spacing = Pt(line)
    if align: p.alignment = align
    return p

def run(p, text, bold=False, italic=False, size=9):
    r = p.add_run(text); r.bold = bold; r.italic = italic; r.font.size = Pt(size); r.font.name = FONT
    return r

def right_tab(p):
    p.paragraph_format.tab_stops.add_tab_stop(Pt(TEXT_W), WD_TAB_ALIGNMENT.RIGHT)

def bottom_rule(p):
    pPr = p._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr"); b = OxmlElement("w:bottom")
    for k, v in (("w:val", "single"), ("w:sz", "5"), ("w:space", "1"), ("w:color", "000000")): b.set(qn(k), v)
    bdr.append(b); pPr.append(bdr)

def hyperlink(p, text, url, size=9):
    rid = p.part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    h = OxmlElement("w:hyperlink"); h.set(qn("r:id"), rid)
    r = OxmlElement("w:r"); rp = OxmlElement("w:rPr")
    fn = OxmlElement("w:rFonts")
    for a in ("w:ascii", "w:hAnsi", "w:cs"): fn.set(qn(a), FONT)
    sz = OxmlElement("w:sz"); sz.set(qn("w:val"), str(int(size * 2)))
    rp.append(fn); rp.append(sz); r.append(rp)
    t = OxmlElement("w:t"); t.text = text; r.append(t); h.append(r); p._p.append(h)

def heading(text):
    p = para(before=4, after=5, line=13)
    run(p, text, bold=True, size=11); bottom_rule(p)

def entry(title, org=None, date=None, before=1.5):
    p = para(before=before)
    run(p, title + ("," if org else ""), bold=True)
    if org: run(p, " " + org, italic=True)
    if date: right_tab(p); run(p, "\t" + date)
    return p

def bullet(text):
    p = para()
    f = p.paragraph_format
    f.left_indent = Pt(12); f.first_line_indent = Pt(-8)
    f.tab_stops.add_tab_stop(Pt(12))
    run(p, "•\t" + text)

# Header
p = para(WD_ALIGN_PARAGRAPH.CENTER, line=19); run(p, "Saleh Abdullah Alsubaie", bold=True, size=15)
p = para(WD_ALIGN_PARAGRAPH.CENTER, before=1, line=14)
run(p, "Senior Mechanical Engineering Student | Unmanned Systems, Systems Engineering, Business Development", size=10.5)
p = para(WD_ALIGN_PARAGRAPH.CENTER, before=1, line=12)
run(p, "iSalehAlsubaie@gmail.com    |    +966 50 338 2302    |    Riyadh, Saudi Arabia    |    ")
hyperlink(p, "LinkedIn", "https://linkedin.com/in/saleh-alsubaie-43a872269"); run(p, "    |    ")
hyperlink(p, "Portfolio", "https://isalehalsubaie-hash.github.io/navpod-project/portfolio/"); run(p, "    |    ")
hyperlink(p, "GitHub", "https://github.com/isalehalsubaie-hash")

heading("Profile")
p = para()
run(p, "Senior Mechanical Engineering student with a record of leading teams and delivering commercial outcomes. Founder of MIRQAB, a drone-based water intelligence system for industrial operations, and originator of NavPod, 2nd place winner at Defensathon 2026. At JNH Systems, built the business case for an autonomy initiative and led the company presence at LEAP 2026, lifting booth engagement 35% and securing 2 POC agreements. Graduating January 2027 and seeking a cooperative training placement in engineering, autonomous systems or business development.")

heading("Working Experience")
entry("UAV Systems Engineer / Business Development Engineer (Part-time)", "JNH Systems", "04/2026 – Present", before=0)
bullet("Built the business strategy and technical validation plan for an autonomy initiative, covering competitive benchmarking, use case definition and presentations to senior stakeholders")
bullet("Led business development for the docking station line, turning CAPEX and OPEX per station into payback and margin curves that set pricing and go-to-market direction")
bullet("Led the company presence at LEAP 2026, lifting booth engagement 35% and securing 2 new POC agreements")
bullet("Owned the mechanical design of the docking station from requirements to working prototype, coordinating suppliers and design reviews")
entry("Business Development Intern", "TalMal", "10/2026 – Present")
bullet("Source and onboard merchants into the network of a Saudi salary-backed pay-later fintech")
bullet("Pitch the service to employers so their employees can benefit from it")
entry("UAV Engineering Intern", "QSS AI & Robotics", "06/2026 – 08/2026")
bullet("Presented the department and its platforms to visiting delegations and investors, translating capability for non-technical decision makers")
bullet("Owned the full bill of materials, balancing fixed cost and performance targets across the platform")
bullet("Designed a fixed-wing platform from a clean sheet, carrying it from concept through detailed design to build")
entry("MEP Site Engineer Intern", "Athlath Construction", "07/2025 – 09/2025")
bullet("Coordinated multidisciplinary site crews of 15+ tradesmen against daily targets on an active construction site")
bullet("Reviewed 11+ engineering drawings across HVAC, plumbing and firefighting scopes and resolved clashes with contractors")
bullet("Oversaw on-site installations and enforced HSE requirements, working to a zero-incident standard")

heading("Projects")
entry("Founder & Team Lead, NavPod, Defensathon 2nd Place & SAR 15,000 Prize Winner", None, "01/2026 – Present", before=0)
bullet("Originated the concept and led a multidisciplinary team from first idea to 2nd place nationally, setting technical direction, allocating workstreams and owning delivery against a fixed deadline")
bullet("Positioned NavPod as a plug-in upgrade that lets existing drone fleets navigate without GPS")
bullet("Built the full flight simulation from scratch to validate the concept and support the pitch to judges")
bullet("Managed the hardware budget and procurement for the demo build, holding the pod to its 575 g weight target")
entry("Founder, MIRQAB, Water Intelligence System for Industrial Operations", None, "2026 – Present")
bullet("Built the value model on a live mining case: $484K gross annual value per facility, 3.2x return, 3.7-month payback")
entry("Professional Leadership Development Graduate, Misk Community / Akwaf Association", None, "11/2025 – 01/2026")
bullet("Co-led a 5-member team on the Masar project, securing 2nd place")
entry("Drone Operation & Drone Systems Development Bootcamps, Tuwaiq Academy", None, "10/2025 – 01/2026")
bullet("Led an autonomous aerial survey with a DJI Matrice 300 RTK, turning 147 images over 4,342 sqm into a 3D terrain model and orthomosaic")

heading("Education")
entry("Bachelor's Degree in Mechanical Engineering", "Imam Mohammad Ibn Saud Islamic University", "2022 – 01/2027", before=0)

heading("Skills")
def skill(label, text, first=False):
    p = para(before=0 if first else 2.2); run(p, label, bold=True)
    p = para(); run(p, text)
skill("Leadership & Coordination", "Cross-Functional Team Leadership, Project Lifecycle Management, Stakeholder Management, Executive Presentations, Vendor Management", True)
skill("Business & Commercial", "Business Case Development, Financial Modeling, CAPEX/OPEX Analysis, Feasibility Study, Go-to-Market Strategy, Proposal Writing, Risk Assessment")
skill("Operations & Data", "Asset Inspection, Survey and Mapping, Geospatial Data (GIS), Remote Sensing, Telemetry & Ground Control Systems, HSE Compliance")
skill("Engineering & Tools", "UAV Design & Operations, ArduPilot, Mission Planner, Autonomous Navigation, SLAM, Photogrammetry, SolidWorks, CAD, MATLAB, Simulink, C++, 3D Printing, PCB Design, HVAC Design")

heading("Certificates & Languages")
def cert(name, issuer, date=None, first=False):
    p = para(before=0 if first else 2)
    run(p, name + ("," if issuer and not issuer.startswith("(") else ""), bold=True)
    if issuer: run(p, " " + issuer, italic=True)
    if date: right_tab(p); run(p, "\t" + date)
cert("GACA Part 107 Non-Recreational UAV License", "(165+ flight hours)", first=True)
cert("Drone Operation & Development Bootcamps", "Tuwaiq Academy (165 hrs)")
cert("Forward Program", "McKinsey & Company", "09/2026")
cert("Certified Associate in Project Management (CAPM)", "Project Management Institute", "In Progress")
cert("TOEFL iBT", "ETS", "In Progress")
cert("OSHA Safety Certification", "Occupational Safety and Health Administration", "In Progress")
p = para(before=2); run(p, "Languages:", bold=True); run(p, " Arabic, English")

# drop the empty first paragraph python-docx creates
body = doc.element.body
first = body[0]
if first.tag == qn("w:p") and not "".join(first.itertext()).strip(): body.remove(first)
doc.save(OUT)
print("saved", OUT)
