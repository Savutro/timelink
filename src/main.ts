import "./styles.css";

type TimezoneEntry = {
  label: string;
  search: string;
  timeZone: string;
  alias: string;
};

type Participant = {
  id: string;
  name: string;
  timeZone: string;
  label: string;
  start: number;
  end: number;
};

type TimeSegment = {
  start: number;
  end: number;
};

const DEFAULT_TIMEZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Zurich",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

const ALIAS_TIMEZONES = [
  { alias: "UTC", label: "UTC", timeZone: "UTC" },
  { alias: "GMT", label: "GMT", timeZone: "UTC" },
  { alias: "CET", label: "CET UTC+1", timeZone: "Europe/Zurich" },
  { alias: "CEST", label: "CEST UTC+2", timeZone: "Europe/Zurich" },
  { alias: "CEST+1", label: "CEST+1", timeZone: "Europe/Zurich" },
  { alias: "BST", label: "BST UTC+1", timeZone: "Europe/London" },
  { alias: "EET", label: "EET UTC+2", timeZone: "Europe/Helsinki" },
  { alias: "EEST", label: "EEST UTC+3", timeZone: "Europe/Helsinki" },
  { alias: "EST", label: "EST UTC-5", timeZone: "America/New_York" },
  { alias: "EDT", label: "EDT UTC-4", timeZone: "America/New_York" },
  { alias: "CST", label: "CST UTC-6", timeZone: "America/Chicago" },
  { alias: "CDT", label: "CDT UTC-5", timeZone: "America/Chicago" },
  { alias: "MST", label: "MST UTC-7", timeZone: "America/Denver" },
  { alias: "MDT", label: "MDT UTC-6", timeZone: "America/Denver" },
  { alias: "PST", label: "PST UTC-8", timeZone: "America/Los_Angeles" },
  { alias: "PDT", label: "PDT UTC-7", timeZone: "America/Los_Angeles" },
  { alias: "IST", label: "IST UTC+5:30", timeZone: "Asia/Kolkata" },
  { alias: "JST", label: "JST UTC+9", timeZone: "Asia/Tokyo" },
  { alias: "AEST", label: "AEST UTC+10", timeZone: "Australia/Sydney" },
  { alias: "AEDT", label: "AEDT UTC+11", timeZone: "Australia/Sydney" },
] as const;

const state = {
  date: new Date().toISOString().slice(0, 10),
  participants: [] as Participant[],
  timezoneEntries: [] as TimezoneEntry[],
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

app.innerHTML = `
  <main class="app-shell">
    <section class="workspace" aria-labelledby="app-title">
      <header class="topbar">
        <div class="brand-block">
          <p class="eyebrow">TimeLink</p>
          <h1 id="app-title">Shared hours.</h1>
        </div>
        <button class="theme-toggle" id="theme-toggle" type="button" aria-pressed="false">
          <span aria-hidden="true">◐</span>
          <span>Dark</span>
        </button>
      </header>

      <section class="controls-panel" aria-label="Meeting controls">
        <form class="add-row" id="add-timezone-form">
          <label>
            Name
            <input id="person-name" type="text" maxlength="18" placeholder="Team">
          </label>
          <div class="timezone-field">
            <label for="timezone-search">Timezone</label>
            <input
              id="timezone-search"
              type="search"
              list="timezone-options"
              autocomplete="off"
              placeholder="CEST, UTC-5, Zurich..."
            >
            <datalist id="timezone-options"></datalist>
          </div>
          <button class="primary-action" type="submit">Add</button>
        </form>
        <div class="summary" id="overlap-summary" aria-live="polite"></div>
        <details class="advanced-controls">
          <summary>Advanced</summary>
          <div class="date-control">
            <label for="meeting-date">Meeting date</label>
            <input id="meeting-date" type="date">
          </div>
        </details>
      </section>

      <section class="timeline-card" aria-label="Timezone comparison">
        <div class="timeline-head">
          <div class="row-label">Local day</div>
          <div class="hour-scale" id="hour-scale" aria-hidden="true"></div>
        </div>
        <div class="rows" id="timezone-rows"></div>
      </section>
    </section>
  </main>
`;

const rowsEl = getElement<HTMLDivElement>("timezone-rows");
const hourScaleEl = getElement<HTMLDivElement>("hour-scale");
const dateInput = getElement<HTMLInputElement>("meeting-date");
const summaryEl = getElement<HTMLDivElement>("overlap-summary");
const form = getElement<HTMLFormElement>("add-timezone-form");
const nameInput = getElement<HTMLInputElement>("person-name");
const timezoneSearch = getElement<HTMLInputElement>("timezone-search");
const timezoneOptions = getElement<HTMLDataListElement>("timezone-options");
const themeToggle = getElement<HTMLButtonElement>("theme-toggle");

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element as T;
}

