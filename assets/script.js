let ipcRenderer;
let hasElectron = false;
let fs;
let path;

try {
  ({ ipcRenderer } = require('electron'));

  ipcRenderer.on('begin-print', () => {
    document.body.classList.add('printing');
  });
  ipcRenderer.on('end-print', () => {
    document.body.classList.remove('printing');
  });

  const { remote } = require('electron');

  fs = remote.require('fs');
  path = remote.require('path');

  hasElectron = true;
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
    // clear reload interval if applicable
    if (fileReloadInterval) {
      clearInterval(fileReloadInterval);
    }

    if (hasElectron) {
      loadMarkdownFile(file.name, fs.readFileSync(file.path).toString(), () => {
        fixImageSources(file.path);
      });

      // reload periodically
      fileReloadInterval = setInterval(() => {
        loadMarkdownFile(file.name, fs.readFileSync(file.path).toString(), () => {
          fixImageSources(file.path);
        });
      }, 1000);
    } else {
      let reader = new FileReader();

      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // .split(',')[1] to remove beginning data:text/markdown;base64,
        const markdownContent = atob(base64);

        loadMarkdownFile(file.name, markdownContent);
      };
    }
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

const loadMarkdownFile = (filename, markdownContent, callback = () => {}) => {
  let html;

  try {
    html = markdown.render(markdownContent);
  } catch {
    return alert('Invalid Markdown');
  }

  const contentElm = document.getElementById('content');

  // don't do anything if no changes have been made
  if (currentFileMarkdown === markdownContent) {
    return;
  }

  currentFileMarkdown = markdownContent;
  contentElm.innerHTML = html;

  convertLinkElmsToBrowserOpens(contentElm);

  reloadSyntaxHighlighter();

  const wordCount = getWordCount(contentElm.innerText);
  const wordCountText = `${wordCount} words`;
  const readTimeText = `~${getReadTimeMinutes(READ_WPM, wordCount)} min read (${READ_WPM} wpm)`;

  document.getElementById('meta').innerText = `${filename}\n${wordCountText}\n${readTimeText}`;

  filenameHTML = filename.replace(/</g, '&lt;');
  filenameHTML = filenameHTML.replace(/>/g, '&gt;');
  document.getElementById('metasmall').innerHTML = `<span>${filename}</span><span>${wordCountText}</span><span>${readTimeText}</span>`;

  callback();
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

const fixImageSources = (originURL) => {
  const originDir = path.dirname(originURL);
  const absolutePath = new RegExp('^(?:[a-z]+:)?//', 'i');
  document
    .querySelector('#content')
    .querySelectorAll('img')
    .forEach((img) => {
      const src = img.getAttribute('src');
      const isAbsolute = absolutePath.test(src);
      console.log(img, src, isAbsolute);
      if (!isAbsolute) {
        const newSrc = path.join(originDir, src);
        console.log(newSrc);
        img.setAttribute('src', newSrc);
      }
    });
};
