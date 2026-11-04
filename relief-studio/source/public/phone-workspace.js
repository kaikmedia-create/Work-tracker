import {cropTools} from './phone-crop.js?v=2';
// Phone-only presentation layer. Never clone project controls, canvases or meshes.
export function attachPhoneWorkspace(media, cssURL) {
  const $ = s => document.querySelector(s);
  const body = document.body, workspace = $('.workspace'), header = $('.topbar'), actions = $('.header-actions');
  if (!workspace || !actions || !header) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = cssURL; link.media = media.media;
  let dispose = null, ready = false;
  function mount() {
    const controller = new AbortController(); const options = {signal:controller.signal};
    const button = (text,id) => Object.assign(document.createElement('button'),{type:'button',textContent:text,id});
    const menu = button('Projekt ▾','phone-project'); const previousNavId = actions.id;
    actions.id = 'phone-project-actions'; menu.setAttribute('aria-controls',actions.id); menu.setAttribute('aria-expanded','false');
    header.insertBefore(menu,actions);
    const dock = document.createElement('nav'); dock.id = 'phone-dock'; dock.setAttribute('aria-label','Arbeitsansicht');
    const editor = button('Bearbeiten','phone-edit'), preview = button('Vorschau','phone-preview');
    const side = $('.sidebar'), main = $('.main'), oldSideId = side.id, oldMainId = main.id;
    side.id = 'phone-editor-panel'; main.id = 'phone-preview-panel'; editor.setAttribute('aria-controls',side.id); preview.setAttribute('aria-controls',main.id);
    dock.append(editor,preview); body.append(dock);
    const mapTip = $('.map-tip'), modelTip = $('.model-tip'), oldMapTip = mapTip.textContent, oldModelTip = modelTip.textContent;
    mapTip.textContent = 'Auswahl ziehen · Größe an den Ecken ändern · + / − zum Zoomen';
    modelTip.textContent = 'Ein Finger dreht · Zwei Finger verschieben und zoomen';
    let pane = 'edit', previousMode = body.dataset.mode, frame = 0;
    function setMenu(open) {menu.setAttribute('aria-expanded',String(open));body.toggleAttribute('data-phone-menu',open);}
    function setPane(next,scroll=true) {
      pane=next;body.dataset.phonePane=next;
      editor.setAttribute('aria-pressed',String(next==='edit'));preview.setAttribute('aria-pressed',String(next==='preview'));
      setMenu(false);if(scroll) window.scrollTo(0,0);
    }
    body.dataset.phone='';setPane('edit',false);
    editor.addEventListener('click',()=>setPane('edit'),options);preview.addEventListener('click',()=>setPane('preview'),options);
    menu.addEventListener('click',()=>setMenu(!body.hasAttribute('data-phone-menu')),options);
    document.addEventListener('pointerdown',e=>{if(!header.contains(e.target))setMenu(false);},options);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&body.hasAttribute('data-phone-menu')){setMenu(false);menu.focus();}},options);
    header.addEventListener('focusout',e=>{if(e.relatedTarget&&!header.contains(e.relatedTarget))setMenu(false);},options);
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(actions.contains(b)){setMenu(false);if(b.id==='export-top')setPane('edit');if(!b.hidden)menu.focus({preventScroll:true});}
      if(b.id==='draw-area'||b.id==='fit-area'){
        setPane('preview');cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(b.id==='fit-area')$('#map-canvas').focus({preventScroll:true});});
      }else if(b.id==='notice-action'&&$('#notice-action').textContent.includes('Zum Ort'))setPane('edit');
      else if(b.matches('[data-step],#step-back,#step-next')&&!b.dataset.blocked && !body.querySelector('dialog[open]'))window.scrollTo(0,0);
    },options);
    const load=$('#loader'),notice=$('#notice');
    const state=new MutationObserver(()=>{
      if(body.dataset.mode!==previousMode){previousMode=body.dataset.mode;setPane('edit',false);}
      if(!load.hidden&&pane!=='preview')setPane('preview');
      if(!notice.hidden&&notice.classList.contains('error')&&notice.isConnected)notice.scrollIntoView({block:'nearest'});
    });
    state.observe(body,{attributes:true,attributeFilter:['data-mode']});state.observe(load,{attributes:true,attributeFilter:['hidden']});state.observe(notice,{attributes:true,attributeFilter:['class','hidden']});
    // #fit-area normally runs before the hidden map has a size. Run it once after layout instead.
    $('#fit-area').addEventListener('click',()=>setPane('preview'),{capture:true,signal:controller.signal});
    const undoCrop=cropTools({$,body,dock,editor,preview,setPane,signal:controller.signal});
    return ()=>{undoCrop();state.disconnect();controller.abort();cancelAnimationFrame(frame);setMenu(false);delete body.dataset.phone;delete body.dataset.phonePane;
      dock.remove();menu.remove();if(previousNavId)actions.id=previousNavId;else actions.removeAttribute('id');if(oldSideId)side.id=oldSideId;else side.removeAttribute('id');if(oldMainId)main.id=oldMainId;else main.removeAttribute('id');mapTip.textContent=oldMapTip;modelTip.textContent=oldModelTip;};
  }
  function sync(){if(media.matches&&ready&&!dispose)dispose=mount();else if(!media.matches&&dispose){dispose();dispose=null;}}
  link.onload=()=>{ready=true;sync();};document.head.append(link);media.addEventListener('change',sync);
}
