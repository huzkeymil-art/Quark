#!/usr/bin/env python3
"""
homework_tracker.py
===================

Automates homework tracking:

    1. Logs into a Blackbaud "myschoolapp" portal (MyBGA) with Playwright.
    2. Opens the Assignment Center and scrapes the active assignments.
    3. Copies each *new* assignment into a Notion database (skipping duplicates).

Nothing is hardcoded -- credentials come from environment variables.

Quick start
-----------
    pip install -r requirements.txt
    playwright install chromium

    export SCHOOL_USERNAME="you@example.com"
    export SCHOOL_PASSWORD="..."
    export NOTION_TOKEN="ntn_..."
    export NOTION_DATABASE_ID="..."

    python homework_tracker.py --dry-run   # scrape only, don't touch Notion
    python homework_tracker.py             # the real thing

See HOMEWORK_TRACKER.md for the full setup guide.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Iterable, Optional

import requests

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Locator, Page
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

# Loading a local ".env" file is a convenience, not a requirement. If the
# python-dotenv package isn't installed we just carry on with real env vars.
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# The school's Blackbaud portal. Override with the SCHOOL_BASE_URL env var.
DEFAULT_SCHOOL_BASE_URL = "https://battlegroundacademy.myschoolapp.com"

# Where the Assignment Center lives. Blackbaud has shipped two generations of
# this page and schools sit on one or the other, so we try both in order.
# To pin it, set ASSIGNMENT_CENTER_URL to the address bar from your browser.
ASSIGNMENT_CENTER_PATHS = [
    "/lms-assignment/assignment-center/student?svcid=edu",  # current LMS
    "/app/student#studentmyday/assignment-center",          # legacy portal
]

# Notion's REST API. "2022-06-28" is the stable, widely documented version.
NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_API_VERSION = "2022-06-28"

# How long to wait for slow pages, in milliseconds.
NAVIGATION_TIMEOUT_MS = 45_000
ELEMENT_TIMEOUT_MS = 15_000

# If a scrape fails, we drop a screenshot here so you can see what the page
# actually looked like. Extremely handy when a selector stops matching.
DEBUG_SCREENSHOT_PATH = "assignment_center_debug.png"

# Duplicate detection. Blackbaud classes love recurring titles ("Reading Log",
# "Weekly Problem Set"), so by default we treat an assignment as a duplicate
# only when BOTH the title and the due date match. Set this to False to match
# on the title alone.
MATCH_ON_DUE_DATE = True


# ---------------------------------------------------------------------------
# Tiny logging helpers -- keeps the console output readable and consistent.
# ---------------------------------------------------------------------------


def log(message: str) -> None:
    """Ordinary progress message."""
    print(f"[..] {message}", flush=True)


def ok(message: str) -> None:
    """Something succeeded."""
    print(f"[ok] {message}", flush=True)


def warn(message: str) -> None:
    """Something looks off, but we can keep going."""
    print(f"[!]  {message}", flush=True)


def fail(message: str) -> None:
    """Something broke. Goes to stderr so it survives piping."""
    print(f"[x]  {message}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# The data we care about
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Assignment:
    """One homework assignment scraped from the portal."""

    title: str
    class_name: str
    due_date: Optional[str]  # ISO format, "YYYY-MM-DD", or None if unknown

    def key(self) -> tuple[str, str]:
        """Identity used to drop duplicates within a single run."""
        return (self.title.lower(), self.due_date or "")


# ---------------------------------------------------------------------------
# Text and date parsing
# ---------------------------------------------------------------------------

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Note the (?!\d) instead of \b at the end: the API returns full timestamps
# like "2026-09-15T00:00:00", and \b would not match between "5" and "T".
_ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})(?!\d)")
_NUMERIC_DATE_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?(?!\d)")
_MONTH_NAME_RE = re.compile(
    r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+"
    r"(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b",
    re.IGNORECASE,
)

# Lines that are obviously status chrome, not a class name.
_NOISE_LINE_RE = re.compile(
    r"^(due|assigned|to\s?do|in\s?progress|completed|overdue|graded|"
    r"turned\s?in|homework|assignment|test|quiz|project)\b[:\s]*",
    re.IGNORECASE,
)


def squash_whitespace(text: Optional[str]) -> str:
    """Collapse newlines/tabs/runs of spaces into single spaces and trim."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _safe_date(year: int, month: int, day: int) -> Optional[date]:
    """Build a date, returning None instead of raising on nonsense input."""
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _infer_year(month: int, day: int, today: Optional[date] = None) -> Optional[date]:
    """
    Pick a sensible year for a date written without one (e.g. "Sep 15").

    School years straddle January, so we choose whichever nearby year puts the
    date closest to today: roughly the last 6 months or the next 9.
    """
    today = today or date.today()
    candidate = _safe_date(today.year, month, day)
    if candidate is None:
        return None
    if (today - candidate).days > 180:
        return _safe_date(today.year + 1, month, day) or candidate
    if (candidate - today).days > 270:
        return _safe_date(today.year - 1, month, day) or candidate
    return candidate


