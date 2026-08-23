import { useId, useRef, useState } from "react";
import { GitBranch } from "lucide-react";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { Button } from "../components/ui/button";

export function GuardLabelDialog({ onSubmit }: { onSubmit: (guardLabel: string) => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const [guardLabel, setGuardLabel] = useState("");
  const [error, setError] = useState("");
  useDialogFocus(dialogRef, () => undefined);

  return (
    <div className="guard-label-backdrop">
      <section ref={dialogRef} className="guard-label-dialog" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-title`} aria-describedby={helpId} tabIndex={-1}>
        <header>
          <span><GitBranch aria-hidden="true" /> Decision flow</span>
          <h2 id={`${inputId}-title`}>Guard label required</h2>
          <p>Describe the condition that allows this path to continue.</p>
        </header>
        <form noValidate onSubmit={(event) => {
          event.preventDefault();
          const normalized = guardLabel.trim();
          if (!normalized) {
            setError("Enter a guard label before creating the flow.");
            return;
          }
          onSubmit(normalized);
        }}>
          <label htmlFor={inputId}>Guard label</label>
          <input
            id={inputId}
            required
            value={guardLabel}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${helpId} ${errorId}` : helpId}
            placeholder="Example: [approved]"
            onChange={(event) => { setGuardLabel(event.target.value); if (error) setError(""); }}
          />
          <p id={helpId} className="guard-label-dialog__help">Required. Press Enter to create the flow.</p>
          {error && <p id={errorId} className="guard-label-dialog__error" role="alert">{error}</p>}
          <Button type="submit">Create flow</Button>
        </form>
      </section>
    </div>
  );
}