function getTimezones(): string[] {
  if ("supportedValuesOf" in Intl) {
    return Intl.supportedValuesOf("timeZone");
  }
  return [...DEFAULT_TIMEZONES];
}

function minutesFromTime(value: string): number {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(totalMinutes: number): string {
  const minutes = ((Math.round(totalMinutes / 30) * 30) % 1440 + 1440) % 1440;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const timeZoneName =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value || "GMT";

  const match = timeZoneName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    return 0;
  }
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
}

function formatOffset(minutes: number): string {
  if (minutes === 0) {
    return "UTC";
  }
  const sign = minutes > 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  return `UTC${sign}${hours}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
}

function getTimezoneAbbreviation(date: Date, timeZone: string): string {
  const abbreviation =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
      hour: "2-digit",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value || "";

  return abbreviation.startsWith("GMT") ? "" : abbreviation;
}

function fixedOffsetZone(offsetMinutes: number): string | null {
  if (offsetMinutes === 0) {
    return "UTC";
  }
  const sign = offsetMinutes > 0 ? "-" : "+";
  const absoluteHours = Math.abs(offsetMinutes) / 60;
  if (!Number.isInteger(absoluteHours) || absoluteHours > 14) {
    return null;
  }
  return `Etc/GMT${sign}${absoluteHours}`;
}

function parseOffsetSearch(value: string): TimezoneEntry | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === "+" ? 1 : -1;
  const minutes = sign * (Number(match[2]) * 60 + Number(match[3] || 0));
  const timeZone = fixedOffsetZone(minutes);
  const label = formatOffset(minutes);

  if (timeZone) {
    return { label, search: label.toLowerCase(), timeZone, alias: label };
  }

  const date = new Date(`${state.date}T12:00:00Z`);
  const matchingEntry = state.timezoneEntries.find(
    (entry) => getTimezoneOffsetMinutes(date, entry.timeZone) === minutes,
  );
  if (!matchingEntry) {
    return null;
  }
  return { ...matchingEntry, alias: label, label: `${label} · ${matchingEntry.label}` };
}

function utcDateForLocalMidnight(date: string, timeZone: string): Date {
  const guess = new Date(`${date}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(guess)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}

function localWindowToUtcMinutes(participant: Participant): TimeSegment {
  const localMidnight = utcDateForLocalMidnight(state.date, participant.timeZone);
  const start = localMidnight.getTime() + participant.start * 60000;
  const end = localMidnight.getTime() + participant.end * 60000;
  const utcDayStart = new Date(`${state.date}T00:00:00Z`).getTime();
  return {
    start: (start - utcDayStart) / 60000,
    end: (end - utcDayStart) / 60000,
  };
}

function clampSegment(segment: TimeSegment): TimeSegment {
  return {
    start: Math.max(0, segment.start),
    end: Math.min(1440, segment.end),
  };
}

function segmentStyle(segment: TimeSegment): string {
  const start = (segment.start / 1440) * 100;
  const width = ((segment.end - segment.start) / 1440) * 100;
  return `left: ${start}%; width: ${Math.max(width, 0)}%;`;
}