def parse_due_date(raw: Optional[str], today: Optional[date] = None) -> Optional[str]:
    """
    Turn whatever the portal shows us into an ISO date string for Notion.

    Handles the formats Blackbaud actually emits:
        "9/15/2025", "09/15/25", "Due: Sep 15", "Monday, September 15, 2025",
        and the "2025-09-15T00:00:00" timestamps from its JSON API.

    Returns None when no date can be found -- callers decide what to do.
    """
    text = squash_whitespace(raw)
    if not text:
        return None

    # If the text says "Due: ...", the date almost certainly follows that word,
    # so look there first to avoid grabbing an "Assigned" date by mistake.
    haystacks = []
    due_match = re.search(r"due\b[^\w]*(.{0,40})", text, re.IGNORECASE)
    if due_match:
        haystacks.append(due_match.group(1))
    haystacks.append(text)

    for haystack in haystacks:
        iso = _ISO_DATE_RE.search(haystack)
        if iso:
            found = _safe_date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
            if found:
                return found.isoformat()

        numeric = _NUMERIC_DATE_RE.search(haystack)
        if numeric:
            month, day = int(numeric.group(1)), int(numeric.group(2))
            year_text = numeric.group(3)
            if year_text:
                year = int(year_text)
                if year < 100:  # "25" -> 2025
                    year += 2000
                found = _safe_date(year, month, day)
            else:
                found = _infer_year(month, day, today)
            if found:
                return found.isoformat()

        named = _MONTH_NAME_RE.search(haystack)
        if named:
            month = _MONTHS[named.group(1).lower()[:3]]
            day = int(named.group(2))
            year_text = named.group(3)
            found = (
                _safe_date(int(year_text), month, day)
                if year_text
                else _infer_year(month, day, today)
            )
            if found:
                return found.isoformat()

    return None


def looks_completed(text: str) -> bool:
    """True if a status string means the student is already done with it."""
    return bool(re.search(r"\b(completed|turned\s?in|graded)\b", text, re.IGNORECASE))


# ---------------------------------------------------------------------------
# Playwright helpers
# ---------------------------------------------------------------------------


def wait_for_any(
    page: Page,
    selectors: Iterable[str],
    timeout_ms: int = ELEMENT_TIMEOUT_MS,
    scope: Optional[Locator] = None,
) -> Optional[Locator]:
    """
    Poll a list of selectors and return the first one that becomes visible.

    Blackbaud portals differ from school to school (and between UI versions),
    so instead of betting on one selector we try several and take the winner.
    Returns None if none of them showed up before the timeout.
    """
    root: Any = scope if scope is not None else page
    deadline = time.monotonic() + timeout_ms / 1000

    while True:
        for selector in selectors:
            try:
                locator = root.locator(selector).first
                if locator.count() > 0 and locator.is_visible():
                    return locator
            except PlaywrightError:
                # A malformed or currently-detached selector: just try the next.
                continue
        if time.monotonic() >= deadline:
            return None
        time.sleep(0.25)


def first_text(scope: Locator, selectors: Iterable[str]) -> str:
    """Return the trimmed text of the first matching child element, or ""."""
    for selector in selectors:
        try:
            locator = scope.locator(selector).first
            if locator.count() > 0:
                text = squash_whitespace(locator.inner_text())
                if text:
                    return text
        except PlaywrightError:
            continue
    return ""


