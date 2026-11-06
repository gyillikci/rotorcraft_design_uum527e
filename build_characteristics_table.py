"""Build the 'General Rotorcraft Characteristics' comparison table (xlsx).

Data Status legend:
  P = Published by manufacturer (brochure / tech data sheet)
  D = Derived (computed from published data)
  E = Estimated / third-party source, verify before use
  U = Unknown / not publicly available
"""
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

AIRCRAFT = ["AW139", "H175", "AW189", "Bell 525 Relentless", "Sikorsky S-92", "Airbus H225"]

# (parameter, unit, [values per aircraft], status, source, notes)
ROWS = [
    ("Manufacturer", "",
     ["Leonardo Helicopters (ex-AgustaWestland)", "Airbus Helicopters (with AVIC)",
      "Leonardo Helicopters (ex-AgustaWestland)", "Bell Textron",
      "Sikorsky (Lockheed Martin)", "Airbus Helicopters (ex-Eurocopter)"],
     "P", "Manufacturer websites", "H175 co-developed with AVIC (Chinese variant AC352/Z-15)"),
    ("Aircraft designation / variant", "",
     ["AW139", "H175 (ex-EC175)", "AW189", "Bell 525 Relentless", "S-92A / S-92A+", "H225 (ex-EC225 LP Super Puma)"],
     "P", "Manufacturer websites", "Military variants: AW139M, H175M, H225M (Caracal)"),
    ("First flight / entry into service", "Year",
     ["2001 / 2004", "2009 / 2014", "2011 / 2014", "2015 / pending", "1998 / 2004", "2000 / 2005"],
     "P", "Manufacturer press releases; Wikipedia",
     "Bell 525: FAA certification/EIS pending as of last check - verify current status"),
    ("Primary mission", "",
     ["Multi-role: offshore, EMS, SAR, VIP, law enforcement", "Offshore oil & gas transport, SAR, VIP",
      "Offshore oil & gas transport, SAR", "Offshore oil & gas, SAR, VIP, utility",
      "Offshore oil & gas, SAR, VIP / head-of-state", "Offshore oil & gas, SAR, VIP"],
     "P", "Manufacturer websites", "AW139 = intermediate twin; others = super-medium / heavy twins"),
    ("Rotor configuration", "",
     ["Single MR, 5-blade fully articulated; 4-blade TR",
      "Single MR, 5-blade Spheriflex; 3-blade TR",
      "Single MR, 5-blade fully articulated; 4-blade TR",
      "Single MR, 5-blade; 4-blade TR",
      "Single MR, 4-blade fully articulated (elastomeric); 4-blade canted TR",
      "Single MR, 5-blade Spheriflex; 4-blade TR"],
     "P", "Manufacturer websites", "Bell 525 is first fly-by-wire commercial helicopter"),
    ("Engine configuration", "",
     ["2 x P&WC PT6C-67C", "2 x P&WC PT6C-67E", "2 x GE CT7-2E1",
      "2 x GE CT7-2F1", "2 x GE CT7-8A", "2 x Safran Makila 2A1"],
     "P", "Manufacturer websites", "All twin-turboshaft"),
    ("Passenger capacity", "persons",
     ["15", "16 (up to 18)", "19 (16-18 offshore)", "16 (up to 20)", "19", "19 offshore (up to 24)"],
     "P", "Manufacturer websites", "Max seats depend on cabin layout"),
    ("Crew capacity", "persons",
     ["1-2", "2", "2", "2", "2", "2"],
     "P", "Manufacturer websites", "AW139 certified for single-pilot IFR; others 2-pilot ops"),
    ("Cabin length", "m",
     ["2.70", "4.10", "3.48", "U", "6.10", "5.92"],
     "P (AW139) / E (others)", "Leonardo AW139 brochure; airport-technology; AeroCorner; GlobalAir",
     "Sources disagree on basis (with/without baggage/cockpit). AW189 cited 3.4-3.86 m; H225 value from GlobalAir"),
    ("Cabin width", "m",
     ["2.10", "2.13", "2.43", "U", "2.00", "1.75"],
     "P (AW139) / E (others)", "Leonardo AW139 brochure; airport-technology; AeroCorner; GlobalAir",
     "AW189 cited 2.40-2.43 m; S-92 cited 1.93-2.01 m"),
    ("Cabin height", "m",
     ["1.42", "1.40", "1.45", "1.37", "1.83", "1.41"],
     "P (AW139) / E (others)", "Leonardo AW139 brochure; airport-technology; Bell 525 press; GlobalAir",
     "Bell 525 height from '4.5 ft cabin' statement"),
    ("Overall length", "m",
     ["13.77", "15.68", "14.60", "U", "17.10", "16.79"],
     "E", "Third-party spec sheets", "Fuselage length (rotors excluded); rotors-turning length given as D-value"),
    ("Overall height", "m",
     ["4.98", "5.34", "5.07", "U", "5.46", "4.97"],
     "P / E", "Leonardo brochures; HK EPD report; LM S-92 data; Airbus",
     "Rotors turning (incl. tail rotor). S-92 airframe-only height 4.71 m"),
    ("Overall width", "m",
     ["13.80", "14.80", "14.60", "16.61", "17.17", "16.20"],
     "D", "= main rotor diameter",
     "Width with rotors turning = MR diameter; fuselage-only width not reliably published"),
    ("Main rotor diameter", "m",
     ["13.80", "14.80", "14.60", "16.61", "17.17", "16.20"],
     "P", "Leonardo brochures; HK EPD report; Bell 525 data; LM S-92 data; Airbus H225 tech data", ""),
    ("D-value", "m",
     ["16.66", "18.06", "17.57", "U", "20.88", "19.50"],
     "P", "Leonardo brochures; HK EPD report; LM S-92 data; Airbus H225 tech data (63.98 ft)",
     "Overall length, rotors turning (largest dimension, used for helideck sizing per CAP 437 / ICAO)"),
    ("Landing gear configuration", "",
     ["Retractable tricycle, wheeled"] * 6,
     "P", "Manufacturer websites", ""),
    ("Certification basis", "",
     ["EASA CS-29 / FAA Part 29, Cat. A", "EASA CS-29 (2014), Cat. A", "EASA CS-29 (2014) / FAA Part 29, Cat. A",
      "FAA Part 29 (TC pending)", "FAA Part 29 (2002) / EASA CS-29, Cat. A", "EASA CS-29 (JAR-29) / FAA Part 29, Cat. A"],
     "P / E", "EASA & FAA type certificate data sheets",
     "S-92 first rotorcraft certified to FAR 29 Amdt 47 (incl. bird strike / crashworthiness)"),
]

