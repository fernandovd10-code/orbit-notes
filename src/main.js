import './style.css';
import { createClient } from '@supabase/supabase-js';

const app = document.querySelector('#app');
const $ = id => document.getElementById(id);
const colors = ['#a78bfa','#38d3e8','#fbad77','#ed83bd','#73b0ff','#71d8af'];
const format = new Intl.DateTimeFormat('es', {dateStyle:'medium',timeStyle:'short'});
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.1.0';

let db, session, channel, editing, dragging, timer, toastTimer;
let categories = [], notes = [], busy = false, loading = false, again = false, generation = 0;

function node(tag, cls='', text) {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function check(result) {
  if (result.error) throw result.error;
  return result.data;
}
function message(text) {
  if (!$('notice')) return;
  clearTimeout(toastTimer);
  $('notice').textContent = text;
  $('notice').hidden = false;
  toastTimer = setTimeout(() => { if ($('notice')) $('notice').hidden = true; },8000);
}
async function action(fn) {
  if (busy) return;
  busy = true;
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(b => b.disabled = true);
  try { await fn(); }
  catch (e) {
    message(e.code === '23505' ? 'Ya existe un tema con ese nombre.' : (e.message || 'No se pudo completar la operación.'));
    if ($('status')) $('status').textContent = 'Operación no confirmada · Revisa el aviso';
  }
  finally { busy = false; buttons.forEach(b => b.disabled = false); }
}
function selectOptions(select, value, excluded) {
  select.replaceChildren();
  categories.filter(c => c.id !== excluded).forEach(c => {
    const o = node('option','',c.name); o.value = c.id; select.append(o);
  });
  if (value) select.value = value;
}
function nextColor() {
  const used = new Set(notes.map(n => n.color.toLowerCase()));
  const preset = colors.find(c => !used.has(c));
  if (preset) return preset;
  let c;
  do { c = '#'+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0'); }
  while (used.has(c));
  return c;
}
function login(text='') {
  app.innerHTML = `
    <main class="min-h-screen flex items-center justify-center p-6">
      <section class="glass rounded-3xl p-9 max-w-md w-full text-center">
        <div class="logo w-14 h-14 rounded-2xl grid place-items-center text-3xl mx-auto mb-7" aria-hidden="true">✦</div>
        <p class="text-violet-300 text-xs uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5">
          <span>Orbit Notes</span>
          <span class="text-[10px] text-violet-300/70 font-mono bg-violet-500/15 border border-violet-500/25 px-1.5 py-0.5 rounded">${appVersion}</span>
        </p>
        <h1 class="text-3xl font-semibold">Tu universo de ideas.</h1>
        <p class="text-slate-400 text-sm leading-7 mt-4 mb-7">Un tablero privado, disponible desde todos tus dispositivos.</p>
        <button id="login" class="button primary w-full">Entrar con Google</button>
        <p id="loginText" class="text-xs text-amber-200 mt-5 break-words" role="status"></p>
        <button id="exit" class="button mt-4" hidden>Cerrar sesión</button>
      </section>
    </main>`;
  $('loginText').textContent = text;
  $('login').onclick = async () => {
    $('login').disabled = true;
    try {
      check(await db.auth.signInWithOAuth({
        provider:'google',
        options:{redirectTo:location.origin+'/',queryParams:{prompt:'select_account'}}
      }));
    } catch(e) {
      $('loginText').textContent = e.message;
      $('login').disabled = false;
    }
  };
  if (session) {
    $('exit').hidden = false;
    $('exit').onclick = async () => {
      const {error} = await db.auth.signOut();
      if (error) $('loginText').textContent = error.message;
    };
  }
}
function workspace() {
  const userLabel = session?.user?.user_metadata?.full_name || session?.user?.email || 'Espacio personal';
  app.innerHTML = `
    <main class="workspace">
      <header class="glass rounded-2xl p-4 flex justify-between items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <div class="logo w-10 h-10 rounded-xl grid place-items-center text-xl" aria-hidden="true">✦</div>
          <span class="text-xl font-semibold">orbit<span class="text-violet-400">.</span></span>
          <span class="text-[10px] text-violet-300/70 font-mono bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded tracking-wide">${appVersion}</span>
          <span class="hidden md:block text-xs text-slate-400 ml-2 truncate max-w-xs" title="${userLabel}">${userLabel}</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button id="themes" class="button">Temas</button>
          <button id="export" class="button">Exportar</button>
          <button id="import" class="button">Importar</button>
          <button id="new" class="button primary">+ Nueva nota</button>
          <button id="logout" class="button">Salir</button>
        </div>
      </header>
      <section class="hero">
        <div>
          <p class="text-violet-300 text-xs uppercase tracking-widest mb-3">Un lugar para cada idea</p>
          <h1 class="text-4xl xl:text-5xl font-semibold leading-tight tracking-tight">Organiza tu mente.<br><span class="gradient">Expande tus ideas.</span></h1>
          <p class="text-slate-400 text-sm mt-4 leading-7">Tus temas y apuntes. Un mismo tablero desde cualquier dispositivo.</p>
          <p class="text-teal-300 text-xs mt-5">● Almacenamiento en la nube</p>
        </div>
        <div class="scene" aria-hidden="true">
          <div class="ring"></div>
          <div class="stack"><div class="sheet back"></div><div class="sheet middle"></div>
            <div class="sheet front"><div class="text-3xl mb-5">✦</div><div class="line"></div><div class="line"></div><div class="line w-2/3"></div></div>
          </div>
        </div>
      </section>
      <div class="flex justify-between items-center gap-4 flex-wrap mb-5">
        <div class="flex gap-4 items-center"><span class="text-violet-200 text-xs rounded-lg bg-violet-500/10 border border-violet-400/20 px-3 py-2">▥ Tablero por temas</span><span id="stats" class="text-xs text-slate-500"></span></div>
        <input id="search" type="search" class="input max-w-sm" placeholder="Buscar notas…" aria-label="Buscar notas">
      </div>
      <section id="board" class="board" aria-label="Tablero Kanban"></section>
      <footer class="border-t border-white/5 pt-4 text-xs text-slate-500 flex justify-between items-center gap-3 flex-wrap">
        <span id="status" role="status">Cargando…</span>
        <div class="flex items-center gap-2">
          <span>Arrastra para mover · Exporta para respaldar</span>
          <span class="font-mono text-[10px] text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">${appVersion}</span>
        </div>
      </footer>
    </main>
    <dialog id="editor" aria-labelledby="editorTitle">
      <form id="noteForm">
        <div class="flex justify-between items-center"><h2 id="editorTitle" class="text-2xl font-semibold">Nueva nota</h2><button type="button" id="close" class="button" aria-label="Cerrar">×</button></div>
        <div class="field"><label for="content">Contenido · Primera línea como título</label><textarea id="content" class="input" maxlength="50000" required placeholder="Título&#10;&#10;Detalles y apuntes…"></textarea></div>
        <div class="grid grid-cols-4 gap-4">
          <div class="field col-span-3"><label for="category">Tema</label><select id="category" class="input"></select></div>
          <div class="field"><label for="color">Color</label><input id="color" class="input h-11 p-1" type="color"></div>
        </div>
        <p id="metadata" class="text-xs text-slate-500 leading-6"></p>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" id="delete" class="button danger mr-auto" hidden>Eliminar</button>
          <button type="button" id="cancel" class="button">Cancelar</button>
          <button type="submit" class="button primary">Guardar</button>
        </div>
      </form>
    </dialog>
    <dialog id="topics" aria-labelledby="topicsTitle">
      <div class="flex justify-between items-center"><h2 id="topicsTitle" class="text-2xl font-semibold">Tus temas</h2><button id="closeTopics" class="button" aria-label="Cerrar">×</button></div>
      <p class="text-xs text-slate-400 mt-4 leading-6">Al eliminar un tema, sus notas se trasladan al destino seleccionado.</p>
      <div id="topicList" class="grid gap-4 my-5"></div>
      <form id="topicForm" class="flex gap-2"><input id="topicName" class="input" maxlength="60" required placeholder="Nuevo tema" aria-label="Nuevo tema"><button class="button primary">Añadir</button></form>
    </dialog>
    <input id="file" type="file" accept=".json,application/json" hidden>
    <div id="notice" class="notice" role="status" hidden></div>`;

  $('search').oninput = render;
  $('new').onclick = () => openNote();
  $('close').onclick = $('cancel').onclick = () => { if (!busy) $('editor').close(); };
  $('closeTopics').onclick = () => { if (!busy) $('topics').close(); };
  ['editor','topics'].forEach(id => $(id).addEventListener('cancel',e => { if(busy)e.preventDefault(); }));
  $('themes').onclick = () => { renderTopics(); $('topics').showModal(); };
  $('noteForm').onsubmit = e => { e.preventDefault(); action(saveNote); };
  $('delete').onclick = () => action(deleteNote);
  $('logout').onclick = () => action(async () => check(await db.auth.signOut()));
  $('export').onclick = () => action(exportBoard);
  $('import').onclick = () => $('file').click();
  $('file').onchange = e => { const file=e.target.files[0]; action(() => importBoard(file)); };
  $('topicForm').onsubmit = e => {
    e.preventDefault();
    action(async () => {
      const name=$('topicName').value.trim();
      if(!name) throw new Error('Escribe un nombre.');
      check(await db.from('categories').insert({name,position:Math.max(-1,...categories.map(c=>c.position))+1}));
      $('topicName').value='';
      await afterWrite('Tema añadido');
    });
  };
}
async function all(table, sort, ascending=true) {
  const result=[];
  for(let start=0;;start+=500) {
    const page=check(await db.from(table).select('*').order(sort,{ascending}).order('id').range(start,start+499));
    result.push(...page);
    if(page.length<500) return result;
  }
}
async function reload() {
  if(loading) { again=true; return; }
  loading=true;
  const current=generation;
  try {
    const [cs,ns]=await Promise.all([all('categories','position'),all('notes','created_at',false)]);
    if(current!==generation || !$('board')) return;
    categories=cs; notes=ns; render();
    if($('topics').open) renderTopics();
    $('status').textContent='✓ Datos cargados desde la nube';
  } finally {
    loading=false;
    if(again) { again=false; schedule(); }
  }
}
function schedule() {
  clearTimeout(timer);
  timer=setTimeout(() => {
    if($('board')) reload().catch(e => {
      if($('status')) $('status').textContent='No se pudo actualizar · Revisa la conexión';
      message(e.message);
    });
  },350);
}
async function afterWrite(text) {
  message(text);
  try { await reload(); }
  catch {
    if($('status')) $('status').textContent='✓ Cambio guardado · No se pudo recargar';
    message(text+'. Actualiza el tablero cuando tengas conexión.');
  }
}
function render() {
  const board=$('board'); if(!board)return;
  const scroll=board.scrollLeft;
  const q=$('search').value.toLocaleLowerCase('es').trim();
  const visible=notes.filter(n=>n.content.toLocaleLowerCase('es').includes(q));
  $('stats').textContent=`${categories.length} temas · ${notes.length} notas`+(q?` · ${visible.length} resultados`:'');
  board.replaceChildren();
  categories.forEach((c,i) => {
    const column=node('section','column'); column.style.setProperty('--topic',colors[i%colors.length]);
    column.setAttribute('aria-label',c.name);
    const header=node('div','flex items-center gap-2 mb-5');
    const icon=node('span','topic-icon',['▱','>_','◇','</>','⚙','✦'][i%6]); icon.setAttribute('aria-hidden','true');
    const own=visible.filter(n=>n.category_id===c.id);
    const add=node('button','ml-auto px-2 text-xl text-slate-400','+');
    add.setAttribute('aria-label','Crear nota en '+c.name); add.onclick=()=>openNote(null,c.id);
    header.append(icon,node('h2','font-semibold text-sm break-words',c.name),node('span','text-xs text-slate-500',String(own.length)),add);
    const list=node('div','notes');
    if(!own.length) list.append(node('div','empty',q?'Sin coincidencias.':'Las grandes ideas empiezan aquí. Pulsa + para crear una nota.'));
    own.forEach(n=>list.append(card(n)));
    column.append(header,list);
    column.ondragover=e=>{ if(dragging&&!busy){e.preventDefault();column.classList.add('over');} };
    column.ondragleave=e=>{if(!column.contains(e.relatedTarget))column.classList.remove('over');};
    column.ondrop=e=>{
      e.preventDefault(); column.classList.remove('over');
      const n=notes.find(n=>n.id===dragging); dragging=null;
      if(n)action(()=>moveNote(n,c.id));
    };
    board.append(column);
  });
  board.scrollLeft=scroll;
}
function card(n) {
  const article=node('article','note'); article.style.setProperty('--note',n.color); article.draggable=true;
  const top=node('div','flex justify-between items-center');
  const label=node('span','text-xs text-slate-400 flex gap-2 items-center','Nota');
  const dot=node('span','w-1.5 h-1.5 rounded-full'); dot.style.background=n.color; label.prepend(dot);
  const edit=node('button','text-xs text-slate-400 px-1','Editar'); edit.onclick=()=>openNote(n);
  edit.setAttribute('aria-label','Editar: '+n.content.split('\n')[0]); top.append(label,edit);
  const [title,...body]=n.content.split('\n');
  article.append(top,node('h3','',title||'Sin título'));
  if(body.length)article.append(node('div','note-body',body.join('\n')));
  const dates=node('div','dates');
  [['Creada',n.created_at],['Modificada',n.updated_at]].forEach(([label,date])=>{
    const row=node('div'); const time=node('time','',format.format(new Date(date))); time.dateTime=date;
    row.append(node('span','',label),time); dates.append(row);
  });
  const move=node('select','move'); selectOptions(move,n.category_id); move.setAttribute('aria-label','Cambiar tema');
  move.onchange=()=>{ const target=move.value;move.value=n.category_id;action(()=>moveNote(n,target)); };
  article.append(dates,move);
  article.ondragstart=e=>{
    if(busy || e.target.closest('button,select')){e.preventDefault();return;}
    dragging=n.id;e.dataTransfer.setData('text/plain',n.id);e.dataTransfer.effectAllowed='move';article.classList.add('dragging');
  };
  article.ondragend=()=>{dragging=null;article.classList.remove('dragging');document.querySelectorAll('.over').forEach(c=>c.classList.remove('over'));};
  return article;
}
function openNote(n=null,categoryId) {
  if(busy)return;
  editing=n?{...n}:null;
  $('editorTitle').textContent=n?'Editar nota':'Nueva nota';
  $('content').value=n?.content||''; $('color').value=n?.color||nextColor();
  selectOptions($('category'),n?.category_id||categoryId);
  $('delete').hidden=!n;
  $('metadata').textContent=n?`Creada: ${format.format(new Date(n.created_at))} · Modificada: ${format.format(new Date(n.updated_at))}`:'Se guardará en tu espacio privado.';
  $('editor').showModal();$('content').focus();
}
async function update(n,changes) {
  const rows=check(await db.from('notes').update(changes).eq('id',n.id).eq('updated_at',n.updated_at).select('id'));
  if(!rows.length) {
    schedule();
    throw new Error('La nota cambió en otro equipo o fue eliminada. Copia tu texto, cierra el editor y vuelve a abrirla.');
  }
}
async function saveNote() {
  const content=$('content').value.replace(/\r\n/g,'\n').trim();
  if(!content)throw new Error('Escribe el contenido.');
  const changes={content,color:$('color').value,category_id:$('category').value};
  if(editing) {
    if(editing.content!==content||editing.color!==changes.color||editing.category_id!==changes.category_id)await update(editing,changes);
  } else check(await db.from('notes').insert(changes));
  $('editor').close(); await afterWrite('Nota guardada en la nube');
}
async function moveNote(n,id) {
  if(n.category_id===id)return;
  await update(n,{category_id:id}); await afterWrite('Nota movida');
}
async function deleteNote() {
  if(!editing||!confirm('¿Eliminar esta nota definitivamente?'))return;
  const rows=check(await db.from('notes').delete().eq('id',editing.id).eq('updated_at',editing.updated_at).select('id'));
  if(!rows.length){schedule();throw new Error('La nota cambió. Cierra el editor y actualiza antes de eliminar.');}
  $('editor').close();await afterWrite('Nota eliminada');
}
function renderTopics() {
  $('topicList').replaceChildren();
  categories.forEach(c=>{
    const group=node('div','grid gap-2');const row=node('div','flex gap-2');
    const input=node('input','input');input.value=c.name;input.maxLength=60;input.setAttribute('aria-label','Nombre de '+c.name);
    const save=node('button','button','Guardar');
    save.onclick=()=>action(async()=>{
      const name=input.value.trim();if(!name)throw new Error('Escribe un nombre.');
      const rows=check(await db.from('categories').update({name}).eq('id',c.id).select('id'));
      if(!rows.length)throw new Error('El tema ya no existe. Actualiza.');
      await afterWrite('Tema actualizado');
    });
    const destination=node('select','input');selectOptions(destination,null,c.id);
    destination.setAttribute('aria-label','Destino de notas de '+c.name);
    const remove=node('button','button danger','Eliminar');
    remove.onclick=()=>action(async()=>{
      if(categories.length<2)throw new Error('Conserva al menos un tema.');
      if(!confirm(`¿Eliminar "${c.name}" y trasladar sus notas al destino seleccionado?`))return;
      check(await db.rpc('remove_category',{source_id:c.id,target_id:destination.value}));
      await afterWrite('Tema eliminado');
    });
    row.append(input,save,remove);group.append(row,destination);$('topicList').append(group);
  });
}
async function exportBoard() {
  const data=check(await db.rpc('export_board'));
  if(!data)throw new Error('No tienes autorización para exportar.');
  const blob=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=node('a');link.href=blob;link.download=`orbit-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(blob),10000);
  message('Respaldo exportado');
}
async function importBoard(file) {
  try {
    if(!file)return;
    if(file.size>20*1024*1024)throw new Error('El archivo supera 20 MB.');
    const data=JSON.parse(await file.text());
    if(data.version!==1||!Array.isArray(data.categories)||!Array.isArray(data.notes)||!data.categories.length||data.categories.length>100||data.notes.length>10000)throw new Error('Formato de respaldo inválido.');
    const ids=new Map(),names=new Set(),noteIds=new Set();
    const cs=data.categories.map((c,position)=>{
      if(typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.trim().length>60)throw new Error('Temas inválidos.');
      const name=c.name.trim(),normal=name.toLocaleLowerCase('es');
      if(names.has(normal))throw new Error('Temas duplicados.');
      names.add(normal);const id=crypto.randomUUID();ids.set(c.id,id);return{id,name,position};
    });
    const ns=data.notes.map(n=>{
      if(typeof n.id!=='string'||!n.id||noteIds.has(n.id)||!ids.has(n.categoryId)||typeof n.content!=='string'||!n.content.trim()||n.content.length>50000||typeof n.color!=='string'||!/^#[0-9a-f]{6}$/i.test(n.color)||typeof n.createdAt!=='string'||!Number.isFinite(Date.parse(n.createdAt))||typeof n.updatedAt!=='string'||!Number.isFinite(Date.parse(n.updatedAt)))throw new Error('Notas inválidas.');
      noteIds.add(n.id);
      return{id:crypto.randomUUID(),category_id:ids.get(n.categoryId),content:n.content,color:n.color,created_at:n.createdAt,updated_at:n.updatedAt};
    });
    if(!confirm(`Se reemplazará TODO tu tablero por ${ns.length} notas y ${cs.length} temas. Exporta antes para conservar tus datos actuales. ¿Continuar?`))return;
    check(await db.rpc('import_board',{payload:{categories:cs,notes:ns}}));
    await afterWrite('Respaldo importado');
  } finally {if($('file'))$('file').value='';}
}
async function activate(s) {
  const current=++generation;session=s;
  if(channel){db.removeChannel(channel);channel=null;}
  if(!s){login();return;}
  app.innerHTML='<p class="p-10 text-slate-400">Cargando tu universo de ideas…</p>';
  try {
    check(await db.rpc('initialize_board'));
    if(current!==generation)return;
    workspace();await reload();if(current!==generation)return;
    channel=db.channel('orbit-board-'+s.user.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'notes',filter:`user_id=eq.${s.user.id}`},schedule)
      .on('postgres_changes',{event:'*',schema:'public',table:'categories',filter:`user_id=eq.${s.user.id}`},schedule)
      .subscribe(status=>{
        if(current!==generation||!$('status'))return;
        if(status==='SUBSCRIBED')$('status').textContent='✓ Nube conectada · Tiempo real activo';
        if(['CHANNEL_ERROR','TIMED_OUT'].includes(status))$('status').textContent='Tiempo real desconectado · Consulta periódica activa';
      });
    schedule();
  } catch(e){if(current===generation)login(e.message);}
}
window.addEventListener('online',schedule);
window.addEventListener('focus',()=>{if($('board'))schedule();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('board'))schedule();});
setInterval(()=>{if(!document.hidden&&navigator.onLine&&$('board'))schedule();},60000);
window.addEventListener('beforeunload',e=>{
  if(!$('editor')?.open)return;
  if($('content').value!==(editing?.content||'') ||
    (editing&&($('color').value!==editing.color||$('category').value!==editing.category_id))) {
    e.preventDefault();e.returnValue='';
  }
});
if(!url||!key) {
  app.innerHTML='<main class="p-10 max-w-xl mx-auto"><h1 class="text-2xl mb-4">Configura Supabase</h1><p class="text-slate-400">Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Añádelas y vuelve a desplegar.</p><p class="text-xs text-slate-500 mt-2 font-mono">'+appVersion+'</p></main>';
} else {
  db=createClient(url,key);
  db.auth.onAuthStateChange((event,s)=>{
    if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event))setTimeout(()=>{
      if(event==='SIGNED_IN'&&session?.user.id===s?.user.id&&$('board')){session=s;return;}
      activate(s);
    },0);
    else if(event==='TOKEN_REFRESHED')session=s;
  });
}
