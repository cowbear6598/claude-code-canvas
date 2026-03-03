export function isCtrlOrCmdPressed(event: MouseEvent | KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey
}