HEADERS = ["Parameter", "Unit", *AIRCRAFT, "Data Status (P/D/E/U)", "Source / Reference", "Notes"]

wb = Workbook()
ws = wb.active
ws.title = "General Characteristics"

dark = PatternFill("solid", fgColor="000000")
light = PatternFill("solid", fgColor="E8EFEA")
grey = PatternFill("solid", fgColor="C8CEC9")
thin = Side(style="thin", color="000000")
border = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap = Alignment(wrap_text=True, vertical="top")

ncol = len(HEADERS)
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncol)
ws.cell(1, 1, "General Rotorcraft Characteristics").font = Font(bold=True, size=12)
ws.cell(1, 1).alignment = Alignment(horizontal="center")

for c, h in enumerate(HEADERS, 1):
    cell = ws.cell(3, c, h)
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = dark
    cell.border = border
    cell.alignment = wrap

for r, (param, unit, vals, status, src, notes) in enumerate(ROWS, 4):
    fill = grey if r % 2 == 0 else light
    for c, v in enumerate([param, unit, *vals, status, src, notes], 1):
        cell = ws.cell(r, c, v)
        cell.fill = fill
        cell.border = border
        cell.alignment = wrap

legend_row = 4 + len(ROWS) + 1
ws.cell(legend_row, 1, "Data Status legend:").font = Font(bold=True)
for i, txt in enumerate([
    "P = Published (manufacturer brochure / technical data / TCDS)",
    "D = Derived (computed from published data)",
    "E = Estimated / third-party source - verify before use",
    "U = Unknown / not publicly available",
]):
    ws.cell(legend_row + 1 + i, 1, txt)

widths = [30, 9, 24, 24, 24, 24, 26, 26, 18, 38, 50]
for i, w in enumerate(widths, 1):
    ws.column_dimensions[ws.cell(3, i).column_letter].width = w
ws.freeze_panes = "C4"

wb.save("General_Rotorcraft_Characteristics.xlsx")
print("saved")
