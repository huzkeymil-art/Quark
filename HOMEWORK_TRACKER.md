# Homework Tracker

`homework_tracker.py` logs into a Blackbaud (myschoolapp) portal, reads the
Assignment Center, and adds any assignment that isn't already there to a Notion
database.

---

## 1. Install

```bash
pip install -r requirements.txt
playwright install chromium
```

The second command downloads the browser Playwright drives. It only needs to be
run once.

## 2. Set up the Notion side

1. Go to <https://www.notion.so/my-integrations> and click **New integration**.
   Give it a name (e.g. "Homework Tracker") and copy the **Internal Integration
   Secret** — that's your `NOTION_TOKEN`.
2. Create a database in Notion with these columns:

   | Column     | Type                       |
   | ---------- | -------------------------- |
   | `Name`     | Title                      |
   | `Class`    | Select (or Text)           |
   | `Due Date` | Date                       |

   The script reads the database's real schema at startup, so the names don't
   have to match exactly. It looks for the Title column (whatever it's called),
   a Select/Multi-select/Text column whose name mentions *class*, *subject*, or
   *course*, and a Date column whose name mentions *due*. If it can't find a
   match by name it falls back to the first column of the right type and prints
   which columns it chose.
3. **Share the database with the integration.** This is the step everyone
   misses: open the database, click the `•••` menu → **Connections** → pick
   your integration. Without it the API returns 404.
4. Copy the database ID from the URL. You can paste the whole URL into
   `NOTION_DATABASE_ID` — the script pulls the ID out of it.

## 3. Set the environment variables

Never put these in the source file. Either export them in your shell:

```bash
export SCHOOL_USERNAME="you@example.com"
export SCHOOL_PASSWORD="..."
export NOTION_TOKEN="ntn_..."
export NOTION_DATABASE_ID="..."
```

…or copy `.env.example` to `.env` and fill it in (that needs `python-dotenv`,
which is in `requirements.txt`). `.env` is git-ignored.

| Variable             | Required | Purpose                                              |
| -------------------- | -------- | ---------------------------------------------------- |
| `SCHOOL_USERNAME`    | yes      | Portal login                                          |
| `SCHOOL_PASSWORD`    | yes      | Portal password                                       |
| `NOTION_TOKEN`       | yes¹     | Notion integration secret                             |
| `NOTION_DATABASE_ID` | yes¹     | Target database                                       |
| `SCHOOL_BASE_URL`    | no       | Defaults to `https://mybga.myschoolapp.com`           |

¹ Not needed with `--dry-run`, which never touches Notion.

## 4. Run it

```bash
python homework_tracker.py --dry-run    # scrape and print, change nothing
python homework_tracker.py              # scrape and sync to Notion
```

Options:

| Flag             | What it does                                                |
| ---------------- | ----------------------------------------------------------- |
| `--dry-run`      | Print what was scraped without writing to Notion             |
| `--show-browser` | Run Chromium with a visible window, so you can watch it      |
| `--days-ahead N` | How far ahead to look (default 14; used by the API fallback) |

Exit codes: `0` success, `1` something failed, `2` configuration missing.

Typical output:

```
[..] Launching headless Chromium
[..] Opening login page: https://mybga.myschoolapp.com/app#login
[ok] Logged in successfully
[..] Opening the Assignment Center
[..] Found 4 candidate row(s) in the Assignment Center
[ok] Scraped 3 assignment(s)
     - Read Chapter 5 | Math 101 - 1(A) | due 2026-09-15
[ok] Connected to Notion database "Homework"
[ok] Added assignment: Read Chapter 5 (Math 101 - 1(A), due 2026-09-15)
     - Already in Notion: Lab Report: Photosynthesis
[ok] Done. Added 1, skipped 1 duplicate(s), 0 error(s).
```

---

## How it works

1. **Login** — opens `<base>/app#login`, fills the username, clicks *Next* if
   the portal uses the two-step form, fills the password, and submits. Success
   is confirmed by the login form disappearing.
2. **Scrape** — opens the Assignment Center and reads each assignment row for a
   title, class name, and due date. Anything marked *Completed* / *Turned In* /
   *Graded* is skipped.
3. **Sync** — for each assignment it queries the Notion database first and only
   creates a page when there's no match.

### A note on duplicate detection

The requirement was to match on the assignment title. The script matches on
**title + due date** by default, because recurring titles ("Reading Log",
"Weekly Problem Set") would otherwise only ever be added once and every later
week would be silently swallowed. To go back to title-only matching, set
`MATCH_ON_DUE_DATE = False` near the top of the script.

### A note on the JSON API fallback

Blackbaud's markup differs between schools and portal versions, so a purely
DOM-based scrape is fragile. If no assignment rows match the known layouts, the
script falls back to the same JSON endpoint the page itself calls
(`/api/DataDirect/AssignmentCenterAssignments/`), reusing the already-logged-in
browser session. This is usually the path that just works.

---

## Troubleshooting

**"Could not find the username field on the login page"**
Your school probably uses single sign-on (Microsoft, Google, Okta). This script
only handles Blackbaud's own username/password form. The script detects the
redirect and says so explicitly.

**"No assignment rows matched the known page layouts"**
The script saves `assignment_center_debug.png` — open it to see what the page
actually looked like. Then either add your portal's selector to
`ASSIGNMENT_ITEM_SELECTORS` / `TITLE_SELECTORS` near the top of the script, or
rely on the API fallback. Running with `--show-browser` also helps.

**"Could not read the Notion database: HTTP 404"**
The database isn't shared with your integration. See step 2.4 above.

**Class names come out as "Unknown Class"**
Your portal doesn't use a recognisable class element. Add its selector to
`CLASS_NAME_SELECTORS`.

**Due dates are missing**
Add the portal's due-date selector to `DUE_DATE_SELECTORS`. The parser handles
`9/15/2026`, `09/15/26`, `Sep 15`, `September 15, 2026`, and ISO timestamps; a
date with no year is resolved to the nearest sensible school-year date.

---

## Running it on a schedule

Once a day is plenty. On macOS/Linux, `crontab -e`:

```cron
0 17 * * 1-5 cd /path/to/repo && /usr/bin/python3 homework_tracker.py >> tracker.log 2>&1
```

Cron doesn't load your shell profile, so put the credentials in a `.env` file
next to the script rather than relying on `export`.
