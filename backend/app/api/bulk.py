from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_editor
from app.models.user import User
from app.services import bulk_service
from app.services.excel_service import ImportResult, build_workbook
from app.services.excel_spec import SPECS

router = APIRouter(prefix="/bulk", tags=["bulk"], dependencies=[Depends(get_current_user)])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
# 20 MB: the largest realistic sheet here is a 500-tower feeder, far under this
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def _xlsx(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{kind}/template.xlsx")
def download_template(kind: str, db: Session = Depends(get_db)):
    """A blank sheet whose headers come from the current tables, so the
    template cannot drift from the schema the way the 2019 workbooks did."""
    if kind not in SPECS:
        return Response(status_code=404)
    return _xlsx(build_workbook(kind), f"{kind}-template.xlsx")


@router.get("/{kind}/export.xlsx")
def export(
    kind: str,
    feeder_id: int | None = Query(default=None, description="Required for towers"),
    db: Session = Depends(get_db),
):
    content = bulk_service.export_rows(db, kind, feeder_id)
    suffix = f"-feeder-{feeder_id}" if feeder_id is not None else ""
    return _xlsx(content, f"{kind}{suffix}.xlsx")


@router.post("/{kind}/import", response_model=ImportResult)
async def import_file(
    kind: str,
    file: UploadFile = File(...),
    feeder_id: int | None = Query(default=None, description="Required for towers"),
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
):
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        return ImportResult(
            errors=[{"row": 0, "message": "File is larger than 20 MB"}]  # type: ignore[list-item]
        )
    return bulk_service.import_rows(db, kind, content, user.username, feeder_id)
