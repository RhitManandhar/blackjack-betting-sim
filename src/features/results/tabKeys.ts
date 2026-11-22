// Keyboard model for a horizontal tab list (WAI-ARIA Authoring Practices, "Tabs" pattern):
// Left and Right move to the previous and next tab and wrap around; Home and End go to the
// first and last. Any other key is left to the browser.

export function tabIndexForKey(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
