import { Modal } from "@/components/ui";

export const SHORTCUTS: readonly [string, string][] = [
  ["⌘K / Ctrl+K", "Search all files"],
  ["⌘, / Ctrl+,", "Open settings"],
  ["⌘B / Ctrl+B", "Toggle sidebar"],
  ["⌘N / Ctrl+N", "New folder"],
  ["⌘A", "Select all"],
  ["⌘C / ⌘X / ⌘V", "Copy, cut, paste"],
  ["Enter", "Open the selection"],
  ["F2", "Rename"],
  ["Delete", "Move to trash"],
  ["Backspace / ⌘↑", "Up one folder"],
  ["?", "Show these shortcuts"],
  ["Esc", "Close the top panel"],
];

export function ShortcutList() {
  return (
    <ul className="space-y-1.5 text-sm text-muted">
      {SHORTCUTS.map(([keys, action]) => (
        <li key={keys} className="flex items-center justify-between gap-3">
          <span>{action}</span>
          <kbd className="rounded bg-elevated px-1.5 py-0.5 text-xs text-subtle hairline">
            {keys}
          </kbd>
        </li>
      ))}
    </ul>
  );
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <p className="mb-4 text-sm text-muted">
        Shortcuts stay out of the way while you are typing in a field.
      </p>
      <ShortcutList />
    </Modal>
  );
}