# ---------------------------------------------------------------------------
# Step 1: log into the Blackbaud portal
# ---------------------------------------------------------------------------

USERNAME_SELECTORS = [
    "#Username",
    "input[name='Username']",
    "input[name='username']",
    "input#login-username",
    "input[type='email']",
]

NEXT_BUTTON_SELECTORS = [
    "#nextBtn",
    "button#nextBtn",
    "input#nextBtn",
]

PASSWORD_SELECTORS = [
    "#Password",
    "input[name='Password']",
    "input[name='password']",
    "input[type='password']",
]

SIGN_IN_SELECTORS = [
    "#loginBtn",
    "button#loginBtn",
    "input#loginBtn",
    "button[type='submit']",
    "input[type='submit']",
]

LOGIN_ERROR_SELECTORS = [
    "#invalid-login",
    ".login-error",
    "[class*='error-message']",
    "[role='alert']",
]


def log_into_portal(page: Page, base_url: str, username: str, password: str) -> None:
    """
    Sign in at <base_url>/app#login.

    Blackbaud uses a two-step form: you type the username, press "Next", and
    only then does the password box appear. Some tenants show both at once, so
    we treat the "Next" click as optional.

    Raises RuntimeError if we can't confirm a successful login.
    """
    login_url = f"{base_url.rstrip('/')}/app#login"
    log(f"Opening login page: {login_url}")
    page.goto(login_url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)

    username_box = wait_for_any(page, USERNAME_SELECTORS)
    if username_box is None:
        raise RuntimeError(
            "Could not find the username field on the login page. The portal "
            "may use a different sign-in flow (see SSO note in the README)."
        )
    username_box.fill(username)

    # Step two of the form, when the portal uses one.
    next_button = wait_for_any(page, NEXT_BUTTON_SELECTORS, timeout_ms=3_000)
    if next_button is not None:
        next_button.click()

    password_box = wait_for_any(page, PASSWORD_SELECTORS)
    if password_box is None:
        # A redirect to Microsoft/Google means the school uses single sign-on,
        # which a username+password script can't drive.
        if re.search(r"(microsoftonline|okta|accounts\.google)", page.url, re.IGNORECASE):
            raise RuntimeError(
                f"The portal redirected to a single sign-on provider ({page.url}). "
                "This script only supports direct Blackbaud username/password login."
            )
        raise RuntimeError("The password field never appeared after entering the username.")

    password_box.fill(password)

    sign_in_button = wait_for_any(page, SIGN_IN_SELECTORS, timeout_ms=5_000)
    if sign_in_button is not None:
        sign_in_button.click()
    else:
        # No obvious button? Submitting the field usually works just as well.
        password_box.press("Enter")

    # Give the single-page app a moment to redirect and settle.
    try:
        page.wait_for_load_state("networkidle", timeout=NAVIGATION_TIMEOUT_MS)
    except PlaywrightTimeoutError:
        # A chatty page may never go fully idle; that alone isn't a failure.
        pass

    # Did it work? The portal is a single-page app, so the URL isn't a reliable
    # signal -- whether the password box is still on screen is. If it's gone,
    # we're in; if it's still there, look for a banner explaining why not.
    still_on_form = wait_for_any(page, PASSWORD_SELECTORS, timeout_ms=5_000)
    if still_on_form is not None:
        banner = wait_for_any(page, LOGIN_ERROR_SELECTORS, timeout_ms=2_000)
        detail = squash_whitespace(banner.inner_text()) if banner is not None else ""
        raise RuntimeError(
            f"The portal rejected the login: {detail}"
            if detail
            else "Still on the login page after submitting -- check "
            "SCHOOL_USERNAME and SCHOOL_PASSWORD."
        )

    ok("Logged in successfully")


# ---------------------------------------------------------------------------
# Step 2: scrape the Assignment Center
# ---------------------------------------------------------------------------

ASSIGNMENT_ITEM_SELECTORS = [
    # Legacy portal (/app/student#studentmyday/assignment-center)
    "#assignment-center-assignment-items .row",
    "#assignment-center-assignment-items > div",
    "div[id^='assignmentCenter'] .row",
    # Current LMS (/lms-assignment/assignment-center/student), a SKY UX app
    "[data-testid*='assignment-card']",
    "[data-testid*='assignment-item']",
    "[class*='assignment-card']",
    "sky-repeater-item",
    ".sky-list-item",
    "[class*='assignment-item']",
]

