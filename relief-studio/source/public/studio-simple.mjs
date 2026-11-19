/** Presentation-only refinement. Never changes settings, geometry, data or exports.
 * Existing DOM nodes are moved, not cloned, so application listeners and state survive.
 * This reversible layer runs after UX29 in both the preview and source materializer.
 */
export function installSimpleStudio(doc = document) {
  const body = doc.body;
  if (!body || body.classList.contains('studio-simple')) return;
  const $ = selector => doc.querySelector(selector);
  const text = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
  const field = selector => {
    const el = $(selector);
    return el?.closest('.control') || el?.closest('.field-grid') || el?.closest('label') || el;
  };
  const hidden = selector => doc.querySelectorAll(selector).forEach(el => el.classList.add('simple-retired'));
  const disclosure = (parent, id, title, nodes) => {
    const requested = new Set(nodes.filter(el => el && el.parentElement === parent));
    const selected = [...parent.children].filter(el => requested.has(el));
    if (!selected.length) return null;
    const details = doc.createElement('details');
    details.id = id;
    details.className = 'simple-details';
    const summary = doc.createElement('summary');
    summary.textContent = title;
    const content = doc.createElement('div');
    content.className = 'simple-details-content';
    details.append(summary, content);
    parent.append(details);
    selected.forEach(el => content.append(el));
    return details;
  };
  const rest = (parent, id, title, keep) => parent && disclosure(parent, id, title,
    [...parent.children].filter(el => !keep.includes(el) && el.tagName !== 'H2'));
  const afterHint = node => node?.nextElementSibling?.matches('p.hint, p.micro') ? node.nextElementSibling : null;

  // Wait until the application has booted before this layer is appended to app.js.
  // No change/input event is dispatched during setup; saved values remain untouched.
  body.classList.add('studio-simple');
  text('#welcome-title', 'Dein Ort. Dein Original.');
  text('.welcome-copy > .eyebrow', 'KARTENPOSTER & 3D-RELIEFS');
  text('.welcome-copy > p', 'Wähle deinen Ort, gestalte dein Design und erstelle deine Druckdatei.');
  text('#choose-poster .mode-copy > .eyebrow', 'FÜR DEINE WAND');
  text('#choose-model .mode-copy > .eyebrow', 'FÜR DEINEN 3D-DRUCKER');
  text('#choose-poster .mode-copy > p', 'Dein Lieblingsort als persönliches Kartenposter.');
  text('#choose-model .mode-copy > p', 'Landschaft und Architektur als greifbares Modell.');
  text('#panel-place > h2', 'Ort & Ausschnitt');
  text('#panel-model > h2', 'Dein 3D-Relief');
  text('#panel-style > h2', 'Farben & Straßen');
  text('#panel-text > h2', 'Text & Format');
  text('#panel-export > h2', 'Druckdatei erstellen');

  // Retire duplicate shortcuts, not their underlying settings or event handlers.
  hidden('.city-presets, #draw-area, #marker-google, .mode-copy > small');
  const googleHint = $('#marker-google')?.previousElementSibling;
  if (googleHint?.matches('p.hint')) googleHint.classList.add('simple-retired');

  const actions = $('.header-actions');
  if (actions) {
    const project = disclosure(actions, 'simple-project', 'Projekt',
      ['#new-project', '#open-project', '#save-project', '#switch-mode'].map($));
    if (project) {
      project.className = 'simple-project';
      actions.prepend(project);
      const summary = project.querySelector('summary');
      summary.setAttribute('aria-label', 'Projektaktionen');
      // The existing touch workspace supplies its own project menu. Unwrap there,
      // including when a phone is rotated or the touch layout mounts asynchronously.
      const buttons = [...project.querySelectorAll('button')];
      const syncPhoneMenu = () => {
        const phone = body.hasAttribute('data-phone');
        if (phone) buttons.forEach(button => actions.insertBefore(button, project));
        else buttons.forEach(button => project.lastElementChild.append(button));
        project.hidden = phone; project.open = false;
      };
      syncPhoneMenu();
      const Observer = doc.defaultView?.MutationObserver;
      if (Observer) new Observer(syncPhoneMenu).observe(body, {attributes:true, attributeFilter:['data-phone']});
      project.addEventListener('click', event => {
        if (event.target.closest('button') && !event.target.closest('button').disabled) {
          // Capture focus before hiding: browsers otherwise reset it to the body.
          const restoreFocus = project.contains(doc.activeElement);
          project.open = false;
          if (restoreFocus) summary.focus();
        }
      });
      doc.addEventListener('click', event => {
        if (project.open && !project.contains(event.target)) project.open = false;
      });
      doc.addEventListener('keydown', event => {
        if (event.key === 'Escape' && project.open) {
          project.open = false; summary.focus(); event.preventDefault();
        }
      });
      project.addEventListener('focusout', event => {
        // activeElement can briefly be body between pointerdown and click.
        // Use the actual focus destination; never hide a button before its click.
        if (event.relatedTarget && !project.contains(event.relatedTarget)) project.open = false;
      });
    }
  }

  const place = $('#panel-place');
  if (place) disclosure(place, 'simple-place-more', 'Kartendaten', [field('#force-refresh')]);

  const model = $('#panel-model');
  if (model) {
    // Road mode, curvature and profile height stay in the main panel, unchanged.
    // Width factors in panel-style are also never moved, hidden or rewritten.
    const surface = field('#city-surface');
    const architecture = field('#architecture-mode');
    const smooth = field('#terrain-smooth');
    const landmark = $('#landmark-list');
    const landmarkHint = landmark?.previousElementSibling;
    const landmarkHeading = landmarkHint?.previousElementSibling;
    const technical = [$('#aerial-setting'), $('#aerial-status'), surface, afterHint(surface),
      $('#surface-state'), $('#hybrid-help'), architecture, afterHint(architecture), smooth, afterHint(smooth),
      $('#model-advanced'), landmark,
      landmarkHint?.matches('p.hint') ? landmarkHint : null,
      landmarkHeading?.matches('.section-title') ? landmarkHeading : null];
    const base = $('[data-setting="base"]')?.closest('label');
    if (base?.parentElement?.matches('.field-grid')) {
      const grid = base.parentElement;
      model.append(base); technical.push(base);
      grid.classList.add('simple-single-field');
    }
    const technicalDetails = disclosure(model, 'simple-model-more', 'Gelände & Gebäudedetails', technical);
    // Put secondary water controls together; their values and precision do not change.
    const water = field('#water-mode');
    const waterHeading = water?.previousElementSibling;
    const waterDetails = disclosure(model, 'simple-water-more', 'Gewässer & Grünflächen',
      [waterHeading?.matches('.section-title') ? waterHeading : null, water, field('#water-profile'), field('#green-profile')]);
    if (waterDetails && technicalDetails) model.insertBefore(waterDetails, technicalDetails);
    // Keep source/data warnings accessible. Only the generic explanatory callout folds away.
    const callout = model.querySelector(':scope > .callout');
    if (callout && technicalDetails) technicalDetails.lastElementChild.prepend(callout);
  }

  const style = $('#panel-style');
  const posterDetails = style?.querySelector(':scope > [data-mode-only="poster"]');
  if (posterDetails) {
    const buildings = $('[data-setting="showBuildings"]')?.closest('label');
    const labels = $('[data-setting="showLabels"]')?.closest('label');
    const heading = posterDetails.querySelector(':scope > .section-title');
    rest(posterDetails, 'simple-style-more', 'Orte, Ebenen & eigene Farben', [heading, buildings, labels]);
  }

  const typography = $('#panel-text');
  if (typography) {
    const presets = typography.querySelector('.design-presets');
    const keep = [presets, field('[data-setting="title"]'), field('[data-setting="subtitle"]'),
      field('[data-setting="caption"]'), field('[data-setting="font"]'), field('#paper'),
      $('#portrait')?.parentElement, field('[data-setting="paperW"]'), field('#map-scale'), field('#margin-space')];
    // Section headings are redundant with the clear field labels in this shorter panel.
    typography.querySelectorAll(':scope > .section-title').forEach(el => el.classList.add('simple-retired'));
    rest(typography, 'simple-text-more', 'Typografie & weitere Optionen', keep);
  }

  const exp = $('#poster-export-options');
  if (exp) {
    const dpi = field('[data-setting="dpi"]');
    const adaptive = field('[data-setting="adaptive"]');
    disclosure(exp, 'simple-export-more', 'Auflösung & Dateigröße', [dpi, afterHint(dpi), adaptive, afterHint(adaptive)]);
  }
  // Restored focus and form validity must work even when a field lives in a disclosure.
  doc.addEventListener('invalid', event => {
    let parent = event.target.parentElement;
    while (parent) { if (parent.matches('details.simple-details')) parent.open = true; parent = parent.parentElement; }
  }, true);
}

