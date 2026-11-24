"""
Draws fake DQ documents for testing the photo-reading step.

Every image is marked SPECIMEN and uses the made-up sample drivers. Some
have deliberate problems (missing signature, card valid too long, short
registry number) so we can check the AI flags them.

Run:  python3 scripts/make-test-docs.py
Out:  test-fixtures/documents/*.jpg  and  expected.json (what each should read as)
"""

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "test-fixtures" / "documents"
SUP = "/System/Library/Fonts/Supplemental/"


def font(name, size):
    for path in (SUP + name, "/System/Library/Fonts/" + name):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default(size)


SANS = lambda s: font("Arial.ttf", s)
BOLD = lambda s: font("Arial Bold.ttf", s)
MONO = lambda s: font("Courier New.ttf", s)
HAND = lambda s: font("Bradley Hand Bold.ttf", s)
SIGN = lambda s: font("SnellRoundhand.ttc", s)

INK = (25, 30, 40)
GREY = (110, 115, 125)
LINE = (170, 175, 185)


# The sample drivers' license numbers, computed the same way as sample-fleet.ts.
DRIVERS = ["Marcus Webb TX", "Denise Alvarez GA", "Tyrell Jackson OH", "Linda Okafor TN",
           "Raymond Pike PA", "Sofia Marchetti IL", "Caleb Nguyen NC", "Patricia Holloway IN",
           "Omar Haddad MI", "Jerome Baptiste FL", "Hannah Lindqvist MN", "Walt Dreyer WI"]


def driver(name):
    for i, d in enumerate(DRIVERS):
        first, last, state = d.split()
        if f"{first} {last}" == name:
            return {"first": first, "last": last, "state": state,
                    "cdl": state + str(41000000 + i * 913277)[:8]}
    raise KeyError(name)


def us(d):  # 2026-11-20 -> 11/20/2026
    y, m, dd = d.split("-")
    return f"{m}/{dd}/{y}"


def specimen(img):
    """Big diagonal SPECIMEN watermark."""
    w, h = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = BOLD(int(min(w, h) * 0.16))
    text = "SPECIMEN"
    tw = d.textlength(text, font=f)
    d.text(((w - tw) / 2, h / 2 - f.size / 2), text, font=f, fill=(200, 40, 40, 38))
    layer = layer.rotate(24, resample=Image.BICUBIC, center=(w / 2, h / 2))
    img.alpha_composite(layer)
    ImageDraw.Draw(img).text((24, h - 34), "SPECIMEN — FAKE DOCUMENT FOR SOFTWARE TESTING ONLY", font=SANS(18), fill=(200, 40, 40))


def field(d, x, y, label, value, w=380, hand=True, size=30):
    d.text((x, y), label, font=SANS(17), fill=GREY)
    d.line((x, y + 58, x + w, y + 58), fill=LINE, width=2)
    if value:
        d.text((x + 4, y + 20), value, font=HAND(size) if hand else SANS(size - 4), fill=(20, 40, 110) if hand else INK)


def checkbox(d, x, y, label, checked):
    d.rectangle((x, y, x + 24, y + 24), outline=INK, width=2)
    if checked:
        d.line((x + 4, y + 12, x + 10, y + 20), fill=(20, 40, 110), width=4)
        d.line((x + 10, y + 20, x + 22, y + 2), fill=(20, 40, 110), width=4)
    d.text((x + 36, y), label, font=SANS(20), fill=INK)


def signature(d, x, y, name, w=380, label="Signature"):
    d.text((x, y + 66), label, font=SANS(17), fill=GREY)
    d.line((x, y + 60, x + w, y + 60), fill=LINE, width=2)
    if name:
        d.text((x + 10, y - 4), name, font=SIGN(54), fill=(20, 40, 110))


def page(w, h):
    img = Image.new("RGBA", (w, h), (252, 251, 247, 255))
    return img, ImageDraw.Draw(img)


# ── Document types ─────────────────────────────────────────────────────