TITLE_SELECTORS = [
    "[class*='assignment-title']",
    "a.showAssignmentDetail",
    "a[onclick*='assignment']",
    "h3 a",
    "h3",
    "a",
]

CLASS_NAME_SELECTORS = [
    "[class*='assignment-group']",
    "[class*='groupname']",
    "[class*='course']",
    "[class*='section-title']",
    ".class-name",
]

DUE_DATE_SELECTORS = [
    "[class*='assignment-due']",
    "[class*='due-date']",
    "[class*='date-due']",
]


def _pick_class_name(card_text: str, title: str) -> str:
    """
    Best-effort guess at the class name from a card's raw text.

    Used only when no dedicated element matched. We walk the visible lines and
    take the first one that isn't the title and isn't obvious status chrome.
    """
    for line in (squash_whitespace(l) for l in card_text.splitlines()):
        if not line or line.lower() == title.lower():
            continue
        if _NOISE_LINE_RE.match(line):
            continue
        if _NUMERIC_DATE_RE.fullmatch(line) or _MONTH_NAME_RE.fullmatch(line):
            continue
        return line
    return "Unknown Class"


def scrape_assignments_from_dom(page: Page) -> list[Assignment]:
    """
    Read the assignments straight off the rendered Assignment Center page.

    Returns an empty list if the page structure doesn't match anything we know
    about -- the caller then falls back to the portal's JSON API.
    """
    container = wait_for_any(page, ASSIGNMENT_ITEM_SELECTORS, timeout_ms=ELEMENT_TIMEOUT_MS)
    if container is None:
        warn("No assignment rows matched the known page layouts.")
        return []

    # Figure out which selector actually matched so we can grab every sibling.
    cards = None
    for selector in ASSIGNMENT_ITEM_SELECTORS:
        try:
            candidate = page.locator(selector)
            if candidate.count() > 0:
                cards = candidate
                break
        except PlaywrightError:
            continue
    if cards is None:
        return []

    assignments: list[Assignment] = []
    total = cards.count()
    log(f"Found {total} candidate row(s) in the Assignment Center")

    for index in range(total):
        card = cards.nth(index)
        try:
            card_text = card.inner_text()
        except PlaywrightError:
            continue  # Row vanished mid-scrape (the SPA re-rendered).

        flat_text = squash_whitespace(card_text)
        if not flat_text:
            continue

        title = first_text(card, TITLE_SELECTORS)
        if not title:
            # Fall back to the first non-empty line of the row.
            lines = [squash_whitespace(l) for l in card_text.splitlines()]
            title = next((l for l in lines if l), "")
        if not title:
            continue

        class_name = first_text(card, CLASS_NAME_SELECTORS)
        if not class_name:
            class_name = _pick_class_name(card_text, title)

        due_text = first_text(card, DUE_DATE_SELECTORS) or flat_text
        due_date = parse_due_date(due_text)

        # Skip anything the portal already marks as finished.
        if looks_completed(flat_text):
            continue

        assignments.append(
            Assignment(title=title, class_name=class_name, due_date=due_date)
        )

    return assignments


# ---------------------------------------------------------------------------
# Reading assignments out of Blackbaud's JSON
#
# The two generations of the Assignment Center use different endpoints with
# different key names, so instead of hardcoding one shape we look for keys that
# mean "title" / "class" / "due date" in whatever JSON we get hold of.
# ---------------------------------------------------------------------------

JSON_TITLE_KEYS = (
    "short_description", "shortDescription", "assignment_title",
    "assignmentShortDescription", "AssignmentShortDescription", "title",
)
JSON_CLASS_KEYS = (
    "groupname", "GroupName", "group_name", "section_title", "sectionTitle",
    "class_name", "className", "course", "SectionTitle",
)
JSON_DUE_KEYS = (
    "date_due", "dateDue", "DateDue", "due_date", "dueDate",
    "AssignmentDueDate", "assignmentDueDate",
)
JSON_STATUS_KEYS = (
    "status", "Status", "assignment_status_text", "statusDescription",
    "AssignmentStatus",
)


