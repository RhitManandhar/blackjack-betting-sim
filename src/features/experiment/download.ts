// Saves text as a file in the browser. Browser-only; never imported by Node tests.

export function downloadText(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled so the download is not cut off.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
