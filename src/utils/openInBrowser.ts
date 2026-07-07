/** Open the current app URL in the system default browser (new tab). */
export function openInExternalBrowser(): void {
  window.open(window.location.href, '_blank', 'noopener,noreferrer');
}