def _first_key(record: dict, keys: Iterable[str]) -> Any:
    """Return the first present, non-empty value among `keys`."""
    for key in keys:
        value = record.get(key)
        if value not in (None, "", []):
            return value
    return None


def _find_assignment_records(node: Any, found: list[list[dict]]) -> list[list[dict]]:
    """
    Walk arbitrary JSON and collect every list that looks like assignments.

    "Looks like assignments" means: a list of objects where at least one object
    carries both a title-ish key and a due-date-ish key. Requiring both keeps
    us from mistaking a list of course sections for a list of homework.
    """
    if isinstance(node, list):
        records = [item for item in node if isinstance(item, dict)]
        if records and any(
            _first_key(r, JSON_TITLE_KEYS) and _first_key(r, JSON_DUE_KEYS)
            for r in records
        ):
            found.append(records)
        for item in node:
            _find_assignment_records(item, found)
    elif isinstance(node, dict):
        for value in node.values():
            _find_assignment_records(value, found)
    return found


def assignments_from_json(payload: Any) -> list[Assignment]:
    """Pull assignments out of any Blackbaud JSON response we can recognise."""
    groups = _find_assignment_records(payload, [])
    if not groups:
        return []

    # If several lists matched, trust the biggest one.
    records = max(groups, key=len)

    assignments: list[Assignment] = []
    for record in records:
        title = squash_whitespace(str(_first_key(record, JSON_TITLE_KEYS) or ""))
        if not title:
            continue

        status = squash_whitespace(str(_first_key(record, JSON_STATUS_KEYS) or ""))
        if status and looks_completed(status):
            continue

        class_name = (
            squash_whitespace(str(_first_key(record, JSON_CLASS_KEYS) or ""))
            or "Unknown Class"
        )
        due_raw = _first_key(record, JSON_DUE_KEYS)
        due_date = parse_due_date(str(due_raw) if due_raw is not None else None)

        assignments.append(
            Assignment(title=title, class_name=class_name, due_date=due_date)
        )

    return assignments


def fetch_assignments_from_api(
    context: Any, base_url: str, days_ahead: int
) -> list[Assignment]:
    """
    Last resort: call the legacy DataDirect endpoint directly.

    Only reached when neither the page markup nor the page's own network
    traffic gave us anything. Uses the authenticated browser context, so no
    separate login is needed.
    """
    today = date.today()
    end = today + timedelta(days=days_ahead)
    endpoint = (
        f"{base_url.rstrip('/')}/api/DataDirect/AssignmentCenterAssignments/"
        f"?format=json&filter=1&persona=2&statusList=&sectionList="
        f"&dateStart={today.month}/{today.day}/{today.year}"
        f"&dateEnd={end.month}/{end.day}/{end.year}"
    )

    log("Trying the legacy assignment API directly")
    try:
        response = context.request.get(
            endpoint, headers={"Accept": "application/json"}, timeout=NAVIGATION_TIMEOUT_MS
        )
        if not response.ok:
            warn(f"Assignment API returned HTTP {response.status}")
            return []
        return assignments_from_json(response.json())
    except (PlaywrightError, ValueError) as exc:
        warn(f"Could not read the assignment API: {exc}")
        return []


def _open_assignment_center(page: Page, url: str) -> list[Any]:
    """
    Navigate to the Assignment Center, recording the JSON it loads on the way.

    We don't know which endpoint this school's portal calls -- the old and new
    Assignment Centers differ -- so rather than guessing we listen to whatever
    the page fetches for itself. Returns the captured JSON payloads.
    """
    captured: list[Any] = []

    def on_response(response: Any) -> None:
        if "assignment" not in response.url.lower():
            return
        try:
            content_type = (response.headers or {}).get("content-type", "")
            if "json" in content_type.lower():
                captured.append(response.json())
        except Exception:
            # Bodies aren't always readable (redirects, aborted requests).
            # A miss here just means we fall through to the next strategy.
            pass

    page.on("response", on_response)
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
        try:
            page.wait_for_load_state("networkidle", timeout=NAVIGATION_TIMEOUT_MS)
        except PlaywrightTimeoutError:
            # A chatty single-page app may never go fully idle.
            pass
        # Give late XHRs a moment to land before we stop listening.
        page.wait_for_timeout(2_000)
    finally:
        page.remove_listener("response", on_response)

    return captured


