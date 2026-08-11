import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Ellipsis, MoveRight, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

export interface ProcessActionsMenuProps {
  processName: string;
  canMoveSelection: boolean;
  onMoveSelection: () => void;
  onDelete: () => void;
}

export function ProcessActionsMenu({ processName, canMoveSelection, onMoveSelection, onDelete }: ProcessActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    firstItem?.focus();

    function dismissOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.document.addEventListener("pointerdown", dismissOnOutsidePointer);
    return () => window.document.removeEventListener("pointerdown", dismissOnOutsidePointer);
  }, [open]);

  function closeAndRestoreFocus() {
    setOpen(false);
    window.setTimeout(() => rootRef.current?.querySelector<HTMLButtonElement>(".process-actions-menu__trigger")?.focus(), 0);
  }

  function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    if (!items.length) return;
    const current = items.indexOf(window.document.activeElement as HTMLButtonElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div className="process-actions-menu" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        className="process-actions-menu__trigger"
        aria-label={`More actions for ${processName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <Ellipsis aria-hidden="true" />
      </Button>
      {open && (
        <div id={menuId} ref={menuRef} className="process-actions-menu__content" role="menu" onKeyDown={moveMenuFocus}>
          <Button
            variant="ghost"
            role="menuitem"
            tabIndex={-1}
            disabled={!canMoveSelection}
            onClick={() => {
              setOpen(false);
              onMoveSelection();
            }}
          >
            <MoveRight aria-hidden="true" />
            Move selection to this process
          </Button>
          <Button
            variant="ghost"
            role="menuitem"
            tabIndex={-1}
            className="process-actions-menu__delete"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete process
          </Button>
        </div>
      )}
    </div>
  );
}