def medical_card(who, exam, expires, examiner, registry, signed=True, waiver=False):
    p = driver(who)
    img, d = page(1700, 1100)
    d.rectangle((0, 0, 1700, 90), fill=(30, 60, 110))
    d.text((40, 22), "MEDICAL EXAMINER'S CERTIFICATE", font=BOLD(40), fill="white")
    d.text((1180, 34), "Commercial Driver Fitness Determination", font=SANS(20), fill="white")
    d.text((40, 110), "I certify that I have examined the driver below in accordance with the Federal Motor Carrier Safety", font=SANS(20), fill=INK)
    d.text((40, 138), "Regulations (49 CFR 391.41–391.49) and, with knowledge of the driving duties, find this person is qualified:", font=SANS(20), fill=INK)

    checkbox(d, 60, 190, "Meets standards in 49 CFR 391.41; qualifies for 2-year certificate", not waiver)
    checkbox(d, 60, 230, "Meets standards, but periodic monitoring required", False)
    checkbox(d, 60, 270, "Meets standards only when accompanied by a Skill Performance Evaluation certificate", waiver)
    checkbox(d, 900, 190, "Wearing corrective lenses", random.random() < 0.5)
    checkbox(d, 900, 230, "Wearing hearing aid", False)
    checkbox(d, 900, 270, "Accompanied by a waiver/exemption", waiver)

    field(d, 60, 340, "Driver's name (last, first)", f"{p['last']}, {p['first']}", 520)
    field(d, 640, 340, "Driver's license number", p["cdl"], 340)
    field(d, 1040, 340, "Issuing state", p["state"], 160)
    field(d, 1260, 340, "Date of examination", us(exam), 360)

    field(d, 60, 450, "Medical examiner's name (print)", examiner, 520)
    field(d, 640, 450, "National Registry number", registry, 340)
    field(d, 1040, 450, "Certificate expiration date", us(expires), 420)

    field(d, 60, 560, "Medical examiner's telephone", "(555) 014-2290", 380)
    field(d, 500, 560, "Office address", "1200 Fake Clinic Way, Springfield", 680)
    checkbox(d, 1260, 580, "MD", True)
    checkbox(d, 1360, 580, "DO", False)
    checkbox(d, 1460, 580, "NP", False)

    signature(d, 60, 690, examiner if signed else None, 640, "Medical examiner's signature")
    signature(d, 1000, 690, f"{p['first']} {p['last']}", 600, "Driver's signature")

    d.text((60, 900), "Form MCSA-5876 (specimen). The examiner's certificate may not be valid for more than 24 months.", font=SANS(18), fill=GREY)
    specimen(img)
    return img


def cdl_card(who, cls, issued, expires, endorsements, restrictions):
    p = driver(who)
    img, d = page(1012, 638)
    d.rounded_rectangle((0, 0, 1011, 637), 36, fill=(232, 240, 248), outline=(150, 170, 200), width=3)
    d.rectangle((0, 0, 1012, 96), fill=(25, 75, 130))
    d.text((32, 16), f"STATE OF {p['state']}  ·  SPECIMEN STATE", font=BOLD(26), fill="white")
    d.text((32, 54), "COMMERCIAL DRIVER LICENSE", font=BOLD(28), fill=(255, 220, 120))
    d.rectangle((32, 130, 262, 420), fill=(190, 200, 215), outline=(140, 150, 170))
    d.text((92, 260), "PHOTO", font=BOLD(30), fill=(120, 130, 150))

    rows = [("DL", p["cdl"]), ("CLASS", cls), ("EXP", us(expires)), ("ISS", us(issued)),
            ("LN", p["last"].upper()), ("FN", p["first"].upper()),
            ("END", " ".join(endorsements) or "NONE"), ("REST", " ".join(restrictions) or "NONE"),
            ("DOB", "04/12/1981")]
    y = 128
    for k, v in rows:
        d.text((300, y), k, font=BOLD(20), fill=(170, 40, 40))
        d.text((380, y - 4), v, font=BOLD(28), fill=INK)
        y += 46
    d.text((32, 440), f"{p['first']} {p['last']}", font=SIGN(48), fill=(20, 40, 110))
    specimen(img)
    return img


def letter(title, subtitle):
    img, d = page(1275, 1650)
    d.text((80, 70), title, font=BOLD(40), fill=INK)
    d.text((80, 124), subtitle, font=SANS(22), fill=GREY)
    d.line((80, 170, 1195, 170), fill=INK, width=3)
    return img, d


def mvr(who, pulled, violations):
    p = driver(who)
    img, d = letter("MOTOR VEHICLE RECORD", f"Department of Motor Vehicles · Specimen State of {p['state']}")
    lines = [("Name", f"{p['last'].upper()}, {p['first'].upper()}"), ("License number", p["cdl"]),
             ("License class", "A"), ("Status", "VALID"), ("Report date", us(pulled)), ("Record period", "3 years")]
    y = 210
    for k, v in lines:
        d.text((80, y), k, font=SANS(24), fill=GREY)
        d.text((420, y), v, font=MONO(28), fill=INK)
        y += 48
    d.text((80, y + 30), "VIOLATIONS AND CONVICTIONS", font=BOLD(26), fill=INK)
    y += 80
    for v in violations or ["None reported."]:
        d.text((100, y), v, font=MONO(24), fill=INK)
        y += 40
    specimen(img)
    return img


