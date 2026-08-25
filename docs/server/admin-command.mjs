// MAYA Admin command layer. Pure DTO shaping and exact lead identity rules.
// No network, credentials or storage live here, so the safety contract can be
// exercised without starting the server.

const text = (value, max = 240) => String(value == null ? '' : value)
  .replace(/\s+/g, ' ').trim().slice(0, max);
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = value => '$' + number(value).toFixed(2);
const normalize = value => text(value, 200).toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9@._+ -]/g, '').replace(/\s+/g, ' ').trim();

export const ADMIN_PANEL_KEYS = Object.freeze([
  'today', 'submissions', 'traffic', 'ads', 'leads', 'sources', 'bottom', 'changes',
]);

export function leadPublicDto(lead) {
  return {
    id: text(lead && lead.id, 120),
    name: text(lead && lead.name, 120),
    email: text(lead && lead.email, 180).toLowerCase(),
    phone: text(lead && lead.phone, 60),
    when: text(lead && (lead.ts || lead.when), 50),
    summary: text(lead && (lead.note || lead.wrote || lead.summary), 400),
    tier: text(lead && lead.tier, 80),
  };
}

// The visible Admin DTO may include contact details because it is admin-only,
// but the Realtime model does not need them. Exact identity is resolved later
// by the server-side find_lead tool, so keep unnecessary PII out of the
// session instructions.
export function buildRealtimeCommandContext(snapshot) {
  return JSON.parse(JSON.stringify(snapshot || {}, (key, value) =>
    key === 'email' || key === 'phone' ? undefined : value));
}

// Exact means exact. A unique full name, unique email or unique first name is
// accepted. Substrings and fuzzy matches never silently choose a person.
export function resolveLeadExact(leads, query) {
  const list = (Array.isArray(leads) ? leads : []).map(leadPublicDto)
    .filter(lead => lead.email || lead.name);
  const q = normalize(query);
  if (!q) return { status: 'query_required', matches: [] };

  const emailMatches = list.filter(lead => normalize(lead.email) === q);
  if (emailMatches.length === 1) return { status: 'exact', lead: emailMatches[0] };
  if (emailMatches.length > 1) return { status: 'ambiguous', matches: emailMatches };

  const nameMatches = list.filter(lead => normalize(lead.name) === q);
  if (nameMatches.length === 1) return { status: 'exact', lead: nameMatches[0] };
  if (nameMatches.length > 1) return { status: 'ambiguous', matches: nameMatches };

  if (!q.includes(' ')) {
    const firstMatches = list.filter(lead => normalize(lead.name).split(' ')[0] === q);
    if (firstMatches.length === 1) return { status: 'exact', lead: firstMatches[0] };
    if (firstMatches.length > 1) return { status: 'ambiguous', matches: firstMatches };
  }
  return { status: 'not_found', matches: [] };
}

// v13.82: merge every source's per-day map into one calendar, so today and
// yesterday's ad clicks are answerable the same way the dashboard's daily
// chart shows them. Windsor ships a { 'YYYY-MM-DD': {clicks,linkClicks,...} }
// map per source; the direct-provider fallback has no daily and yields zeros,
// which is honest rather than invented.
function mergeAdDaily(sources) {
  const merged = {};
  for (const key of Object.keys(sources || {})) {
    const daily = (sources[key] && sources[key].daily) || {};
    for (const d of Object.keys(daily)) {
      const v = daily[d] || {};
      const m = merged[d] || (merged[d] = { impressions: 0, clicks: 0, linkClicks: 0, spend: 0 });
      m.impressions += number(v.impressions); m.clicks += number(v.clicks);
      m.linkClicks += number(v.linkClicks); m.spend += number(v.spend);
    }
  }
  return merged;
}
const isoDay = (date, tz) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch { return new Date(date).toISOString().slice(0, 10); }
};

