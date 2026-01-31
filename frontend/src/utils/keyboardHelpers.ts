export function isCtrlOrCmdPressed(e: MouseEvent | KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey
}
