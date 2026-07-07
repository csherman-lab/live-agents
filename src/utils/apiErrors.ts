export function friendlyApiError(message: string): string {
  if (/demo mode/i.test(message)) {
    return 'Demo mode — add an API key in Settings to run agents';
  }
  if (/api.?key|invalid|401|403|unauthorized/i.test(message)) {
    return 'API key issue — check Settings';
  }
  if (/quota|rate|429|too many/i.test(message)) {
    return 'Rate limit hit — try again in a moment';
  }
  if (/network|fetch|failed to fetch|offline/i.test(message)) {
    return 'Network error — check your connection';
  }
  return message.length > 120 ? `${message.slice(0, 117)}…` : message;
}

export function isApiKeyError(message: string): boolean {
  return /api.?key|invalid|401|403|unauthorized|demo mode/i.test(message);
}
