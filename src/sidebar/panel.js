const formats = [
  'link',
  'bold',
  'font',
  'italic',
  'underline',
  'size',
  'strike',
  'indent',
  'list',
  'direction',
  'align'
];
const UI_LANG = browser.i18n.getUILanguage();
const RTL_LANGS = ['ar', 'fa', 'he'];
const LANG_DIR = RTL_LANGS.includes(UI_LANG) ? 'rtl' : 'ltr';
const TEXT_ALIGN_DIR = LANG_DIR === 'rtl' ? 'right' : 'left';
const SURVEY_PATH = 'https://qsurvey.mozilla.com/s3/notes?ref=sidebar';

// Additional keyboard shortcuts for non-default toolbar buttons
const bindings = {
  strike: {           // ⌘/Ctrl+Shift+X
    key: 'X',
    shiftKey: true,
    shortKey: true,
    handler: function(range) {
      if (this.quill.getFormat(range).strike === true)
        this.quill.formatText(range, 'strike', false);
      else
        this.quill.formatText(range, 'strike', true);
    }
  }, ordered: {       // ⌘/Ctrl+Shift+1
    key: '1',
    shiftKey: true,
    shortKey: true,
    handler: function(range) {
      if (this.quill.getFormat(range).list === 'ordered')
        this.quill.formatLine(range, {'list': false}, true);
      else
        this.quill.formatLine(range, {'list': 'ordered'}, true);
    }
  }, bullet: {        // ⌘/Ctrl+Shift+2
    key: '2',
    shiftKey: true,
    shortKey: true,
    handler: function(range) {
      if (this.quill.getFormat(range).list === 'bullet')
        this.quill.formatLine(range, {'list': false}, true);
      else
        this.quill.formatLine(range, {'list': 'bullet'}, true);
    }
  }
};

const Block = Quill.import('blots/block');
Block.tagName = 'DIV';
Quill.register(Block, true);

const fontSizeStyle = Quill.import('attributors/style/size');
fontSizeStyle.whitelist = ['12px', '14px', '16px', '18px', '20px'];
Quill.register(fontSizeStyle, true);

// add text direction icon to toolbar if RTL
const qlDirection = document.getElementById('ql-direction');
if (LANG_DIR === 'rtl') {
  qlDirection.innerHTML = '<button class="ql-direction" value="rtl"></button>';
}

const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: browser.i18n.getMessage('emptyPlaceHolder'),
  modules: {
    keyboard: {
      bindings: bindings
    },
    toolbar: '#toolbar'
  },
  formats: formats // enabled formats, see https://github.com/quilljs/quill/issues/1108
});

function isWhitespace(ch) {
  let whiteSpace = false;
  if ((ch === ' ') || (ch === '\t') || (ch === '\n')) {
    whiteSpace = true;
  }
  return whiteSpace;
}

// recognizes typed urls and create links from those urls
quill.on('text-change', function(delta) {
  const regex = /https?:\/\/[^\s]+$/;
  if (delta.ops.length === 2 && delta.ops[0].retain ) {
    let endRetain = delta.ops[0].retain;
    if (delta.ops[1].hasOwnProperty('insert')) {
      endRetain += 1;
    }
    const text = quill.getText().substr(0, endRetain);
    const match = text.match(regex);

    if (match !== null) {
      const url = match[0];

      let ops = [];
      if (endRetain > url.length) {
        ops.push({ retain: endRetain - url.length });
      }

      ops = ops.concat([
        { delete: url.length },
        { insert: url, attributes: { link: url } }
      ]);

      quill.updateContents({
        ops: ops
      });
    }
  }
});

// recognizes pasted urls and create links from those urls
quill.clipboard.addMatcher(Node.TEXT_NODE, function(node, delta) {
  const regex = /https?:\/\/[^\s]+/;
  if (typeof(node.data) !== 'string')
    return;
  const matches = node.data.match(regex);

  if (matches && matches.length > 0) {
    const ops = [];
    let str = node.data;

    matches.forEach(function(match) {
      const split = str.split(match);
      const beforeLink = split.shift();
      ops.push({ insert: beforeLink });
      ops.push({ insert: match, attributes: { link: match } });
      str = split.join(match);
    });

    ops.push({ insert: str });
    delta.ops = ops;
  }

  return delta;
});