def collect_assignments(
    base_url: str,
    username: str,
    password: str,
    days_ahead: int,
    headless: bool = True,
    assignment_center_url: Optional[str] = None,
) -> list[Assignment]:
    """
    Drive the whole browser session and hand back the assignment list.

    Tries, in order, until something yields assignments:
      1. Scraping the rendered page.
      2. The JSON the page loaded for itself.
      3. The legacy DataDirect endpoint.
    """
    assignments: list[Assignment] = []
    base = base_url.rstrip("/")

    if assignment_center_url:
        candidate_urls = [assignment_center_url]
    else:
        candidate_urls = [f"{base}{path}" for path in ASSIGNMENT_CENTER_PATHS]

    with sync_playwright() as playwright:
        log("Launching headless Chromium" if headless else "Launching Chromium (visible)")
        browser = playwright.chromium.launch(headless=headless)
        context = browser.new_context()
        page = context.new_page()
        page.set_default_timeout(ELEMENT_TIMEOUT_MS)

        try:
            log_into_portal(page, base, username, password)

            for url in candidate_urls:
                log(f"Opening the Assignment Center: {url}")
                captured = _open_assignment_center(page, url)

                assignments = scrape_assignments_from_dom(page)
                if assignments:
                    break

                # The markup didn't match, but the page still had to fetch its
                # data from somewhere -- read that instead.
                for payload in captured:
                    assignments = assignments_from_json(payload)
                    if assignments:
                        ok("Read the assignments from the page's own API call")
                        break
                if assignments:
                    break

                # Save the page so you can see why the selectors missed.
                try:
                    page.screenshot(path=DEBUG_SCREENSHOT_PATH, full_page=True)
                    warn(f"Saved a debug screenshot to {DEBUG_SCREENSHOT_PATH}")
                except PlaywrightError:
                    pass

            if not assignments:
                assignments = fetch_assignments_from_api(context, base, days_ahead)

        finally:
            # Always close the browser, even when something above blew up.
            context.close()
            browser.close()

    return assignments


def deduplicate(assignments: Iterable[Assignment]) -> list[Assignment]:
    """Drop repeats within a single scrape (the same task can span days)."""
    seen: set[tuple[str, str]] = set()
    unique: list[Assignment] = []
    for assignment in assignments:
        if assignment.key() in seen:
            continue
        seen.add(assignment.key())
        unique.append(assignment)
    return unique


# ---------------------------------------------------------------------------
# Step 3: talk to Notion
# ---------------------------------------------------------------------------


class NotionError(RuntimeError):
    """Raised when the Notion API says no."""


