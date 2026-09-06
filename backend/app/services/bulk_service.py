from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.line import Line
from app.schemas.assets import EhvConsumerFields, SolarPlantFields
from app.schemas.map import MapPoint
from app.schemas.network import LineCreate, LineUpdate, TowerCreate, TowerUpdate
from app.services import asset_service, line_service, tower_service
from app.services.excel_service import ImportResult, ImportRowError, build_workbook, parse_workbook
from app.services.excel_spec import SPECS

# ---------------------------------------------------------------------------
# Bulk import/export. Replaces Uploadtowerstemplate.aspx,
# Uploadlinestemplate.aspx and towersdownload.aspx.
#
# Two differences from the legacy uploader, both deliberate:
#
#   - it always inserted, so exporting a sheet, editing it and re-uploading
#     duplicated every row. Here a row carrying its id updates that record and
#     a row with a blank id creates one, which makes the round trip safe.
#   - it processed rows one at a time with no report. Here the whole file is
#     applied in one transaction and the caller gets counts plus a per-row
#     reason for anything rejected, so a bad cell in row 180 does not leave
#     179 rows half-applied.
# ---------------------------------------------------------------------------


def _point(record: dict[str, Any]) -> MapPoint | None:
    lat, lng = record.get("lat"), record.get("lng")
    if lat is None or lng is None:
        return None
    return MapPoint(lat=float(lat), lng=float(lng))


def _fields(record: dict[str, Any], kind: str) -> dict[str, Any]:
    """Only the columns present in the sheet, so an absent column leaves the
    stored value alone rather than blanking it."""
    columns, _, _ = SPECS[kind]
    known = {c.field for c in columns if not c.key and c.field not in ("lat", "lng")}
    return {k: v for k, v in record.items() if k in known}


def export_rows(db: Session, kind: str, feeder_id: int | None = None) -> bytes:
    rows: list[dict[str, Any]] = []

    if kind == "towers":
        if feeder_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "feeder_id is required when exporting towers"
            )
        page = tower_service.list_towers(db, feeder_id=feeder_id, limit=500, offset=0)
        collected = list(page.items)
        while len(collected) < page.total:
            nxt = tower_service.list_towers(
                db, feeder_id=feeder_id, limit=500, offset=len(collected)
            )
            if not nxt.items:
                break
            collected.extend(nxt.items)
        for t in collected:
            row = t.model_dump(exclude={"location"})
            row["lat"] = t.location.lat if t.location else None
            row["lng"] = t.location.lng if t.location else None
            rows.append(row)

    elif kind == "lines":
        page = line_service.list_lines(db, limit=500, offset=0)
        collected = list(page.items)
        while len(collected) < page.total:
            nxt = line_service.list_lines(db, limit=500, offset=len(collected))
            if not nxt.items:
                break
            collected.extend(nxt.items)
        # the list view is narrow; read each line in full so the sheet carries
        # every editable column
        for item in collected:
            rows.append(line_service.get_line(db, item.feeder_id).model_dump(exclude={"route"}))

    elif kind == "solar-plants":
        for s in asset_service.list_solar_plants(db):
            row = s.model_dump(exclude={"location"})
            row["lat"] = s.location.lat if s.location else None
            row["lng"] = s.location.lng if s.location else None
            rows.append(row)

    elif kind == "ehv-consumers":
        for e in asset_service.list_ehv_consumers(db):
            row = e.model_dump(exclude={"location"})
            row["lat"] = e.location.lat if e.location else None
            row["lng"] = e.location.lng if e.location else None
            rows.append(row)

    else:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown export: {kind}")

    return build_workbook(kind, rows)


def import_rows(
    db: Session,
    kind: str,
    content: bytes,
    username: str,
    feeder_id: int | None = None,
) -> ImportResult:
    if kind not in SPECS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown import: {kind}")
    if kind == "towers" and feeder_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "feeder_id is required when importing towers - the sheet does not carry it, "
            "the same way the old upload took it from the line you were viewing",
        )
    if kind == "towers" and db.get(Line, feeder_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Line {feeder_id} does not exist")

    records, errors = parse_workbook(kind, content)
    result = ImportResult(errors=list(errors))

    for record in records:
        row_no = record.get("__row__", 0)
        try:
            _apply_record(db, kind, record, username, feeder_id, result)
        except HTTPException as exc:
            result.skipped += 1
            result.errors.append(ImportRowError(row=row_no, message=str(exc.detail)))
        except Exception as exc:  # noqa: BLE001 - reported per row, not swallowed
            result.skipped += 1
            result.errors.append(ImportRowError(row=row_no, message=str(exc)))

    # one transaction for the whole file: a bad row later on must not leave
    # earlier rows half-applied
    if result.errors:
        db.rollback()
        result.created = 0
        result.updated = 0
    else:
        db.commit()

    if kind == "towers" and not result.errors and feeder_id is not None:
        line_service.rebuild_route(db, feeder_id)
        db.commit()

    return result


def _apply_record(
    db: Session,
    kind: str,
    record: dict[str, Any],
    username: str,
    feeder_id: int | None,
    result: ImportResult,
) -> None:
    fields = _fields(record, kind)
    point = _point(record)

    if kind == "towers":
        payload = {**fields, "location": point}
        key = record.get("tower_id")
        if key:
            tower_service.update_tower(db, int(key), TowerUpdate(**payload), username)
            result.updated += 1
        else:
            tower_service.create_tower(
                db, TowerCreate(feeder_id=int(feeder_id), **payload), username  # type: ignore[arg-type]
            )
            result.created += 1

    elif kind == "lines":
        key = record.get("feeder_id")
        if key:
            line_service.update_line(db, int(key), LineUpdate(**fields), username)
            result.updated += 1
        else:
            line_service.create_line(db, LineCreate(**fields), username)
            result.created += 1

    elif kind == "solar-plants":
        payload = SolarPlantFields(**{**fields, "location": point})
        key = record.get("solar_id")
        if key:
            asset_service.update_solar_plant(db, int(key), payload)
            result.updated += 1
        else:
            asset_service.create_solar_plant(db, payload)
            result.created += 1

    elif kind == "ehv-consumers":
        payload_e = EhvConsumerFields(**{**fields, "location": point})
        key = record.get("ehv_id")
        if key:
            asset_service.update_ehv_consumer(db, int(key), payload_e)
            result.updated += 1
        else:
            asset_service.create_ehv_consumer(db, payload_e)
            result.created += 1


def decimal_to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None