// adds an eventListener to every <a> element which opens their respective
// href link in a new tab when clicked
document.querySelector('#editor').addEventListener('click', function(e) {
  const anchor = e.target;
  if (anchor !== null && anchor.tagName === 'A') {
    browser.runtime.sendMessage({
      action: 'link-clicked',
      context: getPadStats()
    });
    browser.tabs.create({
      active: true,
      url: anchor.href
    });
  }
});

// makes getting out of link-editing format easier by escaping whitespace characters
quill.on('text-change', function(delta) {
  if (delta.ops.length === 2 && 'insert' in delta.ops[1] && 
      isWhitespace(delta.ops[1].insert)) {
    const format = quill.getFormat(delta.ops[0].retain, 1);
    if ('link' in format)
      quill.formatText(delta.ops[0].retain, 1, 'link', false);
  } else
    return;
});

let userOSKey;

if (navigator.appVersion.indexOf('Mac') !== -1)
  userOSKey = '⌘';
else
  userOSKey = 'Ctrl';

const size = document.getElementsByClassName('ql-size')[0],
      bold = document.getElementsByClassName('ql-bold')[0],
      italic = document.getElementsByClassName('ql-italic')[0],
      underline=document.getElementsByClassName('ql-underline')[0],
      strike = document.getElementsByClassName('ql-strike')[0],
      ordered = document.getElementsByClassName('ql-list')[0],
      bullet = document.getElementsByClassName('ql-list')[1];

// Setting button titles in place of tooltips
size.title = browser.i18n.getMessage('fontSizeTitle');
bold.title = browser.i18n.getMessage('boldTitle') + ' (' + userOSKey + '+B)';
italic.title = browser.i18n.getMessage('italicTitle') + ' (' + userOSKey + '+I)';
underline.title=browser.i18n.getMessage('underlineTitle')+'('+userOSKey+'+U)';
strike.title = browser.i18n.getMessage('strikethroughTitle') + ' (' + userOSKey + '+Shift+' + bindings.strike.key + ')';
ordered.title = browser.i18n.getMessage('numberedListTitle') + ' (' + userOSKey + '+Shift+' + bindings.ordered.key + ')';
bullet.title = browser.i18n.getMessage('bulletedListTitle') + ' (' + userOSKey + '+Shift+' + bindings.bullet.key + ')';
qlDirection.title = browser.i18n.getMessage('textDirectionTitle');

function handleLocalContent(data) {
  if (!data.hasOwnProperty('notes')) {
    quill.setContents({
      ops: [
        { attributes: { size: 'large', bold: true }, insert: browser.i18n.getMessage('welcomeTitle2') },
        { insert: '\n\n', attributes: { direction: LANG_DIR, align: TEXT_ALIGN_DIR }},
        {
          attributes: { size: 'large' },
          insert:
            browser.i18n.getMessage('welcomeText2')
        },
        { insert: '\n\n', attributes: { direction: LANG_DIR, align: TEXT_ALIGN_DIR }}
      ]
    });
  } else {
    if (JSON.stringify(quill.getContents()) !== JSON.stringify(data.notes)) {
      quill.setContents(data.notes);
    }
  }
}

function loadContent() {
  return new Promise((resolve) => {
    browser.storage.local.get(['notes'], data => {
      // If we have a bearer, we try to save the content.
      handleLocalContent(data);
      resolve();
    });
  });
}

loadContent()
  .then(() => {
    document.getElementById('loading').style.display = 'none';
  });

let ignoreNextLoadEvent = false;
quill.on('text-change', () => {
  const content = quill.getContents();
  browser.storage.local.set({ notes: content }).then(() => {
    // Notify other sidebars
    if (!ignoreNextLoadEvent) {
      chrome.runtime.sendMessage('notes@mozilla.com', {
        action: 'text-change'
      });

      updateSavingIndicator();
      // Debounce this second event
      chrome.runtime.sendMessage({
        action: 'metrics-changed',
        context: getPadStats()
      });
    } else {
      ignoreNextLoadEvent = false;
    }
  });
});

