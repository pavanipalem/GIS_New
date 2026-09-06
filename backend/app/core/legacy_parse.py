"""Parsers for the free-text values the legacy forms accept.

These mirror gis.parse_legacy_date / gis.parse_legacy_year in
db/100_backfill_substations.sql exactly. Both exist because the historical
backfill runs in SQL while new writes come through the API, and the two must
agree - a value typed into the rewrite has to land the same way the same
value did during migration. Change one, change the other; tests/test_legacy_parse.py
pins the shared cases.
"""

from __future__ import annotations

import re
from datetime import date

# day-first, with . / and - all accepted as separators
_DATE_RE = re.compile(r"^([0-9]{1,2})-([0-9]{1,2})-([0-9]{2}|[0-9]{4})$")
_YEAR_ONLY_RE = re.compile(r"^(19|20)[0-9]{2}$")

# Two-digit years at or below this are read as 2000s, above as 1900s.
_TWO_DIGIT_PIVOT = 40


def parse_legacy_date(raw: str | None) -> date | None:
    """Day-first date parser covering the ~8 formats in the legacy columns.

    "7/8/2009" is 7 August 2009, "10-1-2015" is 10 January 2015, and
    "18-09-15" is 2015. Anything unparseable returns None rather than raising -
    the caller keeps the original text in a *_raw column.
    """
    s = (raw or "").strip()
    if not s:
        return None

    s = s.replace(".", "-").replace("/", "-")
    m = _DATE_RE.match(s)
    if m is None:
        return None

    dd, mm = int(m[1]), int(m[2])
    yy = int(m[3])
    if len(m[3]) == 2:
        yy = 2000 + yy if yy <= _TWO_DIGIT_PIVOT else 1900 + yy

    if not (1 <= mm <= 12 and 1 <= dd <= 31 and 1900 <= yy <= 2100):
        return None

    try:
        return date(yy, mm, dd)
    except ValueError:
        # e.g. 31-02-2015
        return None


def parse_legacy_year(raw: str | None) -> int | None:
    """Year from a full date, or from a bare "2024"."""
    s = (raw or "").strip()
    if not s:
        return None

    d = parse_legacy_date(s)
    if d is not None:
        return d.year

    return int(s) if _YEAR_ONLY_RE.match(s) else None


def tnull(raw: str | None) -> str | None:
    """Trim to None, so a blank form field never becomes an empty string."""
    if raw is None:
        return None
    s = raw.strip()
    return s or None
