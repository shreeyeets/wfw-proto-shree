export const TEAM_DATA = {
  manager: "Subhash",
  week: "Mar 24–28",
  members: [
    { name: "Shreejeet", status: "fragmented" },
    { name: "Soha",      status: "balanced" },
    { name: "Pratik",    status: "overloaded" },
    { name: "Ayush",     status: "stretched" },
    { name: "Riya",      status: "balanced" },
    { name: "Kabir",     status: "fragmented" },
  ],
  patterns: [
    "Tuesday all-hands at 10:00am removes the only clean morning block four reportees have — every week.",
    "Pratik had 9 context switches on Wednesday. Six meetings, gaps under 15 min. Nothing was completable.",
  ],
  anonymousSignals: [
    "Two reportees flagged feeling stuck mid-week — not workload, fragmentation.",
  ],
  suggestedFix: {
    title: "Try moving Tuesday all-hands to 11:30am",
    detail: "Just for one week. Four reportees get a clean 90-min morning block — roughly 6 hours of recovered focus time across the team. If it doesn't land, move it back.",
    calendarEvent: {
      title: "Team All-Hands (trial 11:30)",
      startHour: 11,
      startMin: 30,
      durationMins: 60,
      note: "Moving from 10am for one week to give the team a clean morning block. Review after trial."
    }
  }
};

export function googleCalendarLink(event: typeof TEAM_DATA.suggestedFix.calendarEvent): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day <= 2 ? 2 - day : 9 - day;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = next.toISOString().slice(0, 10).replace(/-/g, '');
  const end = new Date(next);
  end.setHours(event.startHour, event.startMin + event.durationMins);
  const endStr = `${d}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  const startStr = `${d}T${pad(event.startHour)}${pad(event.startMin)}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(event.note)}`;
}
