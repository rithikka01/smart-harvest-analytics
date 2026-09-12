import io
from datetime import datetime, timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

GREEN = colors.HexColor("#2E7D32")
STATUS_COLORS = {"normal": colors.HexColor("#2E7D32"), "warning": colors.HexColor("#F9A825"),
                 "critical": colors.HexColor("#C62828"), "ok": colors.HexColor("#2E7D32")}
LABELS = {"soil_moisture": ("Soil Moisture", "%"), "soil_temperature": ("Soil Temperature", "°C"),
          "ambient_temperature": ("Air Temperature", "°C"), "humidity": ("Humidity", "%"), "light_intensity": ("Light Intensity", "lux")}


def _table(rows, col_widths=None, header=True):
    t = Table(rows, colWidths=col_widths, hAlign="LEFT")
    style = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CFD8DC")),
             ("FONTSIZE", (0, 0), (-1, -1), 9), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F8E9")])]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), GREEN), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                  ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold")]
    t.setStyle(TableStyle(style))
    return t


def build_farm_report(farm, user, sensor, health, irrigation, weather, history, alerts) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm)
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=GREEN, fontSize=20, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=GREEN, fontSize=13, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=ss["BodyText"], fontSize=9.5, leading=13)
    note = ParagraphStyle("note", parent=body, textColor=colors.HexColor("#616161"), fontSize=8.5)

    el = [Paragraph("AgriSmart Farm Report", h1),
          Paragraph(f"Generated {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')} for {user.get('name', '')}", note)]

    loc = farm.get("location", {})
    el.append(Paragraph("Farm Profile", h2))
    el.append(_table([
        ["Farm name", farm.get("name", "")], ["Main crop", farm.get("crop_type", "")],
        ["Field size", f"{farm.get('field_size', '')} {farm.get('area_unit', 'acres')}"],
        ["Soil type", farm.get("soil_type") or "-"], ["Water source", farm.get("water_source") or "-"],
        ["Season", farm.get("season") or "-"],
        ["Location", f"{loc.get('address') or ''} ({loc.get('lat')}, {loc.get('lng')})"],
        ["Sensor path", farm.get("firebase_path") or f"farms/{farm['id']}/sensors"],
    ], col_widths=[45 * mm, 120 * mm], header=False))

    el.append(Paragraph("Latest Sensor Readings", h2))
    src = "LIVE IoT data (Firebase)" if sensor.get("source") == "firebase" else "SIMULATED / DEMO data - no live IoT feed connected"
    el.append(Paragraph(f"Data source: <b>{src}</b>. Reading time: {sensor.get('timestamp', '')}", note))
    rows = [["Metric", "Value", "Status"]]
    for k, (label, unit) in LABELS.items():
        rows.append([label, f"{sensor.get(k)} {unit}", sensor.get("metric_status", {}).get(k, "").upper()])
    t = _table(rows, col_widths=[60 * mm, 50 * mm, 40 * mm])
    for i, k in enumerate(LABELS.keys(), start=1):
        t.setStyle(TableStyle([("TEXTCOLOR", (2, i), (2, i), STATUS_COLORS.get(sensor.get("metric_status", {}).get(k), colors.black)),
                               ("FONTNAME", (2, i), (2, i), "Helvetica-Bold")]))
    el.append(t)
    el.append(Paragraph(f"Overall farm status: <b>{sensor.get('status', '').upper()}</b>", body))

    el.append(Paragraph("Crop Health Assessment", h2))
    el.append(Paragraph(f"<b>{health.get('health_status')}</b> - method: {health.get('method')} "
                        f"(confidence score {health.get('confidence')})", body))
    for r in health.get("reasons", []):
        el.append(Paragraph(f"• {r}", body))
    el.append(Paragraph("Recommendations:", body))
    for r in health.get("recommendations", []):
        el.append(Paragraph(f"• {r}", body))

    el.append(Paragraph("Irrigation Guidance", h2))
    decision = {"water_now": "WATER NOW", "wait": "WAIT", "not_needed": "NOT NEEDED"}.get(irrigation.get("decision"), "")
    el.append(Paragraph(f"<b>{decision}</b> - {irrigation.get('reason')}", body))
    if irrigation.get("water_amount"):
        el.append(Paragraph(f"Estimated water requirement: {irrigation['water_amount']:,} litres (~{irrigation.get('water_m3')} m³)", body))
    el.append(Paragraph(irrigation.get("timing", ""), body))
    el.append(Paragraph(irrigation.get("estimate_note", ""), note))

    el.append(Paragraph("Alerts", h2))
    for a in alerts:
        el.append(Paragraph(f"[{a['severity'].upper()}] {a['message']}", body))

    if weather:
        el.append(Paragraph("Weather Forecast (weatherapi.com)", h2))
        el.append(Paragraph(f"Now: {weather['current']['temp_c']}°C, {weather['current']['condition']}, humidity {weather['current']['humidity']}%", body))
        rows = [["Date", "Condition", "Max/Min °C", "Rain %", "Rain mm"]]
        for d in weather.get("forecast", []):
            rows.append([d["date"], d["condition"], f"{d['max_temp']}/{d['min_temp']}", str(d["rain_chance"]), str(d.get("total_precip_mm", 0))])
        el.append(_table(rows, col_widths=[25 * mm, 60 * mm, 30 * mm, 20 * mm, 20 * mm]))

    pts = history.get("points", [])
    if pts:
        el.append(Paragraph("Last 24h Trend Summary", h2))
        el.append(Paragraph(f"Series source: <b>{history.get('source', '').upper()}</b>. {history.get('note', '')}", note))
        rows = [["Metric", "Min", "Avg", "Max"]]
        for k, (label, unit) in LABELS.items():
            vals = [p[k] for p in pts if p.get(k) is not None]
            if vals:
                rows.append([label, f"{min(vals):.1f} {unit}", f"{sum(vals) / len(vals):.1f} {unit}", f"{max(vals):.1f} {unit}"])
        el.append(_table(rows, col_widths=[60 * mm, 35 * mm, 35 * mm, 35 * mm]))

    el.append(Spacer(1, 8))
    el.append(Paragraph("Crop health and irrigation outputs are rule-based estimates informed by sensor and weather data; "
                        "they are not a substitute for field inspection or advice from your agricultural officer.", note))
    doc.build(el)
    return buf.getvalue()
