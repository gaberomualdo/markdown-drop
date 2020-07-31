let ipcRenderer;

try {
  ({ ipcRenderer } = require('electron'));

  ipcRenderer.on('begin-print', () => {
    document.body.classList.add('printing');
  });
  ipcRenderer.on('end-print', () => {
    document.body.classList.remove('printing');
  });
} catch (err) {}

const markdown = window.markdownit();

const READ_WPM = 265;

let fileReloadInterval;
let currentFileMarkdown;

document.addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();

  const file = Array.from(event.dataTransfer.files)[0];

  if (file.type === 'text/markdown') {
    loadMarkdownFile(file);

    if (fileReloadInterval) {
      clearInterval(fileReloadInterval);
    }

    try {
      // if in electron, reload markdown periodically
      require('electron');
      fileReloadInterval = setInterval(() => {
        loadMarkdownFile(file);
      }, 1000);
    } catch (err) {}
  } else {
    return alert('File not a markdown file.');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

const updateScrollingStatus = () => {
  if (window.scrollY > 0) {
    document.body.classList.add('scrolled');
  } else {
    document.body.classList.remove('scrolled');
  }
};

window.addEventListener('load', updateScrollingStatus);
window.addEventListener('scroll', updateScrollingStatus);

const loadMarkdownFile = (file) => {
  const filename = file.name;

  let reader = new FileReader();

  reader.readAsDataURL(file);
  reader.onload = () => {
    console.log(reader);
    const base64 = reader.result.split(',')[1]; // .split(',')[1] to remove beginning data:text/markdown;base64,
    const markdownContent = atob(base64);

    let html;

    try {
      html = markdown.render(markdownContent);
    } catch {
      return alert('Invalid Markdown');
    }

    const contentElm = document.getElementById('content');

    // only update when changes have been made
    if (currentFileMarkdown !== markdownContent) {
      currentFileMarkdown = markdownContent;
      contentElm.innerHTML = html;
    }

    convertLinkElmsToBrowserOpens(contentElm);

    reloadSyntaxHighlighter();

    const wordCount = getWordCount(contentElm.innerText);
    document.getElementById('meta').innerText = `${filename}
${wordCount} words
~${getReadTimeMinutes(READ_WPM, wordCount)} min read (${READ_WPM} wpm)`;
  };
};

// opens links with default web browser rather than within the desktop app
const convertLinkElmsToBrowserOpens = (container) => {
  container.querySelectorAll('a').forEach((linkElm) => {
    if (linkElm.getAttribute('href')) {
      linkElm.setAttribute('href', "javascript:shell.openExternal('" + linkElm.getAttribute('href').replace(/\'/g, "\\'") + "');");
    }
  });
};

const getWordCount = (text) => {
  text = text.replace(/\s\s+/g, ' '); // replace multiple whitespace with a getWordCount
  return text.split(' ').length;
};

const getReadTimeMinutes = (wpm, wordcount) => {
  return Math.ceil(wordcount / wpm);
};

const reloadSyntaxHighlighter = () => {
  const syntaxHighlighterFilePath = 'assets/prism.js';

  const head = document.getElementsByTagName('head')[0];

  const existingScript = document.head.querySelector("script[src='" + syntaxHighlighterFilePath + "']");
  if (existingScript) {
    existingScript.parentElement.removeChild(existingScript);
  }

  const newScript = document.createElement('script');
  newScript.src = syntaxHighlighterFilePath;
  head.appendChild(newScript);
};
