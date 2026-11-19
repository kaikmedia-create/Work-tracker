/* A smaller presentation layer. Existing controls, event handlers and saved values
 * are retained; acquisition, road-width maths and export geometry are untouched. */
export function mountSimpleStudio(doc = document) {
  const body = doc.body;
  if (!body || body.dataset.studioUi === 'simple30') return;
  const $ = (s) => doc.querySelector(s);
  const make = (tag, cls, text) => {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  // Never clone inputs: their original listeners and values must survive.
  const take = (selector, closest) => {
    const el = $(selector);
    return el && (closest ? el.closest(closest) : el);
  };
  const setting = (key) => take('[data-setting="' + key + '"]', 'label');
  const control = (key) => take('[data-setting="' + key + '"]', '.control');
  const group = (title, nodes, optional = false, mode = '') => {
    const el = make(optional ? 'details' : 'section', 'simple-group');
    if (title) el.append(make(optional ? 'summary' : 'h3', '', title));
    const content = make('div', 'simple-group-body');
    for (const n of nodes.filter(Boolean)) content.append(n);
    el.append(content);
    if (mode) el.dataset.modeOnly = mode;
    return el;
  };
  const row = (...nodes) => {
    const el = make('div', 'simple-fields');
    nodes.filter(Boolean).forEach(n => el.append(n));
    return el;
  };
  function rebuild(id, title, build) {
    const panel = doc.getElementById(id);
    if (!panel) return;
    const heading = panel.querySelector(':scope > h2') || make('h2');
    heading.textContent = title;
    const legacy = make('div', 'simple-archive');
    legacy.hidden = true;
    legacy.inert = true;
    // Keep retired bindings out of layout, tab order and the accessibility tree.
    for (const child of [...panel.childNodes]) if (child !== heading) legacy.append(child);
    panel.replaceChildren(heading, legacy);
    for (const section of build()) if (section) panel.insertBefore(section, legacy);
  }

  body.dataset.studioUi = 'simple30';
  const welcomeTitle = $('#welcome-title');
  if (welcomeTitle) welcomeTitle.textContent = 'Dein Ort. Dein Original.';
  const intro = $('.welcome-copy > p');
  if (intro) intro.textContent = 'Gestalte deinen Lieblingsort als Kartenposter oder 3D-Relief.';
  const eyebrow = $('.welcome-copy > .eyebrow');
  if (eyebrow) eyebrow.textContent = 'RELIEF STUDIO';

  rebuild('panel-place', 'Welcher Ort?', () => {
    const hint = make('p', 'simple-note', 'Ausschnitt verschieben. Größe an den Ecken ändern.');
    return [
      group('', [$('#search-form'), $('#search-results')]),
      group('Ausschnitt', [take('#panel-place .ratio-buttons'), hint, take('#draw-area', '.inline-buttons')]),
      group('', [$('#load-reason')])
    ];
  });

  rebuild('panel-style', 'Karte gestalten', () => {
    const streets = group('Straßenstärke', ['major', 'secondary', 'local', 'paths'].map(control));
    streets.id = 'simple-streets';
    return [
      group('Farbwelt', [$('#themes')]),
      streets,
      group('Sehenswürdigkeiten', [
        setting('showLabels'), row(take('#marker-filter', 'label'), setting('markerLimit')),
        take('#marker-search', 'label'), $('#marker-count'),
        take('#marker-show-all', '.inline-buttons'), $('#marker-list'), setting('labelScale')
      ], true, 'poster'),
      group('Kartenebenen', [setting('showBuildings'), setting('contours'), setting('hillshade')], true, 'poster')
    ];
  });

  let sizeButtons = [];
  rebuild('panel-model', 'Dein 3D-Modell', () => {
    const sizes = make('div', 'simple-sizes');
    sizes.setAttribute('role', 'group');
    sizes.setAttribute('aria-label', 'Modellbreite wählen');
    for (const mm of [150, 200, 250]) {
      const button = make('button', 'simple-size', (mm / 10) + ' cm');
      button.type = 'button';
      button.dataset.modelSize = String(mm);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        const input = $('[data-setting="modelWidth"]');
        if (!input) return;
        input.value = String(mm);
        input.dispatchEvent(new Event('change', {bubbles: true}));
        syncSizes();
      });
      sizeButtons.push(button);
      sizes.append(button);
    }
    return [
      group('Druckgröße', [sizes, setting('modelWidth'), row(setting('base'), setting('frame'))]),
      group('Straßenprofil', [setting('roadMode'), control('roadRelief')]),
      group('Gewässer', [setting('waterMode'), control('waterDepth')], true)
    ];
  });
  function syncSizes() {
    const value = Number($('[data-setting="modelWidth"]')?.value);
    sizeButtons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.modelSize) === value)));
  }

  let customPaper;
  rebuild('panel-text', 'Text & Format', () => {
    customPaper = group('Eigene Maße', [row(setting('paperW'), setting('paperH'))], true);
    customPaper.id = 'simple-custom-paper';
    return [
      group('Format', [setting('paper'), take('#portrait', '.ratio-buttons'), customPaper]),
      group('Layout', [$('.design-presets')]),
      group('Beschriftung', [setting('title'), setting('subtitle'), setting('autoSubtitle'), setting('caption'), setting('showCoordinates')]),
      group('Rand & Kartengröße', [control('mapScale'), control('margin'), setting('showAttribution')], true)
    ];
  });
  function syncPaper() {
    if (customPaper && $('[data-setting="paper"]')?.value === 'custom') customPaper.open = true;
  }

  // Leave export validation, source credits, file types and error messages intact.
  const exportPanel = $('#panel-export');
  if (exportPanel) {
    const retired = make('div', 'simple-archive'); retired.hidden = true; retired.inert = true;
    exportPanel.append(retired);
    for (const key of ['dpi', 'adaptive']) {
      const node = setting(key); if (node) retired.append(node);
    }
    $('#poster-export-options')?.querySelectorAll('.hint, .size-promise').forEach(n => retired.append(n));
  }

  // Selecting a preset explicitly replaces a legacy custom palette, not silently on import.
  $('#themes')?.addEventListener('click', event => {
    if (!event.target.closest('[data-theme]')) return;
    const custom = $('[data-setting="customColors"]');
    if (custom?.checked) { custom.checked = false; custom.dispatchEvent(new Event('change', {bubbles: true})); }
  }, true);

  const actions = $('.header-actions');
  let menu;
  if (actions) {
    menu = make('details', 'simple-project'); menu.id = 'simple-project-menu';
    const summary = make('summary', '', 'Projekt'); summary.setAttribute('aria-label', 'Projektaktionen');
    const items = make('div', 'simple-project-items');
    for (const id of ['new-project', 'open-project', 'save-project', 'switch-mode']) {
      const node = doc.getElementById(id); if (node) items.append(node);
    }
    menu.append(summary, items); actions.prepend(menu);
    items.addEventListener('click', event => {
      if (event.target.closest('button') && !body.hasAttribute('data-phone')) menu.open = false;
    });
    doc.addEventListener('pointerdown', event => {
      if (!menu.contains(event.target) && !body.hasAttribute('data-phone')) menu.open = false;
    });
    doc.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open && !body.hasAttribute('data-phone')) {
        menu.open = false; summary.focus();
      }
    });
  }

  let lastPhone = null;
  function sync() {
    const mode = body.dataset.mode;
    const title = $('#workflow-title');
    if (title && mode !== 'choose') title.textContent = mode === 'poster' ? 'Kartenposter' : '3D-Relief';
    const names = mode === 'poster' ? ['Ort', 'Stil', 'Text', 'Export'] : ['Ort', 'Modell', 'Stil', 'Export'];
    doc.querySelectorAll('.steps [data-step]').forEach((button, i) => {
      const span = button.querySelector('span'); if (span && names[i]) span.textContent = names[i];
    });
    const phone = body.hasAttribute('data-phone');
    if (menu && phone !== lastPhone) menu.open = phone;
    lastPhone = phone;
    syncSizes(); syncPaper();
  }
  doc.addEventListener('change', event => {
    if (event.target.matches('[data-setting="paper"], [data-setting="modelWidth"]')) { syncSizes(); syncPaper(); }
  });
  const observer = new MutationObserver(sync);
  observer.observe(body, {attributes: true, attributeFilter: ['data-mode', 'data-phone']});
  doc.querySelectorAll('.panel').forEach(panel => observer.observe(panel, {attributes: true, attributeFilter: ['hidden']}));
  sync();
}