export const simpleCSS = `
/* RELIEF_SIMPLE_CSS_V1 — editor chrome only; never select canvas, SVG or rendered map paths. */
body.studio-simple{--paper:#f6f5f1;--surface:#fff;--ink:#26332d;--muted:#6c756f;--line:#e3e6e0;--accent:#334f40;background:var(--paper);color:var(--ink)}
.studio-simple .simple-retired{display:none!important}
.studio-simple .topbar{height:72px;background:#fff;padding:0 28px;gap:16px}
.studio-simple .brand{font-size:22px;letter-spacing:-.7px}
.studio-simple .brand small,.studio-simple .project-state .version{display:none}
.studio-simple .header-actions{align-items:center;gap:8px}
.studio-simple .welcome{max-width:1080px;margin:auto;padding:56px 32px 36px}
.studio-simple .welcome-copy{text-align:center;margin:0 auto 32px;max-width:650px}
.studio-simple .welcome-copy h1{font-family:Georgia,serif;font-size:clamp(36px,4.6vw,62px);font-weight:400;letter-spacing:-2px;line-height:1.12;margin:16px 0}
.studio-simple .welcome-copy p{font-size:15px;line-height:1.7;color:var(--muted);margin:0}
.studio-simple .eyebrow{font-size:10px;letter-spacing:1.5px;color:var(--muted)}
.studio-simple .mode-cards{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.studio-simple .mode-card{padding:0;text-align:left;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;color:var(--ink);box-shadow:0 8px 24px #26332d06}
.studio-simple .mode-card:hover{border-color:#87998c;transform:translateY(-2px)}
.studio-simple .mode-illustration{height:218px;background:#eceee8}
.studio-simple .poster-illustration{background:#efeee7}
.studio-simple .relief-illustration{background:#e7ece5}
.studio-simple .mode-copy{padding:24px 26px 26px}
.studio-simple .mode-copy h2{font:400 27px Georgia,serif;letter-spacing:-.6px;margin:10px 0}
.studio-simple .mode-copy p{font-size:13px;line-height:1.65;color:var(--muted);margin:0}
.studio-simple .welcome-bottom{justify-content:center;gap:12px;margin-top:24px;font-size:12px;flex-wrap:wrap}
.studio-simple .welcome-note{flex-basis:100%;text-align:center}
.studio-simple .sidebar-intro{padding:20px 24px 16px}
.studio-simple .sidebar-intro .eyebrow,.studio-simple #workflow-subtitle{display:none}
.studio-simple .sidebar-intro h1{font:400 25px Georgia,serif;letter-spacing:-.6px;margin:0}
.studio-simple .steps{padding:0 16px;border-top:0}
.studio-simple .steps button{font-size:11px;padding:12px 3px;min-height:48px}
.studio-simple .steps button b{font-size:10px;margin-bottom:5px}
.studio-simple .steps button[aria-current=step]{border-bottom-color:var(--accent);color:var(--ink);background:#f3f5f0}
.studio-simple .panel{padding:22px 24px 28px}
.studio-simple .panel h2{font:600 16px Arial,Helvetica,sans-serif;margin:0 0 20px;letter-spacing:-.2px}
.studio-simple .section-title{margin:24px 0 12px}
.studio-simple .section-title h3{font-size:12px}
.studio-simple .section-title .badge{display:none}
.studio-simple .panel label{font-size:12px;color:#505e54}
.studio-simple .panel input:not([type=range]):not([type=checkbox]):not([type=color]),.studio-simple .panel select{font-size:13px;border-color:#dce1da;background:#fff;border-radius:8px;min-height:42px}
.studio-simple .panel .hint,.studio-simple .panel .control small{font-size:11px;line-height:1.65;color:var(--muted)}
.studio-simple .control{margin:21px 0}
.studio-simple .control label{font-size:12px}
.studio-simple .control output{font-size:11px;background:#eef2eb;color:#3e5846;padding:4px 7px}
.studio-simple .area-card{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:14px 16px;margin:18px 0;background:#f3f5ef;border-color:var(--line)}
.studio-simple .area-card strong{font:500 20px Arial,Helvetica,sans-serif;margin:0}
.studio-simple .area-card small{flex-basis:100%;font-size:11px}
.studio-simple .ratio-buttons button{min-height:38px;font-size:11px}
.studio-simple .themes{gap:10px}
.studio-simple .themes button{border-radius:9px;padding:10px}
.studio-simple .theme-swatch{height:32px;border-radius:5px}
.studio-simple .themes span{font-size:11px}
.studio-simple .simple-single-field{grid-template-columns:1fr}
.studio-simple .simple-details{border:1px solid var(--line);border-radius:10px;margin:18px 0 0;background:#fff}
.studio-simple .simple-details > summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px;font-size:12px;font-weight:600;color:#48594d;min-height:46px}
.studio-simple .simple-details > summary::-webkit-details-marker,.studio-simple .simple-project > summary::-webkit-details-marker{display:none}
.studio-simple .simple-details > summary::after{content:'+';font-size:18px;font-weight:400}
.studio-simple .simple-details[open] > summary::after{content:'−'}
.studio-simple .simple-details[open] > summary{border-bottom:1px solid var(--line)}
.studio-simple .simple-details-content{padding:0 14px 14px;min-width:0}
.studio-simple .simple-details-content > :last-child{margin-bottom:0}
.studio-simple .simple-details-content .section-title{margin-top:20px}
.studio-simple .simple-project{position:relative;margin:0;border:0}
.studio-simple .simple-project > summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:8px;padding:10px 14px;font-size:12px;line-height:20px;background:#fff;white-space:nowrap}
.studio-simple .simple-project > summary::after{content:'⌄';margin-left:12px}
.studio-simple .simple-project > .simple-details-content{position:absolute;z-index:60;right:0;top:calc(100% + 8px);display:flex;flex-direction:column;min-width:200px;max-width:calc(100vw - 24px);padding:8px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 40px #26332d1c}
.studio-simple .simple-project button{width:100%;text-align:left;justify-content:flex-start;min-height:42px;padding:10px 12px}
.studio-simple summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.studio-simple .main{background:#f3f3ef;padding:24px}
.studio-simple .stage-top{gap:14px;margin-bottom:18px;flex-wrap:wrap}
.studio-simple .stage-top h2{font-size:29px;margin:5px 0 0}
.studio-simple .view-tabs{background:#e9ece5;border-color:#dfe4da}
.studio-simple .stage{border-radius:12px;border-color:#dce2d7;box-shadow:0 8px 28px #26332d05}
.studio-simple .sidebar-bottom{background:#fff;padding:14px 24px;border-top:1px solid var(--line)}
.studio-simple .step-navigation button{min-height:44px;font-size:12px}
.studio-simple .primary{background:var(--accent);border-color:var(--accent);border-radius:8px}
.studio-simple .export-types button{min-height:64px;border-radius:10px}
@media(min-width:761px){
 .studio-simple .workspace{grid-template-columns:minmax(0,1fr) 360px;height:calc(100dvh - 72px);min-height:480px}
 .studio-simple .workspace > .main{grid-column:1;grid-row:1;min-width:0}
 .studio-simple .workspace > .sidebar{grid-column:2;grid-row:1;border-right:0;border-left:1px solid var(--line);min-width:0}
 .studio-simple .workspace.sidebar-collapsed{grid-template-columns:minmax(0,1fr) 0!important}
 .studio-simple .workspace.sidebar-collapsed > .sidebar{border:0}
}
@media(min-width:1600px){.studio-simple .workspace{grid-template-columns:minmax(0,1fr) 390px}.studio-simple .main{padding:30px}}
@media(max-width:760px){
 .studio-simple .topbar{height:64px;padding:0 16px;gap:10px}
 .studio-simple .brand{font-size:18px}
 .studio-simple .brand img{width:29px;height:29px}
 .studio-simple .project-state{display:none}
 .studio-simple .header-actions{gap:4px}
 .studio-simple .header-actions .primary{padding:9px 10px;font-size:11px;gap:4px}
 .studio-simple .simple-project > summary{padding:9px 10px;font-size:11px}
 .studio-simple .welcome{padding:32px 20px}
 .studio-simple .welcome-copy{margin-bottom:24px}
 .studio-simple .welcome-copy h1{font-size:39px;letter-spacing:-1.5px}
 .studio-simple .welcome-copy p{font-size:13px}
 .studio-simple .mode-cards{grid-template-columns:1fr;gap:18px}
 .studio-simple .mode-illustration{height:164px}
 .studio-simple .mode-copy{padding:19px 22px 23px}
 .studio-simple .mode-copy h2{font-size:25px}
 .studio-simple .sidebar-intro{padding:16px 20px}
 .studio-simple .panel{padding:20px}
 .studio-simple .main{padding:16px}
 .studio-simple .panel input:not([type=range]):not([type=checkbox]):not([type=color]),.studio-simple .panel select{font-size:16px;min-height:44px}
 .studio-simple .simple-details > summary{min-height:48px}
}
@media(prefers-reduced-motion:reduce){.studio-simple button{transition:none}.studio-simple .mode-card:hover{transform:none}}
`;
const jsSuffix = '\n/* RELIEF_SIMPLE_APP_V1 */\n;(' + installSimpleStudio.toString() + ')();\n';
const cssSuffix = '\n' + simpleCSS;
const suffixes = { 'public/app.js': jsSuffix, 'public/style.css': cssSuffix };
export function applySimpleStudio(files) {
  for (const [name, suffix] of Object.entries(suffixes)) {
    if (typeof files[name] !== 'string' || files[name].endsWith(suffix)) continue;
    if (files[name].includes(name.endsWith('.js') ? 'RELIEF_SIMPLE_APP_V1' : 'RELIEF_SIMPLE_CSS_V1')) {
      throw Error('Simple Studio: unknown existing UI layer in ' + name);
    }
    files[name] += suffix;
  }
  return files;
}
export function unapplySimpleStudio(name, source) {
  const suffix = suffixes[name];
  if (!suffix) return source;
  if (source.endsWith(suffix)) return source.slice(0, -suffix.length);
  if (source.includes(name.endsWith('.js') ? 'RELIEF_SIMPLE_APP_V1' : 'RELIEF_SIMPLE_CSS_V1')) {
    throw Error('Simple Studio: refusing to remove modified UI layer in ' + name);
  }
  return source;
}
