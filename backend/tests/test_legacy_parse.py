"""Pins the Python parsers against the SQL ones they mirror.

app/core/legacy_parse.py and gis.parse_legacy_date/parse_legacy_year in
db/100_backfill_substations.sql implement the same rules for two different
paths - historical backfill vs new writes through the API. If they drift, a
value typed into the rewrite lands differently from the identical value
migrated from SQL Server, silently.

The parity test runs every distinct yoc_raw actually in the database through
both implementations. It is skipped when no database is reachable, so the
unit cases below still run anywhere.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.core.legacy_parse import parse_legacy_date, parse_legacy_year, tnull


class TestParseLegacyDate:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            # the formats actually present in ptrN_yoc
            ("28.12.2018", date(2018, 12, 28)),
            ("25-11-2015", date(2015, 11, 25)),
            ("01-05-2025", date(2025, 5, 1)),
            ("10-1-2015", date(2015, 1, 10)),
            ("4-6-2019", date(2019, 6, 4)),
            ("25.7.2024", date(2024, 7, 25)),
            # day-first, not month-first: 7 August, not 8 July
            ("7/8/2009", date(2009, 8, 7)),
            # two-digit years pivot at 40
            ("18-09-15", date(2015, 9, 18)),
            ("13-08-15", date(2015, 8, 13)),
            ("01-03-16", date(2016, 3, 1)),
        ],
    )
    def test_parses_legacy_formats(self, raw: str, expected: date) -> None:
        assert parse_legacy_date(raw) == expected

    @pytest.mark.parametrize(
        "raw",
        [
            None,
            "",
            "   ",
            "not commissioned",
            "2024",  # year alone is not a date
            "31-02-2015",  # impossible day for the month
            "13-13-2015",  # impossible month
            "01-01-1850",  # outside the accepted range
        ],
    )
    def test_returns_none_rather_than_raising(self, raw: str | None) -> None:
        assert parse_legacy_date(raw) is None


class TestParseLegacyYear:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("2024", 2024),
            ("1985", 1985),
            ("28.12.2018", 2018),  # year extracted from a full date
            ("18-09-15", 2015),
            (None, None),
            ("", None),
            ("not commissioned", None),
            ("24", None),  # bare two-digit is too ambiguous to accept
        ],
    )
    def test_year_from_date_or_bare_year(self, raw: str | None, expected: int | None) -> None:
        assert parse_legacy_year(raw) == expected


class TestTnull:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [(None, None), ("", None), ("   ", None), (" x ", "x"), ("x", "x")],
    )
    def test_trims_to_none(self, raw: str | None, expected: str | None) -> None:
        assert tnull(raw) == expected


class TestSqlParity:
    """Every distinct yoc_raw in the database, through both implementations."""

    def test_python_matches_sql(self) -> None:
        sqlalchemy = pytest.importorskip("sqlalchemy")
        try:
            from app.core.config import settings

            engine = sqlalchemy.create_engine(settings.database_url)
            with engine.connect() as conn:
                rows = conn.execute(
                    sqlalchemy.text(
                        """
                        SELECT DISTINCT yoc_raw,
                               gis.parse_legacy_date(yoc_raw) AS sql_date,
                               gis.parse_legacy_year(yoc_raw) AS sql_year
                        FROM gis.transformer
                        WHERE yoc_raw IS NOT NULL
                        """
                    )
                ).all()
        except Exception as exc:  # no DB configured or reachable
            pytest.skip(f"database not available: {exc}")

        if not rows:
            pytest.skip("no yoc_raw values loaded")

        mismatches = [
            {
                "raw": raw,
                "sql_date": sql_date,
                "py_date": parse_legacy_date(raw),
                "sql_year": sql_year,
                "py_year": parse_legacy_year(raw),
            }
            for raw, sql_date, sql_year in rows
            if parse_legacy_date(raw) != sql_date or parse_legacy_year(raw) != sql_year
        ]
        assert not mismatches, f"Python and SQL parsers disagree: {mismatches}"