def annual_review(who, reviewed, reviewer, signed=True):
    p = driver(who)
    img, d = letter("ANNUAL REVIEW OF DRIVING RECORD", "Per 49 CFR 391.25 · Fake Freight Co. (specimen)")
    field(d, 80, 220, "Driver name", f"{p['first']} {p['last']}", 520)
    field(d, 680, 220, "License number / state", f"{p['cdl']} / {p['state']}", 500)
    field(d, 80, 340, "Date of review", us(reviewed), 400)
    field(d, 680, 340, "Date of MVR reviewed", us(reviewed), 400)
    d.text((80, 470), "I have reviewed the driving record of the above driver and determined that the driver:", font=SANS(24), fill=INK)
    checkbox(d, 100, 530, "Meets minimum requirements for safe driving", True)
    checkbox(d, 100, 575, "Is disqualified to drive a commercial motor vehicle (§391.15)", False)
    field(d, 80, 700, "Reviewed by (print name and title)", reviewer, 640)
    signature(d, 80, 840, reviewer.split(",")[0] if signed else None, 640, "Reviewer's signature")
    specimen(img)
    return img


def clearinghouse(who, queried, kind="Full"):
    p = driver(who)
    img, d = letter("CLEARINGHOUSE QUERY RESULT", "Drug and Alcohol Clearinghouse · specimen printout")
    lines = [("Query type", kind), ("Query date", us(queried)), ("Driver", f"{p['first']} {p['last']}"),
             ("CDL", f"{p['cdl']} ({p['state']})"), ("Employer", "Fake Freight Co."), ("Result", "No violation information found")]
    y = 220
    for k, v in lines:
        d.text((80, y), k, font=SANS(26), fill=GREY)
        d.text((400, y), v, font=BOLD(28), fill=INK)
        y += 60
    d.text((80, y + 40), "The driver is not prohibited from performing safety-sensitive functions.", font=SANS(24), fill=INK)
    specimen(img)
    return img


# ── Make it look like a phone photo ───────────────────────────────────

def as_photo(img, angle, seed):
    rnd = random.Random(seed)
    doc = img.convert("RGB")
    w, h = doc.size
    bg = Image.new("RGB", (int(w * 1.25), int(h * 1.3)), (rnd.randint(70, 110), rnd.randint(60, 90), rnd.randint(45, 70)))
    shadow = Image.new("L", doc.size, 0)
    ImageDraw.Draw(shadow).rectangle((0, 0, w, h), fill=140)
    rot = doc.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0))
    mask = Image.new("L", doc.size, 255).rotate(angle, expand=True)
    sh = shadow.rotate(angle, expand=True).filter(ImageFilter.GaussianBlur(18))
    ox, oy = (bg.width - rot.width) // 2, (bg.height - rot.height) // 2
    bg.paste((20, 15, 10), (ox + 14, oy + 18), sh)
    bg.paste(rot, (ox, oy), mask)
    # Uneven light: darker toward one corner.
    grad = Image.linear_gradient("L").resize(bg.size).rotate(rnd.choice([30, 120, 210, 300]))
    bg = Image.composite(bg, Image.eval(bg, lambda v: int(v * 0.78)), grad)
    return bg.filter(ImageFilter.GaussianBlur(0.8))


# ── The test set ───────────────────────────────────────────────────────

def doc(file, image, expected, angle=0.0):
    return {"file": file, "image": image, "expected": expected, "angle": angle}


