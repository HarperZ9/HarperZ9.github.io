import { useState } from "react";

/* Live, client-side demonstration of Witnessed Independence.
   A verdict records whether the judging criterion and the artifact
   share an author. In require-independent mode it refuses to decide
   when independence is not positively witnessed. You cannot grade
   your own homework, and here you can watch it refuse to try. */

type Independence = "witnessed-independent" | "self-authored" | "unwitnessed";
type Decision = "graded" | "refused";

function classify(artifactAuthor: string, criterionAuthor: string): Independence {
  const a = artifactAuthor.trim().toLowerCase();
  const c = criterionAuthor.trim().toLowerCase();
  if (!a || !c) return "unwitnessed";
  if (a === c) return "self-authored";
  return "witnessed-independent";
}

export default function WitnessedIndependence() {
  const [artifactAuthor, setArtifactAuthor] = useState("model-A");
  const [criterionAuthor, setCriterionAuthor] = useState("model-A");
  const [requireIndependent, setRequireIndependent] = useState(true);

  const independence = classify(artifactAuthor, criterionAuthor);
  const decision: Decision =
    requireIndependent && independence !== "witnessed-independent" ? "refused" : "graded";

  const note =
    independence === "self-authored"
      ? "The artifact and the criterion share an author. Grading here is grading your own homework."
      : independence === "unwitnessed"
      ? "At least one author is unrecorded, so independence cannot be witnessed. Absence of a claim is not a claim of independence."
      : "The judging criterion was authored by someone other than the artifact's author. Independence is positively witnessed.";

  const outcome =
    decision === "refused"
      ? "REFUSED: independence not witnessed"
      : independence === "witnessed-independent"
      ? "GRADED: witnessed independence on the record"
      : "GRADED, but the verdict carries that independence was NOT witnessed";

  return (
    <div className="wi" aria-label="Witnessed independence, live">
      <div className="wi-head">
        <span className="wi-tag mono">witnessed independence · runs in your browser</span>
        <span className={"wi-badge wi-" + independence}>{independence}</span>
      </div>

      <div className="wi-authors">
        <label className="wi-field">
          <span className="wi-label">Who authored the artifact?</span>
          <input className="mono" value={artifactAuthor} spellCheck={false}
            onChange={(e) => setArtifactAuthor(e.target.value)} aria-describedby="wi-note" />
        </label>
        <label className="wi-field">
          <span className="wi-label">Who authored the judging criterion?</span>
          <input className="mono" value={criterionAuthor} spellCheck={false}
            onChange={(e) => setCriterionAuthor(e.target.value)} aria-describedby="wi-note" />
        </label>
      </div>

      <label className="wi-toggle">
        <input type="checkbox" checked={requireIndependent}
          onChange={(e) => setRequireIndependent(e.target.checked)} />
        <span>require witnessed independence to decide <span className="wi-mode mono">(opt-in boundary)</span></span>
      </label>

      <p id="wi-note" className="wi-noteline">{note}</p>

      <div className={"wi-outcome wi-outcome-" + decision}>
        <span className="wi-outcome-k mono">{decision === "refused" ? "◇" : "◆"}</span>
        <span>{outcome}</span>
      </div>

      <p className="emet-foot mono">
        Independence goes from an assumption to recorded, re-checkable state. Read the paper:{" "}
        <a href="https://doi.org/10.5281/zenodo.21232206" rel="noopener">Witnessed Independence (Zenodo)</a>.
      </p>
    </div>
  );
}
