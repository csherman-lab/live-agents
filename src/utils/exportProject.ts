import { useCoreStore } from '../integration/store/coreStore';
import { useTeamStore } from '../integration/store/teamStore';
import { getAgentSet } from '../data/agents';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportProjectDeliverables(): Promise<void> {
  const core = useCoreStore.getState();
  const team = getAgentSet(
    useTeamStore.getState().selectedAgentSetId,
    useTeamStore.getState().customSystems,
  );
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = team.teamName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  const manifest = {
    exportedAt: new Date().toISOString(),
    team: team.teamName,
    teamType: team.teamType,
    brief: core.userBrief,
    phase: core.phase,
    finalOutput: core.finalOutput,
    finalAssetType: core.finalAssetType,
    tasks: core.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      assignedAgentId: t.assignedAgentId,
      output: t.output,
      draftOutput: t.draftOutput,
    })),
    actionLog: core.actionLog,
    tokenUsage: core.totalTokenUsage,
    estimatedCostUsd: core.totalEstimatedCost,
    agentSummaries: core.agentSummaries,
  };

  downloadBlob(
    new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
    `live-agents-${slug}-${stamp}-manifest.json`,
  );

  if (core.finalOutput && core.finalAssetType === 'text') {
    downloadBlob(
      new Blob([core.finalOutput], { type: 'text/markdown' }),
      `live-agents-${slug}-${stamp}-deliverable.md`,
    );
  }

  if (core.finalAssetContent && core.finalAssetType === 'image') {
    const binary = atob(core.finalAssetContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    downloadBlob(new Blob([bytes], { type: 'image/png' }), `live-agents-${slug}-${stamp}-deliverable.png`);
  }

  if (core.finalAssetContent && core.finalAssetType === 'audio') {
    const binary = atob(core.finalAssetContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    downloadBlob(new Blob([bytes], { type: 'audio/mpeg' }), `live-agents-${slug}-${stamp}-deliverable.mp3`);
  }

  const report = buildHtmlReport(manifest, core.finalAssetType, core.finalAssetContent, core.finalOutput);
  downloadBlob(new Blob([report], { type: 'text/html' }), `live-agents-${slug}-${stamp}-report.html`);
}

function buildHtmlReport(
  manifest: Record<string, unknown>,
  assetType: string,
  assetContent: string | null,
  finalOutput: string | null,
): string {
  const brief = String(manifest.brief || 'No brief');
  const output = finalOutput || 'No text output';
  let assetHtml = '';
  if (assetType === 'image' && assetContent) {
    assetHtml = `<img src="data:image/png;base64,${assetContent}" style="max-width:100%;border-radius:12px" alt="Deliverable"/>`;
  } else if (assetType === 'audio' && assetContent) {
    assetHtml = `<audio controls src="data:audio/mp3;base64,${assetContent}"></audio>`;
  } else if (assetType === 'video' && assetContent) {
    assetHtml = `<video controls style="max-width:100%;border-radius:12px"><source src="${assetContent}" type="video/mp4"/></video>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Live Agents Export</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1d1d1f;line-height:1.6}
  h1{font-size:28px;font-weight:600} h2{font-size:15px;color:#6e6e73;text-transform:uppercase;letter-spacing:.05em;margin-top:32px}
  pre{background:#f5f5f7;padding:16px;border-radius:12px;white-space:pre-wrap;font-size:14px}
  .meta{color:#6e6e73;font-size:13px}
</style></head><body>
<h1>Live Agents — Project Export</h1>
<p class="meta">Exported ${manifest.exportedAt} · ${manifest.team} · Est. $${Number(manifest.estimatedCostUsd).toFixed(4)}</p>
<h2>Brief</h2><pre>${escapeHtml(brief)}</pre>
<h2>Deliverable</h2>${assetHtml}<pre>${escapeHtml(output)}</pre>
<h2>Tasks (${(manifest.tasks as unknown[]).length})</h2>
<pre>${escapeHtml(JSON.stringify(manifest.tasks, null, 2))}</pre>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