class NotionClient:
    """A very small wrapper around the handful of Notion endpoints we need."""

    def __init__(self, token: str, database_id: str) -> None:
        self.database_id = database_id
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Notion-Version": NOTION_API_VERSION,
                "Content-Type": "application/json",
            }
        )
        # Filled in by load_schema(); we read the database's real property
        # names/types instead of assuming them, so a renamed column doesn't
        # blow up with a cryptic "property does not exist" error.
        self.title_property: str = "Name"
        self.class_property: Optional[str] = None
        self.class_type: Optional[str] = None
        self.due_property: Optional[str] = None

    # -- plumbing ----------------------------------------------------------

    def _request(self, method: str, path: str, payload: Optional[dict] = None) -> dict:
        """Send one request, retrying on rate limits and server hiccups."""
        url = f"{NOTION_API_BASE}{path}"
        last_error = "unknown error"

        for attempt in range(4):
            try:
                response = self.session.request(method, url, json=payload, timeout=30)
            except requests.RequestException as exc:
                last_error = f"network error: {exc}"
                time.sleep(2**attempt)
                continue

            if response.status_code == 429:
                # Notion allows roughly 3 requests/second and tells us how long
                # to wait when we go over.
                delay = float(response.headers.get("Retry-After", 2**attempt))
                warn(f"Rate limited by Notion, waiting {delay:.0f}s")
                time.sleep(delay)
                continue

            if response.status_code >= 500:
                last_error = f"HTTP {response.status_code}"
                time.sleep(2**attempt)
                continue

            if not response.ok:
                try:
                    body = response.json()
                    detail = body.get("message", response.text)
                except ValueError:
                    detail = response.text
                raise NotionError(f"HTTP {response.status_code}: {detail}")

            return response.json()

        raise NotionError(f"Gave up after 4 attempts ({last_error})")

    # -- schema ------------------------------------------------------------

    def load_schema(self) -> None:
        """Read the database's columns so we build valid page payloads."""
        database = self._request("GET", f"/databases/{self.database_id}")
        properties: dict[str, dict] = database.get("properties", {})

        for name, spec in properties.items():
            kind = spec.get("type")

            if kind == "title":
                self.title_property = name
            elif kind == "date" and self.due_property is None:
                # Prefer a column that actually mentions "due".
                if "due" in name.lower():
                    self.due_property = name
            elif kind in {"select", "multi_select", "rich_text"} and self.class_property is None:
                if re.search(r"class|subject|course", name, re.IGNORECASE):
                    self.class_property = name
                    self.class_type = kind

        # If nothing matched by name, fall back to the first column of the
        # right type -- better than silently dropping the value.
        if self.due_property is None:
            self.due_property = next(
                (n for n, s in properties.items() if s.get("type") == "date"), None
            )
        if self.class_property is None:
            for name, spec in properties.items():
                if spec.get("type") in {"select", "multi_select", "rich_text"}:
                    self.class_property = name
                    self.class_type = spec.get("type")
                    break

        title = database.get("title") or []
        db_name = squash_whitespace(title[0]["plain_text"]) if title else self.database_id
        ok(f'Connected to Notion database "{db_name}"')
        log(
            f"Using columns -> title: {self.title_property!r}, "
            f"class: {self.class_property!r}, due date: {self.due_property!r}"
        )

        if self.class_property is None:
            warn("No Class/Subject column found -- class names won't be saved.")
        if self.due_property is None:
            warn("No Date column found -- due dates won't be saved.")

    # -- reads and writes --------------------------------------------------

    def assignment_exists(self, assignment: Assignment) -> bool:
        """
        Ask Notion whether this assignment is already in the database.

        We match on the exact title, plus the due date when we have one, so a
        weekly assignment with a repeating name still gets its new entry.
        """
        conditions: list[dict] = [
            {"property": self.title_property, "title": {"equals": assignment.title}}
        ]

        if MATCH_ON_DUE_DATE and assignment.due_date and self.due_property:
            conditions.append(
                {"property": self.due_property, "date": {"equals": assignment.due_date}}
            )

        query = {
            "filter": conditions[0] if len(conditions) == 1 else {"and": conditions},
            "page_size": 1,
        }

        result = self._request("POST", f"/databases/{self.database_id}/query", query)
        return bool(result.get("results"))

    def _class_value(self, class_name: str) -> Optional[dict]:
        """Shape the class name to match whatever column type Notion has."""
        if not self.class_property or not class_name:
            return None
        if self.class_type == "select":
            return {"select": {"name": class_name}}
        if self.class_type == "multi_select":
            return {"multi_select": [{"name": class_name}]}
        return {"rich_text": [{"text": {"content": class_name}}]}

    def create_assignment(self, assignment: Assignment) -> None:
        """Add one assignment to the database as a new page."""
        properties: dict[str, Any] = {
            self.title_property: {
                "title": [{"text": {"content": assignment.title}}]
            }
        }

        class_value = self._class_value(assignment.class_name)
        if class_value and self.class_property:
            properties[self.class_property] = class_value

        if assignment.due_date and self.due_property:
            properties[self.due_property] = {"date": {"start": assignment.due_date}}

        self._request(
            "POST",
            "/pages",
            {"parent": {"database_id": self.database_id}, "properties": properties},
        )


def normalize_database_id(raw: str) -> str:
    """
    Accept a bare ID, a dashed UUID, or a pasted Notion URL.

    Copying the database URL out of the browser is the usual first attempt, so
    we pull the 32-character ID out of it rather than failing on it.
    """
    value = raw.strip()
    match = re.search(r"([0-9a-fA-F]{32})", value.replace("-", ""))
    if match:
        return match.group(1)
    return value