export const simpleCSS = `
/* RELIEF_SIMPLE30_CSS */
body[data-studio-ui="simple30"]{--paper:#f5f5f2;--surface:#fff;--ink:#222c28;--muted:#747c76;--line:#e5e7e2;--accent:#294e3d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:var(--paper);color:var(--ink)}
[data-studio-ui="simple30"] .simple-archive{display:none!important}
[data-studio-ui="simple30"] .topbar{height:68px;min-height:68px;padding:0 24px;gap:16px;background:#fff;border-bottom:1px solid var(--line)}
[data-studio-ui="simple30"] .brand{font-size:21px;letter-spacing:-.65px;gap:9px}
[data-studio-ui="simple30"] .brand small,[data-studio-ui="simple30"] .project-state,[data-studio-ui="simple30"] .sidebar-intro>.eyebrow,[data-studio-ui="simple30"] #workflow-subtitle{display:none}
[data-studio-ui="simple30"] .brand img{width:30px;height:30px}
[data-studio-ui="simple30"] .header-actions{align-items:center;gap:9px}
[data-studio-ui="simple30"] button{font-family:inherit}
[data-studio-ui="simple30"] .primary{background:var(--accent);border-color:var(--accent);border-radius:10px;min-height:42px;font-weight:600;gap:9px}
[data-studio-ui="simple30"] .secondary{background:#fff;border:1px solid #dfe3dc;border-radius:9px;min-height:38px;color:#34453b}
[data-studio-ui="simple30"] :is(button,summary,a,input,select):focus-visible{outline:2px solid #294e3d;outline-offset:3px}
[data-studio-ui="simple30"] .simple-project{position:relative;margin:0;z-index:50}
[data-studio-ui="simple30"] .simple-project>summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:10px;min-height:42px;display:flex;align-items:center;gap:12px;padding:0 15px;font-size:12px;font-weight:500;background:#fff}
[data-studio-ui="simple30"] .simple-project>summary:after{content:'⌄';font-size:15px;color:#798379}
[data-studio-ui="simple30"] .simple-project>summary::-webkit-details-marker{display:none}
[data-studio-ui="simple30"] .simple-project-items{position:absolute;right:0;top:calc(100% + 8px);width:205px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:7px;box-shadow:0 12px 35px #142c1d14;display:grid;gap:3px}
[data-studio-ui="simple30"] .simple-project-items button{width:100%;justify-content:flex-start;padding:11px 12px;font-size:12px}
[data-studio-ui="simple30"] .welcome{max-width:1060px;padding:70px 30px 42px}
[data-studio-ui="simple30"] .welcome-copy .eyebrow{color:#718176;font-size:10px;letter-spacing:2px}
[data-studio-ui="simple30"] .welcome h1{font:500 clamp(32px,4.2vw,54px)/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;letter-spacing:-2px;margin:19px 0}
[data-studio-ui="simple30"] .welcome-copy>p{font-size:15px;line-height:1.7;color:#798078;margin:0}
[data-studio-ui="simple30"] .mode-cards{gap:22px;margin-top:40px}
[data-studio-ui="simple30"] .mode-card{border-radius:18px;border:1px solid #e0e4dc;background:#fff;box-shadow:0 4px 18px #1c362405;overflow:hidden;transition:border-color .18s,box-shadow .18s}
[data-studio-ui="simple30"] .mode-card:hover{transform:none;border-color:#9dab9d;box-shadow:0 8px 28px #1c36240c}
[data-studio-ui="simple30"] .mode-illustration{height:205px;background:#e9ece5}
[data-studio-ui="simple30"] .poster-illustration{background:#eeede7}
[data-studio-ui="simple30"] .mode-copy{padding:25px 28px 27px}
[data-studio-ui="simple30"] .mode-copy>.eyebrow,[data-studio-ui="simple30"] .mode-copy>small{display:none}
[data-studio-ui="simple30"] .mode-copy h2{font-size:24px;line-height:1.3;font-weight:600;letter-spacing:-.7px;margin:0 0 9px}
[data-studio-ui="simple30"] .mode-copy p{font-size:13px;line-height:1.6;color:#788177;margin:0}
[data-studio-ui="simple30"] .welcome-bottom{margin-top:26px;gap:12px;font-size:12px}
[data-studio-ui="simple30"] .welcome-note{font-size:11px}
[data-studio-ui="simple30"] .sidebar{background:#fff;border-right:1px solid var(--line)}
[data-studio-ui="simple30"] .sidebar-intro{padding:22px 24px 17px}
[data-studio-ui="simple30"] .sidebar-intro h1{font:600 24px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;letter-spacing:-.7px;margin:0}
[data-studio-ui="simple30"] .steps{margin:0 18px 6px;padding:4px;gap:3px;border:1px solid #eaede5;background:#f5f6f2;border-radius:11px;flex-shrink:0}
[data-studio-ui="simple30"] .steps button{padding:9px 3px;border:0;border-radius:7px;min-height:45px;color:#788276;font-size:11px}
[data-studio-ui="simple30"] .steps button b{display:none}
[data-studio-ui="simple30"] .steps button span{font-size:11px;margin:0;color:inherit}
[data-studio-ui="simple30"] .steps button[aria-current=step]{background:#fff;color:#294e3d;box-shadow:0 1px 4px #172d2410;font-weight:600}
[data-studio-ui="simple30"] .steps button[aria-current=step] span{color:inherit}
[data-studio-ui="simple30"] .panel{padding:20px 24px 25px}
[data-studio-ui="simple30"] .panel>h2{font:600 16px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;letter-spacing:-.25px;margin:0 0 20px}
[data-studio-ui="simple30"] .simple-group{border:0;border-top:1px solid #edf0e9;margin:22px 0 0;padding:20px 0 0}
[data-studio-ui="simple30"] .simple-group:first-of-type{border-top:0;margin-top:0;padding-top:0}
[data-studio-ui="simple30"] .simple-group>h3,[data-studio-ui="simple30"] .simple-group>summary{font-size:12px;font-weight:600;line-height:1.4;margin:0 0 14px;letter-spacing:.05px;color:#374b3d}
[data-studio-ui="simple30"] details.simple-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;min-height:30px;margin:0;padding:0 0 1px}
[data-studio-ui="simple30"] details.simple-group>summary:after{content:'+';font-size:19px;color:#7a867a;font-weight:400}
[data-studio-ui="simple30"] details.simple-group[open]>summary{margin-bottom:13px}
[data-studio-ui="simple30"] details.simple-group[open]>summary:after{content:'−'}
[data-studio-ui="simple30"] details.simple-group>summary::-webkit-details-marker{display:none}
[data-studio-ui="simple30"] .simple-note{font-size:11px;line-height:1.6;color:#7d857d;margin:12px 0}
[data-studio-ui="simple30"] label{font-size:11px;color:#677567;margin:12px 0}
[data-studio-ui="simple30"] input:is([type=text],[type=search],[type=number]),[data-studio-ui="simple30"] select{background:#fff;border-color:#dfe5db;border-radius:8px;font-size:13px;line-height:1.4;min-height:42px;padding:10px}
[data-studio-ui="simple30"] input[type=search]{padding-right:35px}
[data-studio-ui="simple30"] input[type=range]{accent-color:#315941;height:4px}
[data-studio-ui="simple30"] .simple-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
[data-studio-ui="simple30"] .simple-fields>label{min-width:0}
[data-studio-ui="simple30"] .simple-sizes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:17px}
[data-studio-ui="simple30"] .simple-size{border:1px solid #dce3d8;border-radius:10px;background:#fff;padding:13px 4px;min-height:46px;font-size:13px;font-weight:600;color:#647663}
[data-studio-ui="simple30"] .simple-size[aria-pressed=true]{border-color:#315941;background:#eff5ed;color:#294e3d;box-shadow:inset 0 0 0 1px #315941}
[data-studio-ui="simple30"] .themes{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
[data-studio-ui="simple30"] .themes button{padding:8px;border-radius:10px;background:#fff;border-color:#e0e6db;min-width:0}
[data-studio-ui="simple30"] .themes button>span{height:38px;width:100%;border-radius:6px;display:block}
[data-studio-ui="simple30"] .themes button>small{display:block;margin-top:8px;font-size:11px;color:#53624f}
[data-studio-ui="simple30"] .themes button.selected{border-color:#315941;outline:1px solid #315941}
[data-studio-ui="simple30"] .control{margin:18px 0}
[data-studio-ui="simple30"] .control label{font-size:11px;color:#60715f}
[data-studio-ui="simple30"] .control output{font-size:10px;background:#f2f5ee;color:#496646;min-width:47px;text-align:center;border-radius:5px;padding:4px 7px}
[data-studio-ui="simple30"] .control small,[data-studio-ui="simple30"] .control>.hint{display:none}
[data-studio-ui="simple30"] .ratio-buttons{gap:6px}
[data-studio-ui="simple30"] .ratio-buttons button{border-radius:7px;background:#fff;font-size:11px;min-height:36px;padding:8px 5px}
[data-studio-ui="simple30"] .ratio-buttons button.selected{background:#eff4ec;border-color:#789177;color:#315941}
[data-studio-ui="simple30"] .design-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
[data-studio-ui="simple30"] .design-presets button{border-radius:8px;border:1px solid #e1e6dc;background:#fff;padding:11px 6px;font-size:11px;color:#556c50}
[data-studio-ui="simple30"] .landmark-list{max-height:300px;overflow:auto;scrollbar-width:thin}
[data-studio-ui="simple30"] .marker-row{padding:9px 0}
[data-studio-ui="simple30"] #marker-count{font-size:10px;line-height:1.6;color:#7b8777}
[data-studio-ui="simple30"] .sidebar-bottom{background:#fff;border-top:1px solid var(--line);padding:14px 18px!important}
[data-studio-ui="simple30"] .workflow-status{display:none}
[data-studio-ui="simple30"] #step-hint{font-size:10px;line-height:1.5;margin:0 0 9px;color:#7d8879}
[data-studio-ui="simple30"] .step-navigation{display:grid;grid-template-columns:1fr 1.55fr;gap:9px}
[data-studio-ui="simple30"] .step-navigation button{min-height:45px;font-size:12px;border-radius:10px;justify-content:center}
[data-studio-ui="simple30"] .stage-top{gap:12px;margin-bottom:13px}
[data-studio-ui="simple30"] .stage-top>div:first-of-type{flex:1;min-width:0}
[data-studio-ui="simple30"] #stage-eyebrow{display:none}
[data-studio-ui="simple30"] #stage-title{font:600 23px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;letter-spacing:-.7px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-studio-ui="simple30"] .view-tabs{background:#fff;border-color:#e2e6de;padding:4px;border-radius:10px}
[data-studio-ui="simple30"] .view-tabs button{font-size:11px;padding:9px 12px;border-radius:7px;color:#7a8777}
[data-studio-ui="simple30"] .view-tabs button.active{background:#edf2e8;box-shadow:none;color:#365932}
[data-studio-ui="simple30"] .stage{border:1px solid #dfe5d9;border-radius:15px;overflow:hidden;box-shadow:0 3px 18px #18351c05}
[data-studio-ui="simple30"] .main{background:#f5f5f2}
[data-studio-ui="simple30"] .model-view{background:radial-gradient(ellipse at 50% 42%,#fff 0,#f0f2eb 80%)}
[data-studio-ui="simple30"] .model-controls{border-radius:9px;background:#ffffffee;border-color:#e0e6da}
[data-studio-ui="simple30"] .notice{border-radius:11px;font-size:12px}
[data-studio-ui="simple30"] .export-types{gap:8px}
[data-studio-ui="simple30"] .export-types button{border-radius:10px;padding:15px 6px}
[data-studio-ui="simple30"] #load-reason:empty{display:none}
@media(min-width:761px){
 body[data-studio-ui="simple30"] .workspace{grid-template-columns:340px minmax(0,1fr)}
 body[data-studio-ui="simple30"] .main{padding:20px 24px 22px}
 body[data-studio-ui="simple30"] .workspace.sidebar-collapsed{grid-template-columns:0 minmax(0,1fr)!important}
 body[data-studio-ui="simple30"] .simple-project-items button[hidden]{display:none!important}
}
@media(min-width:1800px){body[data-studio-ui="simple30"] .workspace{grid-template-columns:360px minmax(0,1fr)}body[data-studio-ui="simple30"] .main{padding:24px 32px 28px}}
@media(max-width:1050px){[data-studio-ui="simple30"] .topbar{padding:0 18px}[data-studio-ui="simple30"] .view-tabs button{padding:9px 7px;font-size:10px}}
@media(max-width:760px){
 [data-studio-ui="simple30"] .topbar{padding:0 14px;min-height:62px;height:auto;gap:9px}
 [data-studio-ui="simple30"] .brand{font-size:19px}
 [data-studio-ui="simple30"] .brand img{width:27px;height:27px}
 [data-studio-ui="simple30"] .welcome{padding:38px 18px 24px}
 [data-studio-ui="simple30"] .welcome h1{font-size:35px;letter-spacing:-1.3px}
 [data-studio-ui="simple30"] .welcome-copy>p{font-size:13px}
 [data-studio-ui="simple30"] .mode-cards{margin-top:27px;gap:15px}
 [data-studio-ui="simple30"] .mode-illustration{height:155px}
 [data-studio-ui="simple30"] .mode-copy{padding:21px}
 [data-studio-ui="simple30"] .mode-copy h2{font-size:21px}
 [data-studio-ui="simple30"] .sidebar-intro{padding:17px 20px 15px}
 [data-studio-ui="simple30"] .panel{padding:18px 20px 25px}
 [data-studio-ui="simple30"] .main{padding:14px}
 [data-studio-ui="simple30"] input:is([type=text],[type=search],[type=number]),[data-studio-ui="simple30"] select{font-size:16px}
 [data-studio-ui="simple30"] #stage-title{font-size:19px}
}
body[data-studio-ui="simple30"][data-phone] .simple-project{display:contents}
body[data-studio-ui="simple30"][data-phone] .simple-project>summary{display:none}
body[data-studio-ui="simple30"][data-phone] .simple-project-items{display:contents;position:static;box-shadow:none}
@media(prefers-reduced-motion:reduce){[data-studio-ui="simple30"] *{scroll-behavior:auto!important;transition:none!important}}
`;

const appSuffix = '\n/* RELIEF_SIMPLE30_APP */\n;(' + mountSimpleStudio.toString() + ')(document);\n';
const suffixes = {'public/app.js': appSuffix, 'public/style.css': simpleCSS};
export function applySimpleStudio(files) {
  for (const [name, suffix] of Object.entries(suffixes)) {
    if (typeof files[name] !== 'string') continue;
    if (files[name].endsWith(suffix)) continue;
    if (files[name].includes(name.endsWith('app.js') ? '/* RELIEF_SIMPLE30_APP */' : '/* RELIEF_SIMPLE30_CSS */')) throw Error('Unbekannter Studio-UI-Stand: ' + name);
    files[name] += suffix;
  }
  return files;
}
export function unapplySimpleStudio(name, source) {
  const suffix = suffixes[name];
  if (!suffix) return source;
  if (source.endsWith(suffix)) return source.slice(0, -suffix.length);
  if (source.includes(name.endsWith('app.js') ? '/* RELIEF_SIMPLE30_APP */' : '/* RELIEF_SIMPLE30_CSS */')) throw Error('Veränderte Studio-UI: ' + name);
  return source;
}
