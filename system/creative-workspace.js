import {listProjects,getProject,deleteProject,renameProject} from './project-library.js?v=20260907-gallery-projects';
import {openProjectInEditor} from './project-router.js?v=20260907-gallery-projects';

const grid=document.querySelector('[data-workspace-projects]');
const empty=document.querySelector('[data-workspace-empty]');
const status=document.querySelector('[data-workspace-status]');
const openButton=document.querySelector('[data-workspace-open-file]');
const fileInput=document.querySelector('[data-workspace-file]');
let busy=false,renderVersion=0;
function announce(text){status.hidden=!text;status.textContent=text;}
function element(tag,className,text){const node=document.createElement(tag);node.className=className;if(text)node.textContent=text;return node;}
function action(label,handler){const button=element('button','',label);button.type='button';button.addEventListener('click',()=>run(button,handler));return button;}
async function run(button,handler){
  if(busy)return;busy=true;button.disabled=true;announce('');
  try{await handler();}catch(error){announce(error.message || 'This project could not be opened. Your saved work has not been changed.');}
  finally{busy=false;button.disabled=false;}
}
async function requireRecord(id){const record=await getProject(id);if(!record)throw new Error('This project is no longer in this browser. Open a downloaded backup to continue.');return record;}
function download(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name||'creative-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderCard(project){
  const card=element('article','workspace-card');card.dataset.workspaceCard=project.id;
  const open=action('',async()=>openProjectInEditor((await requireRecord(project.id)).file));
  open.className='workspace-open';open.setAttribute('aria-label',`Continue editing ${project.title} in ${project.editor}`);
  if(project.preview){const img=element('img','workspace-art');img.src=project.preview;img.alt='';img.loading='lazy';open.append(img);}
  else open.append(element('div','workspace-art workspace-art-fallback',project.editor));
  open.append(element('h3','',project.title));card.append(open);
  card.append(element('p','',`Continue in ${project.editor}`));
  const actions=element('div','workspace-card-actions');actions.setAttribute('aria-label',`Manage ${project.title}`);
  actions.append(action('Rename',async()=>{
    const title=prompt('Name this piece',project.title);if(title===null)return;
    await renameProject(project.id,title);await refresh();announce('Project renamed.');
    grid.querySelector(`[data-workspace-card="${project.id}"] .workspace-open`)?.focus();
  }),action('Download',async()=>{download((await requireRecord(project.id)).file);announce('Project file prepared for download.');}),action('Remove',async()=>{
    if(!confirm(`Remove “${project.title}” from this browser? Download a backup first if you want to keep it.`))return;
    await deleteProject(project.id);await refresh();announce('Project removed from this browser. Downloaded copies are unchanged.');openButton.focus();
  }));
  card.append(actions);return card;
}
async function refresh(){
  const version=++renderVersion;
  try{const projects=await listProjects();if(version!==renderVersion)return;grid.replaceChildren(...projects.map(renderCard));empty.hidden=projects.length!==0;}
  catch(error){if(version!==renderVersion)return;empty.hidden=true;announce(error.message || 'Browser storage is unavailable. Open a project file directly, or use the tools below.');}
}
openButton.hidden=false;
openButton.addEventListener('click',()=>{if(!busy)fileInput.click();});
fileInput.addEventListener('change',()=>{const file=fileInput.files?.[0];fileInput.value='';if(file)run(openButton,()=>openProjectInEditor(file));});
window.addEventListener('pageshow',()=>{if(!busy)refresh();});
window.addEventListener('focus',()=>{if(!busy)refresh();});
refresh();