# ---------------------------------------------------------------------------
# Putting it all together
# ---------------------------------------------------------------------------


def read_env(name: str) -> Optional[str]:
    """Read an environment variable, treating blank strings as missing."""
    value = os.getenv(name)
    return value.strip() if value and value.strip() else None


def sync_to_notion(client: NotionClient, assignments: list[Assignment]) -> tuple[int, int, int]:
    """Push new assignments to Notion. Returns (added, skipped, failed)."""
    added = skipped = failed = 0

    for assignment in assignments:
        try:
            if client.assignment_exists(assignment):
                skipped += 1
                print(f"     - Already in Notion: {assignment.title}", flush=True)
                continue

            client.create_assignment(assignment)
            added += 1
            due = assignment.due_date or "no due date"
            ok(f"Added assignment: {assignment.title} ({assignment.class_name}, due {due})")

        except NotionError as exc:
            # One bad assignment shouldn't stop the rest of the sync.
            failed += 1
            fail(f"Could not save {assignment.title!r}: {exc}")

        # Stay comfortably under Notion's ~3 requests/second limit.
        time.sleep(0.4)

    return added, skipped, failed


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape Blackbaud assignments and file them in Notion."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scrape and print the assignments without writing to Notion.",
    )
    parser.add_argument(
        "--show-browser",
        action="store_true",
        help="Run Chromium with a visible window (useful for debugging login).",
    )
    parser.add_argument(
        "--days-ahead",
        type=int,
        default=14,
        help="How far ahead to look for assignments (default: 14).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)

    # --- 1. Load configuration from the environment -----------------------
    username = read_env("SCHOOL_USERNAME")
    password = read_env("SCHOOL_PASSWORD")
    notion_token = read_env("NOTION_TOKEN")
    notion_database_id = read_env("NOTION_DATABASE_ID")
    base_url = read_env("SCHOOL_BASE_URL") or DEFAULT_SCHOOL_BASE_URL
    # Optional: paste your browser's address bar here to skip the guessing.
    assignment_center_url = read_env("ASSIGNMENT_CENTER_URL")

    required = {"SCHOOL_USERNAME": username, "SCHOOL_PASSWORD": password}
    if not args.dry_run:
        required["NOTION_TOKEN"] = notion_token
        required["NOTION_DATABASE_ID"] = notion_database_id

    missing = [name for name, value in required.items() if not value]
    if missing:
        fail(f"Missing environment variable(s): {', '.join(missing)}")
        fail("Set them in your shell or a .env file, then run again.")
        return 2

    # --- 2. Scrape the portal ---------------------------------------------
    try:
        assignments = collect_assignments(
            base_url=base_url,
            username=username,           # type: ignore[arg-type]
            password=password,           # type: ignore[arg-type]
            days_ahead=args.days_ahead,
            headless=not args.show_browser,
            assignment_center_url=assignment_center_url,
        )
    except PlaywrightTimeoutError as exc:
        fail(f"The portal took too long to respond: {exc}")
        return 1
    except (PlaywrightError, RuntimeError) as exc:
        fail(f"Browser automation failed: {exc}")
        return 1

    assignments = deduplicate(assignments)

    if not assignments:
        warn("No active assignments found -- nothing to sync.")
        return 0

    ok(f"Scraped {len(assignments)} assignment(s)")
    for assignment in assignments:
        due = assignment.due_date or "no due date"
        print(f"     - {assignment.title} | {assignment.class_name} | due {due}", flush=True)

    if args.dry_run:
        ok("Dry run complete -- Notion was not modified.")
        return 0

    # --- 3. Sync to Notion -------------------------------------------------
    client = NotionClient(
        token=notion_token,                                    # type: ignore[arg-type]
        database_id=normalize_database_id(notion_database_id), # type: ignore[arg-type]
    )

    try:
        client.load_schema()
    except NotionError as exc:
        fail(f"Could not read the Notion database: {exc}")
        fail("Check NOTION_TOKEN, NOTION_DATABASE_ID, and that the database is")
        fail("shared with your integration (••• > Connections > your integration).")
        return 1

    added, skipped, failed = sync_to_notion(client, assignments)

    print("", flush=True)
    ok(f"Done. Added {added}, skipped {skipped} duplicate(s), {failed} error(s).")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
