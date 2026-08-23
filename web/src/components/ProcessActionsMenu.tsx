import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import { Ellipsis, MoveRight, Settings2, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

export interface ProcessActionsMenuProps {
  processName: string;
  canMoveSelection: boolean;
  onEdit: () => void;
  onMoveSelection: () => void;
  onDelete: () => void;
}

export function ProcessActionsMenu({ processName, canMoveSelection, onEdit, onMoveSelection, onDelete }: ProcessActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties>({});
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

  useLayoutEffect(() => {
    if (!open) return;

    function positionMenu() {
      const trigger = rootRef.current?.querySelector<HTMLButtonElement>(".process-actions-menu__trigger");
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 8;
      const offset = 5;
      const roomBelow = window.innerHeight - triggerRect.bottom - gap;
      const roomAbove = triggerRect.top - gap;
      const below = roomBelow >= menuRect.height || roomBelow >= roomAbove;
      const idealTop = below ? triggerRect.bottom + offset : triggerRect.top - menuRect.height - offset;
      setMenuPosition({
        top: Math.max(gap, Math.min(idealTop, window.innerHeight - menuRect.height - gap)),
        left: Math.max(gap, Math.min(triggerRect.right - menuRect.width, window.innerWidth - menuRect.width - gap)),
      });
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);

  function closeAndRestoreFocus() {
    setOpen(false);
    window.setTimeout(() => rootRef.current?.querySelector<HTMLButtonElement>(".process-actions-menu__trigger")?.focus(), 0);
  }

  function dismissWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
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
    <div className="process-actions-menu" ref={rootRef} onBlur={dismissWhenFocusLeaves}>
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
        <div id={menuId} ref={menuRef} className="process-actions-menu__content" role="menu" style={menuPosition} onKeyDown={moveMenuFocus}>
          <Button
            variant="ghost"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              closeAndRestoreFocus();
              onEdit();
            }}
          >
            <Settings2 aria-hidden="true" />
            Process settings
          </Button>
          <Button
            variant="ghost"
            role="menuitem"
            tabIndex={-1}
            disabled={!canMoveSelection}
            onClick={() => {
              closeAndRestoreFocus();
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
              closeAndRestoreFocus();
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