SET = [
    doc("01-medical-denise-alvarez.jpg",
        medical_card("Denise Alvarez", "2026-11-18", "2028-11-18", "Dr. Priya Raman", "1234567890"),
        {"type": "MEDICAL_EXAMINER_CERTIFICATE", "driver": "Denise Alvarez", "issued": "2026-11-18", "expires": "2028-11-18",
         "examiner": "Dr. Priya Raman", "nrcme": "1234567890", "sigReviewer": True, "problems": []}, -3.5),
    doc("02-medical-marcus-webb.jpg",
        medical_card("Marcus Webb", "2026-11-21", "2027-11-21", "Dr. Alan Brooks", "9876543210"),
        {"type": "MEDICAL_EXAMINER_CERTIFICATE", "driver": "Marcus Webb", "issued": "2026-11-21", "expires": "2027-11-21",
         "examiner": "Dr. Alan Brooks", "nrcme": "9876543210", "sigReviewer": True, "problems": []}, 2.0),
    doc("03-medical-hannah-lindqvist-TOO-LONG.jpg",
        medical_card("Hannah Lindqvist", "2026-10-02", "2028-11-02", "Dr. Priya Raman", "1234567890"),
        {"type": "MEDICAL_EXAMINER_CERTIFICATE", "driver": "Hannah Lindqvist", "issued": "2026-10-02", "expires": "2028-11-02",
         "examiner": "Dr. Priya Raman", "nrcme": "1234567890", "sigReviewer": True,
         "problems": ["Expires more than 24 months after the exam"]}, -1.0),
    doc("04-medical-patricia-holloway-NO-SIGNATURE.jpg",
        medical_card("Patricia Holloway", "2026-11-10", "2028-11-10", "Dr. Alan Brooks", "9876543210", signed=False),
        {"type": "MEDICAL_EXAMINER_CERTIFICATE", "driver": "Patricia Holloway", "issued": "2026-11-10", "expires": "2028-11-10",
         "examiner": "Dr. Alan Brooks", "nrcme": "9876543210", "sigReviewer": False,
         "problems": ["Examiner signature missing"]}, 4.0),
    doc("05-medical-omar-haddad-SHORT-REGISTRY.jpg",
        medical_card("Omar Haddad", "2026-09-15", "2028-09-15", "Dr. Lena Ortiz", "45678123"),
        {"type": "MEDICAL_EXAMINER_CERTIFICATE", "driver": "Omar Haddad", "issued": "2026-09-15", "expires": "2028-09-15",
         "examiner": "Dr. Lena Ortiz", "nrcme": "45678123", "sigReviewer": True,
         "problems": ["Registry number is not 10 digits"]}, 0.0),
    doc("06-cdl-raymond-pike.jpg",
        cdl_card("Raymond Pike", "A", "2026-11-12", "2030-11-12", ["T", "N"], []),
        {"type": "COMMERCIAL_DRIVERS_LICENSE", "driver": "Raymond Pike", "issued": "2026-11-12", "expires": "2030-11-12",
         "cdlClass": "A", "endorsements": ["T", "N"], "restrictions": [], "problems": []}, -6.0),
    doc("07-annual-review-raymond-pike.jpg",
        annual_review("Raymond Pike", "2026-11-19", "Jordan Lee, Safety Manager"),
        {"type": "ANNUAL_DRIVING_RECORD_REVIEW", "driver": "Raymond Pike", "issued": "2026-11-19", "sigReviewer": True, "problems": []}, 1.5),
    doc("08-clearinghouse-raymond-pike.jpg",
        clearinghouse("Raymond Pike", "2026-11-19"),
        {"type": "DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD", "driver": "Raymond Pike", "issued": "2026-11-19", "problems": []}, -2.5),
    doc("09-mvr-caleb-nguyen.jpg",
        mvr("Caleb Nguyen", "2026-11-20", ["03/14/2025  SPEEDING 11-15 OVER  (CMV)  2 PTS"]),
        {"type": "MVR_REPORT", "driver": "Caleb Nguyen", "issued": "2026-11-20", "problems": []}, 3.0),
    doc("10-medical-sofia-marchetti-flat-scan.jpg",
        medical_card("Sofia Marchetti", "2026-11-03", "2028-11-03", "Dr. Lena Ortiz", "5550001112"),
        {"type": "MEDICAL_EXAMINER_CERTIFICATE", "driver": "Sofia Marchetti", "issued": "2026-11-03", "expires": "2028-11-03",
         "examiner": "Dr. Lena Ortiz", "nrcme": "5550001112", "sigReviewer": True, "problems": []}, None),
]


def main():
    random.seed(7)
    OUT.mkdir(parents=True, exist_ok=True)
    expected = {}
    for i, item in enumerate(SET):
        img = item["image"]
        out = img.convert("RGB") if item["angle"] is None else as_photo(img, item["angle"], i)
        out.save(OUT / item["file"], quality=88)
        expected[item["file"]] = item["expected"]
        print("wrote", item["file"])
    (OUT / "expected.json").write_text(json.dumps(expected, indent=2) + "\n")
    print("wrote expected.json")


if __name__ == "__main__":
    main()
