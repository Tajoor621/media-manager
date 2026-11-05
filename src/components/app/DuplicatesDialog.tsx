import { useEffect, useMemo, useState } from "react";
import { Modal, Button } from "@/components/ui";
import { findDuplicateGroups } from "@/lib/files/duplicates";
import { formatBytes } from "@/lib/files/format";
import { useFiles } from "@/lib/files/store";
import { TRASH_ID } from "@/lib/files/types";

export const DUPLICATES_EVENT = "mm-duplicates";

function revealLibraryFile(id: string) {
  const store = useFiles.getState();
  const node = store.nodes[id];
  if (!node) return;
  if (node.parentId === TRASH_ID) store.goPlace("trash");
  else if (node.parentId && store.nodes[node.parentId]?.kind === "folder")
    store.openFolder(node.parentId);
  useFiles.setState({ selectedIds: [id], settingsOpen: false, sidebarOpen: false, search: "" });
}

export function DuplicatesDialog() {
  const [open, setOpen] = useState(false);
  const nodes = useFiles((s) => s.nodes);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(DUPLICATES_EVENT, onOpen);
    return () => window.removeEventListener(DUPLICATES_EVENT, onOpen);
  }, []);

  const groups = useMemo(
    () => (open ? findDuplicateGroups(Object.values(nodes)) : []),
    [nodes, open],
  );

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Duplicate files" wide>
      <p className="text-sm text-muted">
        Files that share a name and size. This compares the library on this device, not file bytes,
        and skips Trash.
      </p>
      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-foreground">No duplicates in the library.</p>
      ) : (
        <ul className="mt-4 max-h-[50dvh] space-y-3 overflow-auto">
          {groups.map((group) => (
            <li key={`${group.size}:${group.name}`} className="rounded-md bg-elevated px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm">{group.name}</p>
                <p className="shrink-0 text-xs text-subtle tabular-nums">
                  {group.ids.length} copies · {formatBytes(group.size)}
                </p>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {group.ids.map((id) => {
                  const node = nodes[id];
                  const folder = node ? nodes[node.parentId] : undefined;
                  return (
                    <li key={id}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          revealLibraryFile(id);
                          setOpen(false);
                        }}
                      >
                        Show in {folder?.name ?? "library"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
