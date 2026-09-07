import { saveProject } from './project-library.js?v=20260907-gallery-projects';

function message(status, text, state) {
  status.hidden = !text;
  status.textContent = text || '';
  if (state) status.dataset.state = state;
  else delete status.dataset.state;
}

function defaultTitle(value) {
  const title = typeof value === 'string' ? value.trim() : '';
  return title ? title.slice(0, 80) : 'Creative project';
}

export function captureCanvasPreview(canvas) {
  if (!canvas || !canvas.width || !canvas.height) throw new Error('Project preview could not be captured.');
  const maxSide = 480;
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const preview = document.createElement('canvas');
  preview.width = Math.max(1, Math.round(canvas.width * scale));
  preview.height = Math.max(1, Math.round(canvas.height * scale));
  const context = preview.getContext('2d');
  if (!context) throw new Error('Project preview could not be captured.');
  context.drawImage(canvas, 0, 0, preview.width, preview.height);
  const data = preview.toDataURL('image/png');
  if (!data || !data.startsWith('data:image/png;base64,')) throw new Error('Project preview could not be captured.');
  return data;
}

export function mountLibrarySave(container, capture, { className } = {}) {
  if (!container || typeof capture !== 'function') return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Keep in workspace';
  button.dataset.projectLibrarySave = '';
  if (className) button.className = className;

  const link = document.createElement('a');
  link.href = 'workspace.html';
  link.textContent = 'Workspace';
  link.dataset.projectLibraryLink = '';
  if (className) link.className = className;

  const status = document.createElement('p');
  status.hidden = true;
  status.className = 'transform-note re-status';
  status.setAttribute('role', 'status');
  status.dataset.projectLibraryStatus = '';

  let busy = false;
  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    button.disabled = true;
    message(status, 'Preparing project...', 'loading');
    try {
      const captured = await capture({ preview: true });
      const file = captured?.file;
      const title = prompt('Name this piece', defaultTitle(captured?.title || file?.name));
      if (title === null) {
        message(status, '', null);
        return;
      }
      message(status, 'Keeping project...', 'loading');
      const project = await saveProject(file, { title, preview: captured?.preview });
      message(status, 'Kept in Workspace.', 'ready');
      container.dispatchEvent(new CustomEvent('project-library:saved', { bubbles: true, detail: { project } }));
    } catch (error) {
      message(status, error.message || 'This project could not be kept. Your editor work is unchanged.', error.state || 'error');
    } finally {
      busy = false;
      button.disabled = false;
    }
  });

  container.append(button, link, status);
  return { button, link, status };
}
