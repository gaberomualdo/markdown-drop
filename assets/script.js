let ipcRenderer;
let hasElectron = false;
let fs;
let path;
let shell;

try {
  ({ ipcRenderer, shell } = require('electron'));

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
let refreshContent;

if (!hasElectron) {
  document.getElementById('desktopappbtn').style.display = 'block';
}

document.addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();

  document.body.classList.remove('dropping');

  if (!event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files[0]) {
    return;
  }

  const file = Array.from(event.dataTransfer.files)[0];

  if (file.type === 'text/markdown') {
    // clear reload interval if applicable
    if (fileReloadInterval) {
      clearInterval(fileReloadInterval);
      refreshContent = undefined;
    }

    if (hasElectron) {
      document.getElementById('refresh').style.display = 'block';

      loadMarkdownFile(file.name, fs.readFileSync(file.path).toString(), file.path);

      refreshContent = (forceRefresh = false) => {
        loadMarkdownFile(file.name, fs.readFileSync(file.path).toString(), file.path, forceRefresh);
      };

      // reload periodically
      fileReloadInterval = setInterval(refreshContent, 1000);
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
    return alert("This file doesn't look like a Markdown file.");
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

const updateBodyMinHeight = () => {
  document.body.setAttribute('style', 'min-height: ' + window.innerHeight + 'px !important');
};

window.addEventListener('load', updateBodyMinHeight);
window.addEventListener('scroll', updateBodyMinHeight);

document.addEventListener('dragenter', () => {
  document.body.classList.add('dropping');
});
document.addEventListener('dragleave', () => {
  document.body.classList.remove('dropping');
});

const loadMarkdownFile = (filename, markdownContent, imageOriginURL = '', forceRefresh = false) => {
  let html;

  try {
    html = markdown.render(markdownContent);
  } catch {
    return alert('Invalid Markdown');
  }

  const contentElm = document.getElementById('content');

  // don't do anything if no changes have been made (and force refresh has been turned off)
  if (!forceRefresh && currentFileMarkdown === markdownContent) {
    return;
  }

  document.body.classList.add('has-content');

  currentFileMarkdown = markdownContent;
  contentElm.innerHTML = html;

  convertLinkElmsToBrowserOpens(contentElm);

  reloadSyntaxHighlighter();

  const wordCount = getWordCount(contentElm.innerText);
  const wordCountText = `${wordCount} words`;
  const readTimeText = `~${getReadTimeMinutes(READ_WPM, wordCount)} min read (${READ_WPM} wpm)`;

  document.querySelector('.back-to-open-file-container').style.display = 'block';

  document.getElementById('meta').innerHTML = `${filename}<br/>${wordCountText}<br/>${readTimeText}`;

  filenameHTML = filename.replace(/</g, '&lt;');
  filenameHTML = filenameHTML.replace(/>/g, '&gt;');
  document.getElementById('metasmall').innerHTML = `<span>${filename}</span><span>${wordCountText}</span><span>${readTimeText}</span>`;

  fixImageSources(imageOriginURL);
};

// opens links with default web browser rather than within the desktop app
const convertLinkElmsToBrowserOpens = (container) => {
  container.querySelectorAll('a').forEach((linkElm) => {
    if (linkElm.getAttribute('href') && linkElm.getAttribute('href').trim().length > 0) {
      if (hasElectron) {
        linkElm.setAttribute('href', "javascript:shell.openExternal('" + linkElm.getAttribute('href').replace(/\'/g, "\\'") + "');");
      } else {
        linkElm.setAttribute('target', '_blank');
        linkElm.setAttribute('rel', 'noreferrer noopener');
      }
    } else {
      linkElm.removeAttribute('href');
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
  const absolutePath = new RegExp('^(?:[a-z]+:)?//', 'i');
  if (hasElectron) {
    const originDir = path.dirname(originURL);
    document
      .querySelector('#content')
      .querySelectorAll('img')
      .forEach((img) => {
        const src = img.getAttribute('src');
        const isAbsolute = absolutePath.test(src);
        if (!isAbsolute) {
          const newSrc = path.join(originDir, src);
          img.setAttribute('src', newSrc);
        }
      });
  } else {
    document
      .querySelector('#content')
      .querySelectorAll('img')
      .forEach((img) => {
        const src = img.getAttribute('src');
        const isAbsolute = absolutePath.test(src);
        if (!isAbsolute) {
          const newSrc = 'imagerelativeerror.png';
          img.setAttribute('src', newSrc);
        }
      });
  }
};

const btnClick = (btn) => {
  if (btn === 'features') {
    loadMarkdownFile(
      'features.md',
      `# MarkdownDrop Features

MarkdownDrop is a quick and easy way to view and print markdown files.

### Out of the Box, MarkdownDrop:

- Parses markdown and performs syntax highlighting on code blocks
- Shows word count and read time given 265 wpm (as used by Medium)
- Displays images from public URLs

### The MarkdownDrop Desktop App:

- Displays images from local URLs and parses relative URLs as well
- Refreshes the markdown file automatically every second
- Has a refresh button for manually refreshing images and other sources
- Works offline`,
      '',
      true
    );
  } else if (btn === 'credits') {
    loadMarkdownFile(
      'credits.md',
      `# MarkdownDrop Credits

MarkdownDrop is built by:

- Gabriel Romualdo ([xtrp.io](https://xtrp.io/), [@xtrp on GitHub](https://github.com/xtrp))

If you are a contributor and not listed here, [Submit an issue](https://github.com/xtrp/markdowndrop/issues/new/).

MarkdownDrop is open sourced on GitHub at [this repository](https://github.com/xtrp/markdowndrop).

Feel free to contribute to the GitHub repository.`,
      '',
      true
    );
  } else if (btn === 'about') {
    loadMarkdownFile(
      'about.md',
      `# About MarkdownDrop

### What is MarkdownDrop?

MarkdownDrop is the simplest, most efficient way to view and print Markdown files. It's available as both a web and desktop app, and was built by [Gabriel Romualdo](https://xtrp.io/).

### Why MarkdownDrop?

MarkdownDrop is extremely easy to use and provides useful information on Markdown files such as word count, and placement on popular readability scales. Code highlighting is also done out-of-the-box with MarkdownDrop, and over 100 languages are supported. On the desktop app, the contents of each Markdown file is refreshed automatically. MarkdownDrop also automatically formats files for printing.

### Technologies Used

MarkdownDrop is built with the following technologies:

 - Electron.js
 - Node.js
 - MarkdownIt
 - Prism
 - HTML, CSS, JavaScript

### More Information

For more information, click on the buttons on the left side of the app to see MarkdownDrop's features, credits, and more.
`,
      '',
      true
    );
  } else if (btn === 'desktopapp' && !hasElectron) {
    loadMarkdownFile(
      'desktop-app.md',
      `# MarkdownDrop Desktop App

### Features:

- Displays images from local URLs and parses relative URLs as well
- Refreshes the markdown file automatically every second
- Has a refresh button for manually refreshing images and other sources
- Works offline`,
      '',
      true
    );
  } else {
    return;
  }

  document.getElementById('refresh').style.display = 'none';
  refreshContent = undefined;

  // clear reload interval if applicable
  if (fileReloadInterval) {
    clearInterval(fileReloadInterval);
  }
};