function localTimeForUtcMinute(minute: number, timeZone: string): string {
  const utcDayStart = new Date(`${state.date}T00:00:00Z`).getTime();
  const date = new Date(utcDayStart + minute * 60000);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function describeTimezone(timeZone: string): string {
  return timeZone.replaceAll("_", " ");
}

function describeParticipantTimezone(participant: Participant): string {
  const date = new Date(`${state.date}T12:00:00Z`);
  const offset = formatOffset(getTimezoneOffsetMinutes(date, participant.timeZone));
  const abbreviation = getTimezoneAbbreviation(date, participant.timeZone);
  return [participant.label || describeTimezone(participant.timeZone), abbreviation, offset]
    .filter(Boolean)
    .join(" · ");
}

function renderHourScale(): void {
  hourScaleEl.innerHTML = "";
  for (let hour = 0; hour < 24; hour += 2) {
    const span = document.createElement("span");
    span.style.gridColumn = `${hour + 1} / span 2`;
    span.textContent = `${String(hour).padStart(2, "0")}:00`;
    hourScaleEl.append(span);
  }
}

function renderGrid(gridEl: HTMLDivElement): void {
  gridEl.innerHTML = "";
  for (let hour = 0; hour < 24; hour += 1) {
    gridEl.append(document.createElement("span"));
  }
}

function getOverlap(): TimeSegment | null {
  if (state.participants.length < 2) {
    return null;
  }

  const windows = state.participants.map(localWindowToUtcMinutes);
  const start = Math.max(...windows.map((window) => window.start));
  const end = Math.min(...windows.map((window) => window.end));
  if (end <= start) {
    return null;
  }
  return { start, end };
}

function renderSummary(overlap: TimeSegment | null): void {
  if (state.participants.length < 2) {
    summaryEl.textContent = "Add at least two timezones to compare availability.";
    return;
  }

  if (!overlap) {
    summaryEl.textContent = "No shared window on this date with the selected local hours.";
    return;
  }

  const duration = Math.round(((overlap.end - overlap.start) / 60) * 10) / 10;
  const startUtc = timeFromMinutes(overlap.start);
  const endUtc = timeFromMinutes(overlap.end);
  summaryEl.innerHTML = `<strong>${startUtc}-${endUtc} UTC</strong> works for everyone, about ${duration} hours.`;
}

function renderRows(): void {
  rowsEl.innerHTML = "";
  const overlap = getOverlap();
  renderSummary(overlap);

  state.participants.forEach((participant) => {
    const row = document.createElement("article");
    row.className = "timezone-row";
    row.innerHTML = `
      <div class="person-card">
        <div>
          <h2></h2>
          <p></p>
        </div>
        <button class="icon-button remove-row" type="button" aria-label="Remove timezone">x</button>
      </div>
      <div class="timeline-wrap">
        <div class="timeline-grid"></div>
        <div class="day-markers"></div>
        <div class="availability-bar"></div>
        <div class="overlap-bar"></div>
        <div class="time-labels"></div>
      </div>
      <div class="availability-controls">
        <label>
          From
          <input class="start-input" type="time" step="1800">
        </label>
        <label>
          To
          <input class="end-input" type="time" step="1800">
        </label>
      </div>
    `;

    row.querySelector("h2")!.textContent = participant.name;
    row.querySelector("p")!.textContent = describeParticipantTimezone(participant);

    const grid = row.querySelector<HTMLDivElement>(".timeline-grid")!;
    renderGrid(grid);

    const dayMarkers = row.querySelector<HTMLDivElement>(".day-markers")!;
    [0, 720, 1440].forEach((minute) => {
      const marker = document.createElement("span");
      marker.style.left = `${(minute / 1440) * 100}%`;
      dayMarkers.append(marker);
    });

    const window = clampSegment(localWindowToUtcMinutes(participant));
    const availability = document.createElement("span");
    availability.style.cssText = segmentStyle(window);
    row.querySelector(".availability-bar")!.append(availability);

    if (overlap) {
      const overlapBar = document.createElement("span");
      overlapBar.style.cssText = segmentStyle(clampSegment(overlap));
      row.querySelector(".overlap-bar")!.append(overlapBar);
    }

    const labels = row.querySelector<HTMLDivElement>(".time-labels")!;
    [0, 360, 720, 1080, 1440].forEach((minute) => {
      const label = document.createElement("span");
      label.style.left = `${(minute / 1440) * 100}%`;
      label.textContent = localTimeForUtcMinute(minute, participant.timeZone);
      labels.append(label);
    });

    const startInput = row.querySelector<HTMLInputElement>(".start-input")!;
    const endInput = row.querySelector<HTMLInputElement>(".end-input")!;
    startInput.value = timeFromMinutes(participant.start);
    endInput.value = timeFromMinutes(participant.end);

    startInput.addEventListener("change", () => {
      participant.start = minutesFromTime(startInput.value);
      if (participant.start >= participant.end) {
        participant.end = Math.min(participant.start + 60, 1439);
      }
      renderRows();
    });

    endInput.addEventListener("change", () => {
      participant.end = minutesFromTime(endInput.value);
      if (participant.end <= participant.start) {
        participant.start = Math.max(participant.end - 60, 0);
      }
      renderRows();
    });

    row.querySelector(".remove-row")!.addEventListener("click", () => {
      state.participants = state.participants.filter((candidate) => candidate.id !== participant.id);
      renderRows();
    });

    rowsEl.append(row);
  });
}

function addParticipant(name: string, timeZone: string, label = "", start = 540, end = 1020): void {
  const randomId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : String(Date.now() + Math.random());

  state.participants.push({
    id: randomId,
    name,
    timeZone,
    label,
    start,
    end,
  });
}

function createTimezoneEntries(): TimezoneEntry[] {
  const date = new Date(`${state.date}T12:00:00Z`);
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZones = Array.from(new Set([userTimezone, ...DEFAULT_TIMEZONES, ...getTimezones()]))
    .filter(Boolean)
    .sort();

  const entries = timeZones.map((timeZone) => {
    const city = describeTimezone(timeZone);
    const abbreviation = getTimezoneAbbreviation(date, timeZone);
    const offset = formatOffset(getTimezoneOffsetMinutes(date, timeZone));
    const label = [city, abbreviation || null, offset].filter(Boolean).join(" · ");
    return {
      label,
      search: [city, abbreviation, offset, timeZone].filter(Boolean).join(" ").toLowerCase(),
      timeZone,
      alias: city,
    };
  });

  ALIAS_TIMEZONES.forEach((entry) => {
    entries.unshift({
      label: `${entry.label} · ${describeTimezone(entry.timeZone)}`,
      search: `${entry.alias} ${entry.label} ${entry.timeZone}`.toLowerCase(),
      timeZone: entry.timeZone,
      alias: entry.alias,
    });
  });

  return entries;
}

function setupTimezoneSearch(): void {
  state.timezoneEntries = createTimezoneEntries();
  timezoneOptions.innerHTML = "";
  state.timezoneEntries.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.label;
    timezoneOptions.append(option);
  });

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Zurich";
  const selectedTimezone =
    state.timezoneEntries.find((entry) => entry.timeZone === userTimezone) ||
    state.timezoneEntries.find((entry) => entry.timeZone === "Europe/Zurich");
  timezoneSearch.value = selectedTimezone?.label || "Europe/Zurich";
}

