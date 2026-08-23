import { useMemo } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { validateDiagram } from "../domain/validation";
import { useDiagramStore } from "../store/diagram-store";

const icons = { error: AlertCircle, warning: AlertTriangle, info: Info };

export function ValidationPanel() {
  const document = useDiagramStore((state) => state.document);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const findings = useMemo(() => validateDiagram(document), [document]);

  return (
    <div className="validation-panel">
      <div className="validation-heading"><span>Validation</span><strong>{findings.length}</strong></div>
      {findings.length === 0 && <p className="validation-clean">No structural issues found.</p>}
      <div className="validation-items">
        {findings.slice(0, 8).map((finding) => {
          const Icon = icons[finding.severity];
          return (
            <button key={finding.id} className={`validation-item is-${finding.severity}`} onClick={() => setSelection(finding.nodeId ? [finding.nodeId] : [], finding.edgeId ? [finding.edgeId] : [])}>
              <Icon /><span>{finding.message}</span>
            </button>
          );
        })}
      </div>
      {findings.length > 8 && <p className="validation-more">+{findings.length - 8} more findings</p>}
    </div>
  );
}
