import { useEffect } from "react";

/**
 * The guides who host the films, first on the page after the name: their art, a short silent
 * loop while each one is on screen (never with reduced motion), their captioned introductions on a
 * press, and one "Your call" question from the first film. The words match tools/guides/data.py
 * (tests/test_guides.py checks). Loops, introductions and the question run from the shared
 * /system/guides.mjs, loaded after this renders; nothing plays sound or moves on by itself.
 */

type Guide = { id: string; name: string; title: string; style: string; role: string; habit: string; alt: string; hosts: Array<[string, string]> };

export const GUIDES: Guide[] = [
  {
    id: "tallow", name: "Tallow", title: "the night clerk", style: "retro thriller",
    role: "His head is a candle, and the wax is the time he has: every claim he checks burns a little of it.",
    habit: "Before he looks, he asks what you think. Then you find the source together.",
    alt: "Tallow, a tall clerk whose head is a lit candle, holds a reference card up to his flame in a dark office.",
    hosts: [["checking-cost", "Claiming got cheap. Checking did not."], ["visible-reasoning", "What a model's written reasoning can and cannot show"]],
  },
  {
    id: "pylon", name: "Pylon", title: "the claims inspector", style: "painted isometric",
    role: "A harbour seal in a traffic cone. A cone means nobody has checked a claim yet, and she puts one on every claim that washes in.",
    habit: "She shows you where each claim came from, tells you what is still waiting, and leaves the call to you.",
    alt: "Pylon, a heavy harbour seal wearing an orange traffic cone and a sash, stands on a lamplit harbour street holding a paper.",
    hosts: [["rederive", "Re-derive it. Don't take it on trust."], ["incentives", "Models do what training pays for"]],
  },
  {
    id: "rerun", name: "Rerun", title: "the hermit crab", style: "pixel 2.5D",
    role: "Its shell is glass with the receipts inside: a claim should carry its own evidence, so anyone can run the check again.",
    habit: "It knocks on a claim to hear whether anything is in there, and keeps count of its own wrong guesses on its claw.",
    alt: "Rerun, a red hermit crab with a glass prism for a shell, on a pixel-art beach; light through the prism splits into a small spectrum.",
    hosts: [["passing-check", "A passing check can still be wrong"], ["release-media", "the films from the latest releases"]],
  },
];

const VOICE = "Each introduction runs about 25 seconds, with captions and no sound.";
const CHOICES = ["It exists", "It does not", "I can't tell from the page"];

export default function Guides() {
  useEffect(() => {
    // Built at runtime so the bundler leaves it as a browser import of the shared site file.
    const url = ["", "system", "guides.mjs?v=20261012-guides-2"].join("/");
    import(/* @vite-ignore */ url).catch((e) => console.warn("guides:", e));
  }, []);
  return (
    <section id="guides" className="section guides-section" aria-labelledby="guides-title">
      <div className="section-heading">
        <h2 id="guides-title">Meet the guides</h2>
        <p className="section-lead">
          Three characters host the <a href="/explainers.html">explainer films</a>. Each one carries an idea from the films in its body,
          asks what you think before it shows you, and leaves the decision to you. <a href="/guides.html">More about the guides</a>.
        </p>
      </div>
      <ul className="gd-cast">
        {GUIDES.map((g) => (
          <li className="gd-card" key={g.id}>
            <span className="gd-frame" data-gd-loop={`/media/guides/${g.id}/idle.mp4`}>
              <img src={`/media/guides/${g.id}/still.jpg`} width="960" height="540" alt={g.alt} loading="lazy" decoding="async" />
            </span>
            <div>
              <h3><a href={`/guides.html#${g.id}`}>{g.name}</a>, {g.title}</h3>
              <p className="gd-role">{g.role} {g.habit}</p>
              <p className="gd-meta">
                Home style: {g.style}. Hosts{" "}
                {g.hosts.map(([slug, title], k) => (
                  <span key={slug}>{k > 0 ? " and " : ""}<a href={`/explainers.html#${slug}`}>{title}</a></span>
                ))}.
              </p>
              <div className="gd-actions">
                <button type="button" className="gd-btn" data-gd-intro="" aria-controls={`gd-intro-${g.id}`} aria-expanded="false">
                  Watch {g.name} (25 s, captions)
                </button>
              </div>
              <figure className="gd-intro" id={`gd-intro-${g.id}`} hidden>
                <video controls preload="none" playsInline width="1280" height="720" poster={`/media/guides/${g.id}/intro.jpg`}>
                  <source src={`/media/guides/${g.id}/intro.mp4`} type="video/mp4" />
                  <track kind="captions" src={`/media/guides/${g.id}/intro.vtt`} srcLang="en" label="English" />
                </video>
                <figcaption>{g.name}, introduced. {VOICE} <a href={`/guides.html#${g.id}`}>Transcript on the guides page</a>.</figcaption>
              </figure>
            </div>
          </li>
        ))}
      </ul>
      <div className="gd-call guides-call" data-gd-call="">
        <div>
          <h3>Your call</h3>
          <blockquote className="gd-ref">
            <cite>Hale, R., &amp; Morrow, J. (2019). Signal decay in peer networks. <i>Journal of Applied Inference</i>, 12(3), 44-61.</cite>
          </blockquote>
          <p className="gd-call-q">Does this work exist? Decide before you look it up.</p>
          <div className="gd-actions">
            {CHOICES.map((c) => (
              <button type="button" className="gd-btn" data-gd-choice={c} aria-pressed="false" key={c}>{c}</button>
            ))}
          </div>
          <p className="gd-answer" hidden aria-live="polite">
            Your answer: <span data-gd-said="" />. Rerun knocks, and the shell rings hollow: this reference was made up for the first film,
            and nothing on the page gives that away. Only a search tells. In the study the film follows, 55% of GPT-3.5&apos;s 222 references
            and 18% of GPT-4&apos;s 414 did not exist. The first film, hosted by Tallow, shows the search:{" "}
            <a href="/explainers.html#checking-cost">Claiming got cheap. Checking did not.</a>
          </p>
        </div>
        <span className="gd-frame" data-gd-action="/media/guides/rerun/action.mp4">
          <img src="/media/guides/rerun/close.jpg" width="480" height="480" alt="Rerun's eyes on their stalks under the glass shell. When you answer, Rerun knocks on a shell and it rings hollow." loading="lazy" decoding="async" style={{ objectFit: "contain" }} />
        </span>
      </div>
    </section>
  );
}
