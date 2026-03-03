/**
 * Single-page PDF template for analytics report.
 */

export interface AnalyticsReportTemplateData {
    missionLabel: string;
    periodLabel: string;
    kpis: {
        totalCalls: number;
        meetings: number;
        conversionRate: number;
        totalTalkTime: number;
        noResponse: number;
        callbacks: number;
    };
    sdrPerformance: Array<{ sdrName: string; calls: number; meetings: number; callbacks: number }>;
    aiSummary: string;
}

function esc(s: string): string {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function getAnalyticsReportHtml(data: AnalyticsReportTemplateData): string {
    const d = data;
    const k = d.kpis;
    const talkMin = Math.round(k.totalTalkTime / 60);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rapport Analytics — ${esc(d.missionLabel)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', system-ui, sans-serif; }
  </style>
</head>
<body class="bg-white text-slate-900 antialiased">
  <div class="max-w-3xl mx-auto px-8 pt-10 pb-10" style="font-size: 11px;">
    <header class="mb-6">
      <p class="text-[10px] font-semibold tracking-widest text-slate-400 uppercase mb-1">${esc(d.periodLabel.toUpperCase())}</p>
      <h1 class="text-2xl font-bold text-slate-900">${esc(d.missionLabel)}</h1>
      <p class="text-slate-500 mt-1">Rapport d'activité · Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
    </header>

    <section class="mb-6 grid grid-cols-4 gap-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <p class="text-2xl font-bold text-slate-900 tabular-nums">${k.totalCalls}</p>
        <p class="text-slate-500 mt-0.5">Appels</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <p class="text-2xl font-bold text-emerald-600 tabular-nums">${k.meetings}</p>
        <p class="text-slate-500 mt-0.5">RDV bookés</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <p class="text-2xl font-bold text-indigo-600 tabular-nums">${k.conversionRate}%</p>
        <p class="text-slate-500 mt-0.5">Taux conversion</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <p class="text-2xl font-bold text-slate-900 tabular-nums">${talkMin} min</p>
        <p class="text-slate-500 mt-0.5">Talk time</p>
      </div>
    </section>

    <section class="mb-6">
      <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Performance SDR</h2>
      <div class="overflow-hidden rounded-lg border border-slate-200">
        <table class="w-full text-left">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">SDR</th>
              <th class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Appels</th>
              <th class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Rappels</th>
              <th class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">RDV</th>
            </tr>
          </thead>
          <tbody>
            ${d.sdrPerformance.slice(0, 6).map((s) => `
            <tr class="border-t border-slate-100">
              <td class="px-4 py-2 font-medium">${esc(s.sdrName)}</td>
              <td class="px-4 py-2 text-right tabular-nums">${s.calls}</td>
              <td class="px-4 py-2 text-right tabular-nums">${s.callbacks}</td>
              <td class="px-4 py-2 text-right tabular-nums font-semibold text-emerald-600">${s.meetings}</td>
            </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Analyse IA</h2>
      <div class="rounded-lg border border-violet-100 bg-violet-50/30 p-4">
        <div class="prose prose-sm max-w-none text-slate-700 leading-relaxed">${esc(d.aiSummary).replace(/\n/g, "<br/>")}</div>
      </div>
    </section>
  </div>
</body>
</html>`;
}
