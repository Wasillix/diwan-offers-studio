// Offer dates: house-style Arabic/English strings, guesses from a sheet's file name, the coming weekend.

export const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
export const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Two Date objects → { ar: "20 - 23 تشرين الثاني", en: "20 – 23 November 2026" }. */
export function formatDates(d1, d2 = d1) {
  const [m1, m2] = [d1.getMonth(), d2.getMonth()];
  if (+d1 === +d2) return { ar: `${d1.getDate()} ${AR_MONTHS[m1]}`, en: `${d1.getDate()} ${EN_MONTHS[m1]} ${d1.getFullYear()}` };
  if (m1 === m2) return { ar: `${d1.getDate()} - ${d2.getDate()} ${AR_MONTHS[m1]}`, en: `${d1.getDate()} – ${d2.getDate()} ${EN_MONTHS[m1]} ${d2.getFullYear()}` };
  return { ar: `${d1.getDate()} ${AR_MONTHS[m1]} - ${d2.getDate()} ${AR_MONTHS[m2]}`, en: `${d1.getDate()} ${EN_MONTHS[m1]} – ${d2.getDate()} ${EN_MONTHS[m2]} ${d2.getFullYear()}` };
}

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const monthOf = (s) => MON[String(s).toLowerCase().slice(0, 4)] ?? MON[String(s).toLowerCase().slice(0, 3)];

/** Year for a month near `now`: the offer is this month or soon, so a month far in the past means next year. */
function yearFor(month, now) {
  return month < now.getMonth() - 6 ? now.getFullYear() + 1 : now.getFullYear();
}

/**
 * Guess the offer name and dates from a sheet's file name.
 * "Weekend Offers 20-23 Nov.xlsx", "Diwan Weekly Deals 30 Nov - 3 Dec 2026.xlsx", "La Farina 16-19 Nov.xlsx"
 * Returns { offer_name, dates_ar, dates_en, start, end } with nulls for what it couldn't read.
 */
export function guessFromFileName(fileName, now = new Date()) {
  const base = String(fileName).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  let start = null, end = null, at = -1;
  // 30 Nov - 3 Dec [2026]
  let m = base.match(/(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*(?:[-–to]+)\s*(\d{1,2})\s*([A-Za-z]{3,9})\.?(?:\s*(20\d\d))?/i);
  if (m && monthOf(m[2]) != null && monthOf(m[4]) != null) {
    const y = m[5] ? +m[5] : yearFor(monthOf(m[4]), now);
    start = new Date(monthOf(m[2]) > monthOf(m[4]) ? y - 1 : y, monthOf(m[2]), +m[1]);
    end = new Date(y, monthOf(m[4]), +m[3]); at = m.index;
  } else if ((m = base.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*([A-Za-z]{3,9})\.?(?:\s*(20\d\d))?/i)) && monthOf(m[3]) != null) {
    const y = m[4] ? +m[4] : yearFor(monthOf(m[3]), now);
    start = new Date(y, monthOf(m[3]), +m[1]); end = new Date(y, monthOf(m[3]), +m[2]); at = m.index;
  } else if ((m = base.match(/(\d{1,2})\s*([A-Za-z]{3,9})\.?(?:\s*(20\d\d))?/)) && monthOf(m[2]) != null) {
    const y = m[3] ? +m[3] : yearFor(monthOf(m[2]), now);
    start = end = new Date(y, monthOf(m[2]), +m[1]); at = m.index;
  }
  let name = (at >= 0 ? base.slice(0, at) : base).replace(/\b(diwan|offer sheet|sheet)\b/gi, '').replace(/[-–·,]+\s*$/, '').replace(/\s+/g, ' ').trim();
  if (!name || /^\d+$/.test(name)) name = null;
  const d = start ? formatDates(start, end) : null;
  return { offer_name: name, dates_ar: d?.ar || null, dates_en: d?.en || null, start, end };
}

/** The next Friday–Monday weekend after `now` (Diwan's usual weekend offer window). */
export function upcomingWeekend(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const add = ((5 - d.getDay()) + 7) % 7 || 7; // next Friday, never today
  const fri = new Date(d); fri.setDate(d.getDate() + add);
  const mon = new Date(fri); mon.setDate(fri.getDate() + 3);
  return { start: fri, end: mon, ...formatDates(fri, mon) };
}

/** Wall-clock parts of `date` in an IANA time zone (e.g. Asia/Beirut). */
export function zonedParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, weekday: wd, ymd: `${p.year}-${p.month}-${p.day}` };
}