function resolveTimezoneEntry(value: string): TimezoneEntry | null {
  const offsetEntry = parseOffsetSearch(value);
  if (offsetEntry) {
    return offsetEntry;
  }

  const normalized = value.trim().toLowerCase();
  return (
    state.timezoneEntries.find((entry) => entry.label.toLowerCase() === normalized) ||
    state.timezoneEntries.find((entry) => entry.alias.toLowerCase() === normalized) ||
    state.timezoneEntries.find((entry) => entry.search.includes(normalized)) ||
    null
  );
}

function setupTheme(): void {
  const storedTheme = localStorage.getItem("timelink-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = storedTheme || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

function applyTheme(theme: string): void {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.querySelector("span:last-child")!.textContent = isDark ? "Light" : "Dark";
}

function setupDefaults(): void {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  addParticipant("You", userTimezone || "Europe/Zurich");
  addParticipant("Partner", "America/New_York");
  dateInput.value = state.date;
}

dateInput.addEventListener("change", () => {
  state.date = dateInput.value;
  setupTimezoneSearch();
  renderRows();
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("timelink-theme", nextTheme);
  applyTheme(nextTheme);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const entry = resolveTimezoneEntry(timezoneSearch.value);
  if (!entry) {
    timezoneSearch.focus();
    timezoneSearch.select();
    return;
  }

  const name = nameInput.value.trim() || entry.alias.split("/").at(-1)?.replaceAll("_", " ") || "Team";
  addParticipant(name, entry.timeZone, entry.alias);
  nameInput.value = "";
  timezoneSearch.value = entry.label;
  renderRows();
});

renderHourScale();
setupTheme();
setupTimezoneSearch();
setupDefaults();
renderRows();
