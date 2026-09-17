/**
 * The file name a download gets: the spot's name and its version, in a form
 * every file system takes ("rivera-for-senate-new-spot-9x16.mp4"). The
 * render itself keeps its own name on the server; this is what lands in
 * the person's Downloads folder.
 */
export function exportFileName(projectName: string | null | undefined, aspect: string | null | undefined): string {
  const base = (projectName ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  const ratio = (aspect ?? '16:9').replace(':', 'x');
  return `${base || 'spot'}-${ratio}.mp4`;
}