const savingIndicator = document.getElementById('saving-indicator');
const enableSync = document.getElementById('enable-sync');
const giveFeedback = document.getElementById('give-feedback');
const noteDiv = document.getElementById('sync-note');
const syncNoteBody = document.getElementById('sync-note-dialog');
const closeButton = document.getElementById('close-button');
savingIndicator.textContent = browser.i18n.getMessage('changesSaved');
enableSync.setAttribute('title', browser.i18n.getMessage('syncNotes'));
syncNoteBody.textContent = browser.i18n.getMessage('syncNotReady2');
giveFeedback.setAttribute('title', browser.i18n.getMessage('giveFeedback'));
giveFeedback.setAttribute('href', SURVEY_PATH);


let savingIndicatorTimeout;
function updateSavingIndicator() {
  savingIndicator.textContent = browser.i18n.getMessage('savingChanges');
  const later = function() {
    savingIndicatorTimeout = null;
    savingIndicator.textContent = browser.i18n.getMessage('changesSaved');
  };
  clearTimeout(savingIndicatorTimeout);
  savingIndicatorTimeout = setTimeout(later, 300);
}


closeButton.addEventListener('click', () => {
  noteDiv.classList.toggle('visible');
});

enableSync.onclick = () => {
  noteDiv.classList.toggle('visible');
  browser.runtime.sendMessage({
    action: 'authenticate',
    context: getPadStats()
  });
};

// gets the user-selected theme from local storage and applies respective CSS
// file to the document
function getThemeFromStorage() {
  const getting = browser.storage.local.get(['theme']);
  getting.then(function applyTheme(data) {
    if (data.theme === 'dark') {
      if (! document.getElementById('dark-styles')) {
        const darkSS = document.createElement('link');
        darkSS.id = 'dark-styles';
        darkSS.type = 'text/css';
        darkSS.rel = 'stylesheet';
        darkSS.href = 'styles-dark.css';
        document.getElementsByTagName('head')[0].appendChild(darkSS);
      } else
        return;
    } else if (data.theme === 'default' || data.theme === undefined) {
      if (document.getElementById('dark-styles')) {
        const darkSS = document.getElementById('dark-styles');
        darkSS.parentElement.removeChild(darkSS);
      } else
        return;
    }
  });
}
document.addEventListener('DOMContentLoaded', getThemeFromStorage);

chrome.runtime.onMessage.addListener(eventData => {
  switch (eventData.action) {
    case 'text-change':
      ignoreNextLoadEvent = true;
      loadContent();
      break;
    case 'theme-changed':
      getThemeFromStorage();
  }
});

// disable drop of links and images into notes
const qlEditor = document.querySelectorAll('.ql-editor');

document.addEventListener('dragover', () => {
  qlEditor[0].classList.add('forbid-cursor');
  browser.runtime.sendMessage({
    action: 'metrics-drag-n-drop',
    context: getPadStats()
  });
  return true;
});

document.addEventListener('dragleave', () => {
  qlEditor[0].classList.remove('forbid-cursor');
  return true;
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  qlEditor[0].classList.remove('forbid-cursor');
  return false;
});

function getPadStats() {
  const content = quill.getContents();
  const text = quill.getText();
  const styles = {
    size: false,
    bold: false,
    italic: false,
    underline:false,
    strike: false,
    list: false
  };

  content.forEach(node => {
    if (node.hasOwnProperty('attributes')) {
      Object.keys(node.attributes).forEach(key => {
        if (styles.hasOwnProperty(key)) {
          styles[key] = true;
        }
      });
    }
  });

  return {
    syncEnabled: false,
    characters: text.length,
    lineBreaks: (text.match(/\n/g) || []).length,
    usesSize: styles.size,
    usesBold: styles.bold,
    usesItalics: styles.italic,
    usesUnderline:styles.underline,
    usesStrikethrough: styles.strike,
    usesList: styles.list
  };
}

// Create a connection with the background script to handle open and
// close events.
browser.runtime.connect();