export function buildAdminCommandSnapshot(raw = {}, now = new Date()) {
  const wix = raw.wix && raw.wix.connected ? raw.wix : null;
  const ads = raw.ads && raw.ads.connected ? raw.ads : null;
  const tz = raw.tz || 'America/Los_Angeles';
  const leadData = raw.leads && raw.leads.connected ? raw.leads : null;
  const accounts = raw.accounts && typeof raw.accounts === 'object' ? raw.accounts : null;
  const leads = (leadData && Array.isArray(leadData.list) ? leadData.list : [])
    .slice(0, 12).map(leadPublicDto);
  const submissionsAvailable = Array.isArray(raw.submissions);
  const objects = submissionsAvailable ? raw.submissions : [];
  const folders = new Set(objects.map(item => text(item && item.name, 300).split('/')[1]).filter(Boolean));
  const newestSubmission = objects.map(item => text(item && item.timeCreated, 60)).filter(Boolean).sort().slice(-1)[0] || null;
  const sources = ads ? (ads.sources || {}) : {};
  const google = sources.google_ads || sources.googleads || sources.google || {};
  const meta = sources.facebook || sources.meta || sources.facebook_ads || {};
  const spend7 = number(google.spend) + number(meta.spend);
  const clicks7 = number(google.linkClicks != null ? google.linkClicks : google.clicks) +
    number(meta.linkClicks != null ? meta.linkClicks : meta.clicks);
  const leads7 = leadData ? number(leadData.d7) : null;
  const cpl = leads7 > 0 ? spend7 / leads7 : null;

  // v13.82: today and yesterday, broken out from the daily calendar so Maya can
  // answer "how many clicks today vs yesterday" without guessing.
  const adDaily = ads ? mergeAdDaily(ads.sources || {}) : {};
  const todayStr = isoDay(new Date(now), tz);
  const yesterdayStr = isoDay(new Date(new Date(now).getTime() - 86400000), tz);
  const dayRow = key => {
    const v = adDaily[key] || {};
    return { date: key, linkClicks: Math.round(number(v.linkClicks)), clicks: Math.round(number(v.clicks)),
      spend: Number(number(v.spend).toFixed(2)), impressions: Math.round(number(v.impressions)) };
  };
  const adToday = dayRow(todayStr);
  const adYesterday = dayRow(yesterdayStr);
  const adDailyTail = Object.keys(adDaily).sort().slice(-7).map(dayRow);

  const briefing = [];
  if (wix) {
    const today = wix.today && wix.today.visitors;
    briefing.push(today == null
      ? 'Mana Siyo traffic for today has not landed from Wix yet.'
      : number(today) + ' people visited Mana Siyo today.');
  }
  if (ads) {
    briefing.push(money(spend7) + ' spent across ' + Math.round(clicks7) + ' ad link clicks in the last 7 days.');
    briefing.push(adToday.linkClicks + ' ad link clicks today and ' + adYesterday.linkClicks + ' yesterday.');
  }
  if (leadData) briefing.push(number(leadData.d7) + ' leads arrived in the last 7 days' +
    (leads[0] ? '; newest is ' + leads[0].name + '.' : '.'));
  briefing.push(submissionsAvailable
    ? folders.size + ' atelier submissions are on file' +
      (newestSubmission ? '; the newest arrived ' + newestSubmission.slice(0, 10) + '.' : '.')
    : 'Atelier submission data is temporarily unavailable.');

  const attention = [];
  if (!wix) attention.push({ severity: 'amber', panel: 'traffic', text: 'Mana Siyo traffic is unavailable.' });
  if (!ads) attention.push({ severity: 'amber', panel: 'ads', text: 'Ad delivery data is unavailable.' });
  if (!leadData) attention.push({ severity: 'amber', panel: 'leads', text: 'The Wix lead feed is unavailable.' });
  else if (number(leadData.d7) === 0) attention.push({ severity: 'amber', panel: 'leads', text: 'No leads arrived in the last 7 days.' });
  if (!submissionsAvailable) attention.push({ severity: 'amber', panel: 'submissions', text: 'Atelier submission data is unavailable.' });
  for (const group of (ads && Array.isArray(ads.adGroups) ? ads.adGroups : [])) {
    if (String(group.status || '').toUpperCase() === 'ENABLED' && number(group.impressions7) === 0) {
      attention.push({ severity: 'red', panel: 'ads', text: 'Enabled ad group ' + text(group.name, 100) + ' has no delivery in the last 7 days.' });
    }
  }

  return {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    briefing,
    attention: attention.slice(0, 8),
    panels: {
      traffic: {
        accounts: accounts ? { total: number(accounts.total), new7: number(accounts.d7), new28: number(accounts.d28) } : null,
        manasiyo: wix ? { today: wix.today || null, d7: wix.d7 || null, d28: wix.d28 || null } : null,
      },
      ads: ads ? { spend7, linkClicks7: clicks7,
        today: adToday, yesterday: adYesterday, daily: adDailyTail,
        campaigns: (ads.campaigns || []).slice(0, 8) } : null,
      leads: leadData ? { today: number(leadData.today), d7: number(leadData.d7), d28: number(leadData.d28), list: leads } : null,
      submissions: submissionsAvailable
        ? { total: folders.size, mostRecent: newestSubmission }
        : null,
      bottom: { spend7, leads7, costPerLead: cpl },
      changes: { items: (Array.isArray(raw.ships) ? raw.ships : []).slice(0, 3).map(item => text(item, 500)) },
    },
    leads,
  };
}
