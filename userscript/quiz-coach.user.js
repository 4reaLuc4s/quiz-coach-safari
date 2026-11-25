// ==UserScript==
// @name         Quiz Coach
// @namespace    quiz-coach.local
// @version      1.3.1
// @description  学习辅助：读取网页选择题并给出答案，支持中英文论述题写作。
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// ↓↓↓ 把 apiKey 填上，然后传到 iPad。填这里 = 所有网站通用；留空则只在卡片的设置里逐站填。
window.__QUIZ_COACH_CONFIG__ = {
  apiBase: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',
  model: 'deepseek-chat',
  lang: 'auto',        // 卡片语言：'auto' | 'zh' | 'en'
  answerLang: 'auto',  // 答案语言：'auto' | 'zh' | 'en'
  theme: 'light',      // 'light' | 'dark'
  opacity: 0.74        // 0.3 ~ 1
};


/* =========================================================================
 * Quiz Coach — 网页选择题 / 论述题学习辅助
 * 适用于 Safari 扩展（iPadOS 16.4+ / macOS）与桌面浏览器本地预览
 * 无任何后台服务：所有请求直接从页面发起（实测 DeepSeek/OpenRouter/
 * SiliconFlow/DashScope 均允许浏览器直连）
 * 仅用于自测、练习和对答案；请勿用于考试作弊。
 * ========================================================================= */
(function () {
  'use strict';

  try {
    if (window.__QUIZ_COACH__) return;
    window.__QUIZ_COACH__ = true;
  } catch (e) { return; }

  /* ---------------------------------------------------------------- 环境 */
  const EXT = (typeof browser !== 'undefined' && browser) ||
              (typeof chrome !== 'undefined' && chrome) || null;
  const HAS_EXT = !!(EXT && EXT.runtime && EXT.runtime.id);
  const IS_TOP = (() => { try { return window.top === window.self; } catch (e) { return false; } })();
  const HOST = location.hostname || 'local';
  const VERSION = '1.3.1';

  /* --------------------------------------------------------------- 常量 */
  const BOOT_CFG = (() => {
    try { return window.__QUIZ_COACH_CONFIG__ || {}; } catch (e) { return {}; }
  })();

  const DEFAULT_SETTINGS = Object.assign({
    apiBase: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-chat',
    lang: 'auto',
    answerLang: 'auto',
    theme: 'light',
    opacity: 0.74,
    position: null
  }, BOOT_CFG);

  // "A. xxx" / "A、xxx" / "（A）xxx" / "A．xxx"
  // "A. xxx" / "A、xxx" / "（A）xxx" / "1. xxx" / "1、xxx" / "①xxx"
  const OPT_RE = /^\s*[（(\[【]?\s*([A-Ha-h]|[1-9]|[①②③④⑤⑥⑦⑧⑨])\s*[)）\]】.、,:：．]\s*([^\s][\s\S]*)$/;
  const CIRCLE_RE = /^\s*([①②③④⑤⑥⑦⑧⑨])\s*([^\s][\s\S]*)$/;

  /* --------------------------------------------------------------- 多语言 */
  const I18N = {
    zh: {
      qTitle: (n) => '第 ' + n + ' 题',
      essayTitle: '论述题',
      modeTipC: '当前：选择题模式（点一下切到论述题）',
      modeTipA: '当前：论述题模式（点一下切到选择题）',
      refresh: '刷新',
      close: '关闭',
      apiBase: 'API 地址',
      apiKey: 'API Key',
      model: '模型',
      language: '语言',
      langAuto: '自动（跟随浏览器）',
      langZh: '中文',
      langEn: 'English',
      settings: '设置',
      theme: '卡片主题',
      themeLight: '白色',
      themeDark: '黑色',
      opacity: '透明度',
      answerLang: '答案语言',
      answerLangAuto: '自动（默认）',
      answerHint: '自动：C 模式解析跟随界面语言；A 模式论述题默认英文。',
      keyNote: 'Key 只存在这台设备的本地存储里。',
      calibrateSite: '标定这个网站的题目位置',
      cancel: '取消',
      save: '保存',
      calStep0: '① 点一下页面上的「题干」',
      calStep1: '② 点一下包住「所有选项」的容器',
      calNote: '标定一次，这个网站以后都能自动识别。',
      calNote2: '如果点错了，点下面的「重来」。',
      restart: '重来',
      cancelCal: '取消标定',
      pasteQ: '① 粘贴题目（长按输入框 → 粘贴）',
      pasteO: '② 粘贴选项（A/B/C/D 或 1/2/3/4 都行）',
      pasteQPH: '第 1 题 …',
      pasteOPH: 'A. …&#10;B. …&#10;C. …&#10;D. …',
      pasteOne: '一键粘贴',
      next: '下一步',
      answer: '出答案',
      back: '上一步',
      reextract: '重新提取',
      readClipboard: '读剪贴板',
      calibrate: '标定',
      noQuestionLong: '还没抓到题目。可以：① 长按选中题干和选项并复制，回来点「读剪贴板」；② 长按标题 0.7 秒进设置，点「标定」；③ 如果题目在 iframe 里，刷新页面。',
      essayDetected: '这是论述 / 简答题。点标题栏的 A 切到论述题模式，粘贴题目就能写答案。',
      noQuestion: '还没抓到题目。',
      selectionNoOptions: '选中的文字里没找到至少两个选项（A. B. C. D. 这种）。',
      calFailed: '标定失败：按你点的位置读不到题干或至少两个选项。重试一次，第二步尽量点「包住所有选项」的那个外框。',
      configNote: '长按卡片顶部标题 0.7 秒，打开设置填 API 地址 / Key / 模型。',
      retry: '重试',
      noDataHint: '还没抓到题目。<br>先点「重新提取」；如果这个网站结构特殊，用「手动标定」点两下就好。',
      manualCal: '手动标定',
      autoTag: '自动识别',
      selectionTag: '来自选区',
      uncertain: '不确定',
      wrongCal: '认错了？标定',
      paste: '粘贴',
      getting: '正在取答案…',
      writing: '正在写答案…',
      generatedWith: (size) => size ? '答案已生成 · 约 ' + size : '答案已生成',
      copyHint: '点「复制」直接拿走',
      newQuestion: '换一题',
      rewrite: '重写',
      copy: '复制',
      copied: '已复制',
      copyFailed: '复制失败',
      essayMode: '论述题模式',
      essayPH: '把论述题贴在这里…',
      generate: '生成答案',
      pasteFirst: '先把题目粘进来。',
      noKey: '还没配置 API Key。长按卡片顶部 0.7 秒，打开设置填上。',
      answerFailed: (e) => '取答案失败：' + e,
      genFailed: (e) => '生成失败：' + e,
      genFailedShort: '生成失败',
      clipboardBlocked: '浏览器不让直接读剪贴板：长按输入框 → 选「粘贴」。',
      clipboardFilled: '题目已填入。复制好选项后点「下一步」。',
      optionsEmpty: '选项还没粘进来。',
      stillQuestion: '剪贴板里还是题目。先去复制 A/B/C/D（或 1/2/3/4）那几行。',
      notOptions: '这不像选项（像是题目段落）。每行一个选项最稳。',
      questionEmpty: '题目还没粘进来。',
      unrecognizedQuestion: '（未识别到题干）',
      chars: ' 字',
      words: ' 词',
      jsonOnly: '只输出 JSON。',
      modelNoJSON: '模型没有返回 JSON',
      invalidAnswer: (a) => '模型返回的 answer 不是选项字母：' + a,
      emptyResponse: '模型返回为空'
    },
    en: {
      qTitle: (n) => 'Question ' + n,
      essayTitle: 'Essay',
      modeTipC: 'Multiple-choice mode (click to switch to essay)',
      modeTipA: 'Essay mode (click to switch to multiple-choice)',
      refresh: 'Refresh',
      close: 'Close',
      apiBase: 'API endpoint',
      apiKey: 'API key',
      model: 'Model',
      language: 'Language',
      langAuto: 'Auto (follow browser)',
      langZh: '中文',
      langEn: 'English',
      settings: 'Settings',
      theme: 'Card theme',
      themeLight: 'White',
      themeDark: 'Black',
      opacity: 'Opacity',
      answerLang: 'Answer language',
      answerLangAuto: 'Auto (default)',
      answerHint: 'Auto: C-mode explanations follow the UI language; A-mode essays default to English.',
      keyNote: "The key is stored only in this device's local storage.",
      calibrateSite: 'Calibrate question position on this site',
      cancel: 'Cancel',
      save: 'Save',
      calStep0: '① Click the question stem on the page',
      calStep1: '② Click the container that holds all options',
      calNote: 'Calibrate once; this site will be recognized automatically from now on.',
      calNote2: 'If you clicked the wrong element, use Restart below.',
      restart: 'Restart',
      cancelCal: 'Cancel calibration',
      pasteQ: '① Paste the question (long-press the box → Paste)',
      pasteO: '② Paste the options (A/B/C/D or 1/2/3/4)',
      pasteQPH: 'Question 1 …',
      pasteOPH: 'A. …&#10;B. …&#10;C. …&#10;D. …',
      pasteOne: 'Paste',
      next: 'Next',
      answer: 'Answer',
      back: 'Back',
      reextract: 'Extract again',
      readClipboard: 'Read clipboard',
      calibrate: 'Calibrate',
      noQuestionLong: 'No question detected. You can: (1) select the question and options, copy them, then click "Read clipboard"; (2) long-press the title for 0.7 s, open settings, then click "Calibrate"; (3) if the question is inside an iframe, reload the page.',
      essayDetected: 'This looks like an essay / short-answer question. Click A in the card header to switch to essay mode, then paste the prompt.',
      noQuestion: 'No question detected yet.',
      selectionNoOptions: 'Could not find at least two options (A. B. C. D. style) in the selection.',
      calFailed: 'Calibration failed: the selected position does not contain a question and at least two options. Try again; for the second click, pick the container that holds all options.',
      configNote: 'Long-press the card title for 0.7 s to open settings and fill in the API endpoint / key / model.',
      retry: 'Retry',
      noDataHint: 'No question detected yet.<br>Try "Extract again"; if this site has an unusual structure, use "Manual calibration" and click twice.',
      manualCal: 'Manual calibration',
      autoTag: 'Auto-detected',
      selectionTag: 'From selection',
      uncertain: 'Uncertain',
      wrongCal: 'Wrong question? Calibrate',
      paste: 'Paste',
      getting: 'Getting answer…',
      writing: 'Writing answer…',
      generatedWith: (size) => size ? 'Answer ready · about ' + size : 'Answer ready',
      copyHint: 'Tap "Copy" to grab it',
      newQuestion: 'New question',
      rewrite: 'Rewrite',
      copy: 'Copy',
      copied: 'Copied',
      copyFailed: 'Copy failed',
      essayMode: 'Essay mode',
      essayPH: 'Paste the essay prompt here…',
      generate: 'Generate answer',
      pasteFirst: 'Paste the prompt first.',
      noKey: 'No API key configured. Long-press the card title for 0.7 s to open settings.',
      answerFailed: (e) => 'Failed to get answer: ' + e,
      genFailed: (e) => 'Generation failed: ' + e,
      genFailedShort: 'Generation failed',
      clipboardBlocked: 'The browser blocked clipboard access: long-press the input box and choose "Paste".',
      clipboardFilled: 'Question pasted. Copy the options, then click Next.',
      optionsEmpty: 'The options are still empty.',
      stillQuestion: 'The clipboard still contains the question. Copy the A/B/C/D (or 1/2/3/4) lines first.',
      notOptions: 'This does not look like options (it looks like a question paragraph). One option per line works best.',
      questionEmpty: 'The question is still empty.',
      unrecognizedQuestion: '(question not detected)',
      chars: ' chars',
      words: ' words',
      jsonOnly: 'Output JSON only.',
      modelNoJSON: 'The model did not return JSON',
      invalidAnswer: (a) => 'The model returned an invalid answer letter: ' + a,
      emptyResponse: 'The model returned an empty response'
    }
  };

  function detectLang(pref) {
    if (pref === 'zh' || pref === 'en') return pref;
    const nav = String(navigator.language || 'en').toLowerCase();
    return nav.indexOf('zh') === 0 ? 'zh' : 'en';
  }

  let LANG = detectLang('auto');

  function t(key) {
    const args = Array.prototype.slice.call(arguments, 1);
    const table = (I18N[LANG] && Object.prototype.hasOwnProperty.call(I18N[LANG], key)) ? I18N[LANG] : I18N.zh;
    const v = table[key];
    return typeof v === 'function' ? v.apply(null, args) : (v == null ? key : v);
  }



  /* --------------------------------------------------------------- 存储 */
  const Storage = {
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      if (HAS_EXT) return await EXT.storage.local.get(list);
      const out = {};
      for (const k of list) {
        let raw = null;
        try { raw = localStorage.getItem('qc:' + k); } catch (e) {}
        out[k] = raw ? safeParse(raw) : undefined;
      }
      return out;
    },
    async set(obj) {
      if (HAS_EXT) return await EXT.storage.local.set(obj);
      for (const k of Object.keys(obj)) {
        try { localStorage.setItem('qc:' + k, JSON.stringify(obj[k])); } catch (e) {}
      }
    }
  };

  function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  /* --------------------------------------------------------------- 工具 */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
    return true;
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) {
      const s = '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id);
      if (document.querySelectorAll(s).length === 1) return s;
    }
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && parts.length < 6) {
      let s = n.tagName.toLowerCase();
      if (n.classList && n.classList.length) {
        s += '.' + Array.prototype.slice.call(n.classList, 0, 2)
          .map((c) => (window.CSS && CSS.escape ? CSS.escape(c) : c)).join('.');
      }
      const p = n.parentElement;
      if (p) {
        const sibs = Array.prototype.filter.call(p.children, (c) => c.tagName === n.tagName);
        if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(n) + 1) + ')';
      }
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(' > ');
  }

  /* ----------------------------------------------------------- 题目提取 */
  function matchOption(raw) {
    const t = String(raw == null ? '' : raw).replace(/[\u200b-\u200f\ufeff]/g, '').trim();
    if (!t || t.length > 300) return null;
    let m = t.match(OPT_RE);
    if (!m) m = t.match(CIRCLE_RE);
    if (!m) return null;
    const text = m[2].trim();
    if (!text) return null;
    return { label: m[1], text: text };
  }

  // 统一编号成 A/B/C/D（模型只认字母），原始标号存在 label 里用于显示
  function finalizeOptions(list) {
    const out = [];
    const seen = {};
    for (const o of list) {
      if (!o) continue;
      const t = String(o.text || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const d = t.slice(0, 40);
      if (seen[d]) continue;
      seen[d] = true;
      out.push({ label: String(o.label || (out.length + 1)), text: t });
      if (out.length >= 8) break;
    }
    if (out.length < 2) return [];
    return out.map((o, i) => ({
      key: String.fromCharCode(65 + i),
      label: o.label,
      text: o.text
    }));
  }

  function optionTextNear(el) {
    const lab = el.closest ? el.closest('label') : null;
    if (lab) {
      const t = (lab.innerText || lab.textContent || '').trim();
      if (t) return t;
    }
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++) {
      const t = (p.innerText || '').trim();
      if (t && t.length < 150) return t;
      p = p.parentElement;
    }
    return '';
  }

  // 空白圆钮：从 input[type=radio|checkbox] 反推选项
  function optionsFromInputs(scope) {
    const root = (scope && scope.querySelectorAll) ? scope : document;
    let inputs = [];
    try {
      inputs = Array.prototype.slice.call(root.querySelectorAll('input[type=radio],input[type=checkbox]'));
    } catch (e) { return []; }
    if (inputs.length < 2) return [];

    const groups = new Map();
    for (const el of inputs) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) continue;
      const k = el.name || '_anon';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(el);
    }

    let best = null;
    groups.forEach((arr) => {
      if (arr.length < 2 || arr.length > 10) return;
      const items = arr.map((el) => optionTextNear(el)).filter((t) => t && t.length);
      if (items.length >= 2 && (!best || items.length > best.items.length)) {
        best = { arr: arr, items: items };
      }
    });
    if (!best) return [];

    const opts = best.arr.map((el, i) => {
      const raw = optionTextNear(el);
      const m = matchOption(raw);
      if (m) return m;
      return raw ? { label: String(i + 1), text: raw } : null;
    }).filter(Boolean);

    return finalizeOptions(opts);
  }

  function optionsIn(container) {
    if (!container) return [];
    let all = [];
    try {
      all = Array.prototype.slice.call(container.querySelectorAll('*'), 0, 500);
    } catch (e) { all = []; }

    // 1) 整行带标号
    const matched = all.filter((el) => !!matchOption(el.textContent));
    const inner = matched.filter((el) => !matched.some((o) => o !== el && el.contains(o)));
    const opts = inner.map((el) => matchOption(el.textContent)).filter(Boolean);
    const fromText = finalizeOptions(opts);
    if (fromText.length >= 2) return fromText;

    // 2) 结构行（标号是独立元素 / 表格）
    const rows = [];
    for (const el of all) {
      if (el.childElementCount > 5) continue;
      const r = splitOption(el);
      if (r && r.text) rows.push({ el: el, label: r.label, text: r.text });
    }
    const groups = groupRows(rows);
    let best = null;
    for (const g of groups) {
      if (!best || g.options.length > best.options.length) best = g;
    }
    if (best && best.options.length >= 2) return best.options;

    // 3) 空白单选/多选
    return optionsFromInputs(container);
  }

  function findNumber(text) {
    const t = String(text || '');
    let m = t.match(/第\s*(\d{1,3})\s*[题小]/);
    if (m) return m[1];
    m = t.match(/(?:question|problem|q)\s*(\d{1,3})\b/i);
    if (m) return m[1];
    m = t.match(/^\s*(\d{1,3})\s*[.、．]/);
    if (m) return m[1];
    return '';
  }

  function extractFromCalibration(sel) {
    if (!sel || !sel.q || !sel.opt) return null;
    let qEl = null, oEl = null;
    try { qEl = document.querySelector(sel.q); } catch (e) { return null; }
    try { oEl = document.querySelector(sel.opt); } catch (e) { return null; }
    if (!qEl || !oEl) return null;
    const text = (qEl.innerText || '').trim();
    const options = optionsIn(oEl);
    if (!text || options.length < 2) return null;
    return { text: text, options: options, number: findNumber(text), source: 'calibrated' };
  }

  function findOptionLeaves() {
    if (!document.body) return [];
    const all = document.body.querySelectorAll('*');
    const cap = Math.min(all.length, 6000);
    const hits = [];
    for (let i = 0; i < cap; i++) {
      const el = all[i];
      if (hostEl && el === hostEl) continue;
      if (el.childElementCount > 4) continue;
      const t = (el.textContent || '').trim();
      if (t.length < 3 || t.length > 200) continue;
      const m = matchOption(t);
      if (!m) continue;
      hits.push({ key: String(m.label).toUpperCase(), el: el });
      if (hits.length > 200) break;
    }
    return hits;
  }

  function stemFromContainer(container, options) {
    const raw = (container.innerText || '').trim();
    if (!raw) return '';
    const texts = options.map((o) => String(o.text || '').trim()).filter(Boolean);
    const kept = raw.split('\n').filter((line) => {
      const l = line.trim();
      if (!l) return false;
      for (const t of texts) {
        if (l === t) return false;
        // "A传输层" / "A\t传输层" 这种「标号+正文」整行去掉
        if (l.length <= t.length + 3 && l.slice(-t.length) === t) return false;
        const m = matchOption(l);
        if (m && m.text === t) return false;
      }
      return true;
    });
    return kept.join('\n').trim();
  }

  function stemFromPrev(p) {
    let cur = p;
    for (let hop = 0; hop < 4 && cur; hop++) {
      let sib = cur.previousElementSibling;
      for (let i = 0; i < 3 && sib; i++) {
        const t = (sib.innerText || '').trim();
        if (t.length >= 6 && t.length < 1500 && !OPT_RE.test(t.slice(0, 50))) return t;
        sib = sib.previousElementSibling;
      }
      cur = cur.parentElement;
      if (!cur || cur === document.body) break;
    }
    return '';
  }

  // ---- 行结构识别：<span>A</span><span>选项</span> / 表格 / 空白圆钮 ----
  function splitOption(el) {
    if (!el || el.nodeType !== 1) return null;
    const raw = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 300) return null;

    // 1) 整行自带标号："A. xxx" / "1、xxx" / "① xxx"
    const m = matchOption(raw);
    if (m) return m;

    // 2) 第一个子元素是一个极短的标号（A / 1 / ①），正文在别处
    const kids = el.children;
    for (let i = 0; i < kids.length && i < 3; i++) {
      const kt = String(kids[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!kt || kt.length > 2) continue;
      if (!/^[（(\[]?\s*[A-Ha-h1-9①-⑨]\s*[)）\]]?\s*[.、,:：．]?$/.test(kt)) continue;
      const label = kt.replace(/[^A-Ha-h1-9①-⑨]/g, '');
      if (!label) continue;
      const rest = raw.replace(kt, '').trim();
      if (!rest) continue;
      return { label: label, text: rest };
    }

    // 3) 里面有单选/多选控件，但没有可见标号
    if (el.querySelector && el.querySelector('input[type=radio],input[type=checkbox]')) {
      return { label: '', text: raw };
    }
    return null;
  }

  function groupRows(rows) {
    if (!rows.length) return [];
    // 去掉「祖先也是行」的，只留最内层
    const keep = rows.filter((r) => !rows.some((o) => o !== r && r.el.contains(o.el)));
    const groups = new Map();
    for (const r of keep) {
      const p = r.el.parentElement;
      if (!p) continue;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(r);
    }
    const out = [];
    groups.forEach((arr, p) => {
      const opts = finalizeOptions(arr.map((a) => ({ label: a.label, text: a.text })));
      if (opts.length >= 2) {
        out.push({ parent: p, options: opts });
      }
    });
    return out;
  }

  // 页面上所有「像一道选择题」的候选，按文档顺序排好
  function collectCandidates() {
    const found = [];          // { parent, options }
    const seenParent = new Set();

    const addGroup = (parent, options) => {
      if (!parent || !options || options.length < 2) return;
      if (seenParent.has(parent)) return;
      seenParent.add(parent);
      found.push({ parent: parent, options: options });
    };

    // A. 文本命中（快，覆盖大多数题库）
    const hits = findOptionLeaves();
    if (hits.length >= 2) {
      const map = new Map();
      for (const h of hits) {
        const p = h.el.parentElement;
        if (!p) continue;
        if (!map.has(p)) map.set(p, []);
        map.get(p).push(h);
      }
      map.forEach((arr, p) => {
        const labels = {};
        arr.forEach((a) => { labels[a.key] = true; });
        if (Object.keys(labels).length < 2) return;
        addGroup(p, optionsIn(p));
      });
    }

    // B. 结构行（标号单独成一个元素 / 表格 / 空白圆钮）
    if (found.length < 4 && document.body) {
      const all = document.body.querySelectorAll('*');
      const cap = Math.min(all.length, 4000);
      const rows = [];
      for (let i = 0; i < cap; i++) {
        const el = all[i];
        if (hostEl && el === hostEl) continue;
        if (el.childElementCount > 5) continue;
        const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 300) continue;
        const r = splitOption(el);
        if (!r || !r.text) continue;
        rows.push({ el: el, label: r.label, text: r.text });
        if (rows.length > 500) break;
      }
      groupRows(rows).forEach((g) => addGroup(g.parent, g.options));
    }

    // C. 组装候选
    const out = [];
    const seen = {};
    for (const g of found) {
      const p = g.parent;
      if (!p || !isVisible(p)) continue;

      let stem = stemFromContainer(p, g.options);
      if (stem.length < 6) stem = stemFromPrev(p);
      if (!stem || stem.length < 6) continue;
      if (stem.length > 1500) stem = stem.slice(0, 1500) + '…';

      const dedupe = stem.slice(0, 80) + '|' + g.options.map((o) => o.text.slice(0, 12)).join('');
      if (seen[dedupe]) continue;
      seen[dedupe] = true;

      out.push({
        text: stem,
        options: g.options,
        number: findNumber(stem),
        source: 'auto',
        y: p.getBoundingClientRect().top + window.pageYOffset
      });
    }
    out.sort((a, b) => a.y - b.y);
    return out;
  }

  let CAND = [];
  let CAND_IDX = 0;

  function extractFromInputs() {
    const opts = optionsFromInputs(document);
    if (opts.length < 2) return null;

    const first = document.querySelector('input[type=radio],input[type=checkbox]');
    let container = null;
    if (first) container = first.closest('ul,ol,fieldset,form') || first.parentElement;

    let stem = '';
    if (container) {
      stem = stemFromPrev(container);
      if (stem.length < 6) stem = stemFromContainer(container, opts);
    }
    if (!stem || stem.length < 6) return null;
    if (stem.length > 1500) stem = stem.slice(0, 1500) + '…';

    const rect = (container || document.body).getBoundingClientRect();
    return {
      text: stem,
      options: opts,
      number: findNumber(stem),
      source: 'auto',
      y: rect.top + window.pageYOffset
    };
  }

  function extractHeuristic() {
    CAND = collectCandidates();
    if (!CAND.length) {
      const r = extractFromInputs();
      if (r) { CAND = [r]; CAND_IDX = 0; return r; }
      return null;
    }
    if (CAND_IDX >= CAND.length) CAND_IDX = 0;
    // 默认选「视口里最靠上的那道」——人是从上往下读的
    let chosen = -1;
    for (let i = 0; i < CAND.length; i++) {
      const rel = CAND[i].y - window.pageYOffset;
      if (rel > -80) { chosen = i; break; }
    }
    if (chosen < 0) chosen = CAND.length - 1;
    CAND_IDX = chosen;
    const c = CAND[CAND_IDX];
    return { text: c.text, options: c.options, number: c.number, source: 'auto' };
  }

  function nextCandidate() {
    CAND = collectCandidates();
    if (CAND.length < 2) return null;
    CAND_IDX = (CAND_IDX + 1) % CAND.length;
    const c = CAND[CAND_IDX];
    return { text: c.text, options: c.options, number: c.number, source: 'auto' };
  }

  // 解析「粘贴的选项」：A/B/C/D、1/2/3/4、①②③④ 都行（label 可能为空）
  function parseOptionsRaw(raw) {
    let t = String(raw || '').trim();
    if (!t) return [];
    // 单行里塞了多个选项：在标号前切开
    t = t.replace(/\s+(?=[（(]?\s*(?:[A-Da-d]|[1-4]|[①②③④])\s*[)）.、,:：．])/g, '\n');
    const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const items = [];
    for (const line of lines) {
      const m = matchOption(line);
      if (m) items.push(m);
      else items.push({ label: '', text: line });
    }
    return items;
  }

  // 这段文字像不像「选项」，而不是题目段落
  function optionsLookValid(items) {
    if (!items || items.length < 2 || items.length > 10) return false;
    const withLabel = items.filter((o) => o.label).length;
    if (withLabel >= Math.max(2, Math.ceil(items.length * 0.6))) return true;
    return items.every((o) => o.text.length <= 40);
  }

  function parseOptionsText(raw) {
    return finalizeOptions(parseOptionsRaw(raw));
  }

  function parseFromSelection(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    const options = parseOptionsText(text);
    if (options.length < 2) return null;
    let q = text;
    for (const o of options) q = q.replace(o.text, '');
    q = q.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !matchOption(l)).join('\n').trim();
    return { text: q || t('unrecognizedQuestion'), options: options, number: findNumber(q), source: 'selection' };
  }

  function extractQuestion(sel) {
    for (const fn of [
      () => extractFromCalibration(sel),
      () => extractHeuristic(),
      () => parseFromSelection(window.getSelection ? String(window.getSelection()) : '')
    ]) {
      try {
        const r = fn();
        if (r && r.options && r.options.length >= 2) return r;
      } catch (e) { /* 继续下一个策略 */ }
    }
    return null;
  }

  /* ----------------------------------------------------------------- LLM */
  function buildPrompt(q, options) {
    const optText = options.map((o) => o.key + '. ' + o.text).join('\n');
    if (explainLang() === 'en') {
      return [
        'Answer the following multiple-choice question and give a one-line explanation.',
        '',
        '[Question]',
        q,
        '',
        '[Options]',
        optText,
        '',
        'Output only one JSON object, no Markdown fences, no extra text. Fields:',
        '{"answer":"the correct option letter (A/B/C/D as numbered above)",',
        ' "confidence":a number between 0 and 1,',
        ' "explain":"at most 25 words, key point only"}',
        '',
        'Keep the explanation extremely short. Do not repeat the question, do not expand.',
        'If the question is incomplete or ambiguous, set confidence below 0.5 and state what is missing in explain.'
      ].join('\n');
    }
    return [
      '请答出下面这道选择题的正确选项，并给一句讲解。',
      '',
      '【题目】',
      q,
      '',
      '【选项】',
      optText,
      '',
      '只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释性文字。字段：',
      '{"answer":"正确选项的字母（按上面 A/B/C/D 的编号）",',
      ' "confidence":0到1之间的小数,',
      ' "explain":"25 字以内，只说关键点"}',
      '',
      '解释必须极简，不要复述题目，不要展开。',
      '如果题目信息不全或有歧义，confidence 给 0.5 以下，explain 里一句话说明缺什么。'
    ].join('\n');
  }

  function parseModelJSON(text) {
    let s = String(text || '').trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error(t('modelNoJSON'));
    const obj = JSON.parse(s.slice(a, b + 1));
    let answer = String(obj.answer || '').trim().toUpperCase();
    const circ = '①②③④⑤⑥⑦⑧⑨';
    if (circ.indexOf(answer) >= 0) answer = String(circ.indexOf(answer) + 1);
    if (/^[1-9]$/.test(answer)) answer = String.fromCharCode(64 + Number(answer));
    if (!/^[A-H]$/.test(answer)) throw new Error(t('invalidAnswer', answer));
    return {
      answer: answer,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.8,
      explain: String(obj.explain || '').trim()
    };
  }

  async function askModel(settings, q, options) {
    if (!settings.apiKey) throw new Error('NO_KEY');
    const body = {
      model: settings.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: t('jsonOnly') },
        { role: 'user', content: buildPrompt(q, options) }
      ]
    };
    const res = await fetch(settings.apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + '  ' + t.slice(0, 140));
    }
    const json = await res.json();
    const content = (((json.choices || [])[0] || {}).message || {}).content || '';
    if (!content) throw new Error(t('emptyResponse'));
    return parseModelJSON(content);
  }

  /* ------------------------------------------------------------------ UI */
  const S = {
    open: false,
    mode: 'C',         // C = 选择题模式 | A = 论述题模式（只走粘贴）
    phase: 'idle',     // idle | pick | grading | result | calibrate | message | error | essay*
    data: null,
    picked: null,
    result: null,
    msg: '',
    msgKind: 'info',
    clipRaw: '',
    pasteStep: 1,
    qText: '',
    essayQ: '',
    essay: '',
    essayBusy: false,
    prevPhase: null,
    langPref: 'auto',
    settings: Object.assign({}, DEFAULT_SETTINGS),
    sel: null,
    calStep: 0,
    calTmp: {},
    pos: null
  };

  function applyLang(pref) {
    S.langPref = (pref === 'zh' || pref === 'en') ? pref : 'auto';
    LANG = detectLang(S.langPref);
  }

  // 答案语言：auto = C 模式解析跟随界面、A 模式论述默认英文
  function explainLang() {
    const pref = S.settings.answerLang || 'auto';
    if (pref === 'zh' || pref === 'en') return pref;
    return LANG;
  }

  function essayLang() {
    const pref = S.settings.answerLang || 'auto';
    if (pref === 'zh' || pref === 'en') return pref;
    return 'en';
  }

  let hostEl = null, shadow = null, wrapEl = null, clickBound = false;

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .pill {
    position: fixed; width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; padding: 0;
    cursor: pointer; user-select: none;
  }
  .pill .dot { width: 8px; height: 8px; border-radius: 50%; background: #9a9a9a; opacity: .55; }
  .pill:active .dot { opacity: 1; }
  .wrap {
    position: fixed; width: 264px; max-width: calc(100vw - 16px);
    background: rgba(255,255,255,var(--qc-alpha,.74)); color: #777777;
    -webkit-backdrop-filter: blur(10px) saturate(1.05);
    backdrop-filter: blur(10px) saturate(1.05);
    border: 1px solid rgba(0,0,0,.07); border-radius: 10px;
    box-shadow: 0 3px 14px rgba(0,0,0,.07);
    overflow: hidden;
    font: 11px/1.45 -apple-system,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif;
    user-select: none;
  }
  .hgap { flex: 0 0 6px; width: 6px; }
  .hd {
    display: flex; align-items: center; gap: 4px; padding: 4px 6px;
    border-bottom: 1px solid #eeeeee;
    cursor: grab; touch-action: none;
  }
  .hd:active { cursor: grabbing; }
  .hd .t { flex: 1; font-weight: 500; font-size: 9.5px; color: #9a9a9a; }
  .hd .t small { font-weight: 400; color: #9a9a9a; margin-left: 0; font-size: 9.5px; }
  .ico {
    width: 14px; height: 14px; border-radius: 50%; border: 1px solid #e0e0e0;
    background: #ffffff; color: #999999;
    font: 400 9px/1 -apple-system,sans-serif; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    padding: 0; flex: 0 0 14px;
  }
  .ico:active { background: #f0f0f0; }
  .bd { padding: 6px 7px; max-height: 48vh; overflow: auto; }
  .qtext { font-size: 10.5px; line-height: 1.45; white-space: pre-wrap; margin-bottom: 5px;
    color: #777777; max-height: 5.5em; overflow: auto; user-select: text; }
  .opt {
    display: flex; gap: 5px; align-items: flex-start;
    padding: 5px 6px; margin-bottom: 4px; border-radius: 6px;
    background: #ffffff; border: 1px solid #e8e8e8;
    cursor: pointer;
  }
  .opt:active { background: #f6f6f6; }
  .opt .k {
    flex: 0 0 15px; height: 15px; border-radius: 3px;
    background: #f2f2f2; color: #8a8a8a; display: flex; align-items: center;
    justify-content: center; font-weight: 600; font-size: 9.5px;
  }
  .opt .x { flex: 1; font-size: 10.5px; line-height: 1.35; color: #777777; }
  .big { font-size: 10px; font-weight: 400; line-height: 1.35; color: #8a8a8a; }
  .ansx { font-size: 10px; color: #777777; line-height: 1.35; flex: 1; font-weight: 400; }
  .en { font-size: 10px; color: #7a7a7a; line-height: 1.4; margin-bottom: 1px; }
  .zh { font-size: 10px; color: #9a9a9a; line-height: 1.4; }
  .row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .tag { display: inline-block; font-size: 9px; padding: 1px 5px; border-radius: 20px;
    background: #f2f2f2; color: #9a9a9a; margin-left: 4px; }
  .explain { font-size: 9.5px; line-height: 1.45; color: #7f7f7f; white-space: pre-wrap;
    background: rgba(0,0,0,.03); padding: 5px 6px;
    border-radius: 5px; margin-top: 4px; user-select: text; }
  .done { height: 88px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 3px; padding: 0 4px;
    font-size: 10px; line-height: 1.5; color: #8a8a8a; text-align: center;
    overflow: auto; word-break: break-word; }
  .done small { font-size: 9px; color: #a8a8a8; }
  .tip { font-size: 9.5px; color: #9a9a9a; margin-top: 3px; }
  .bar { display: flex; gap: 4px; padding: 5px 6px; border-top: 1px solid #eeeeee; }
  .btn {
    flex: 1; height: 24px; border-radius: 6px; border: 1px solid #e0e0e0;
    background: #ffffff; color: #777777; font: 400 10px/1 -apple-system,sans-serif;
    cursor: pointer; padding: 0 4px;
  }
  .btn:active { background: #f4f4f4; }
  .btn.pri { background: #ffffff; color: #6a6a6a; border-color: #cfcfcf; font-weight: 500; }
  .btn:disabled { opacity: .4; }
  .spin { display: inline-block; width: 9px; height: 9px; border-radius: 50%;
    border: 1.5px solid #e0e0e0; border-top-color: #888888;
    animation: qcspin .7s linear infinite; vertical-align: -1px; margin-right: 4px; }
  @keyframes qcspin { to { transform: rotate(360deg); } }
  .note { font-size: 9.5px; color: #9a9a9a; line-height: 1.5; }
  .mini { display: flex; gap: 12px; margin-top: 5px; font-size: 9px; color: #9a9a9a; }
  .mini span { cursor: pointer; }
  .mini span:active { color: #444444; }
  .calbar { padding: 5px 7px; background: #f7f7f7; color: #8a8a8a;
    font-size: 9.5px; text-align: center; border-bottom: 1px solid #eeeeee; }
  .err { color: #777777; font-size: 9.5px; word-break: break-all; }
  .field { margin-bottom: 5px; }
  .field label { display: block; font-size: 9px; color: #a0a0a0; margin-bottom: 2px; }
  .field input { width: 100%; padding: 4px 5px; border: 1px solid #e2e2e2; border-radius: 4px;
    font: 10px/1.35 -apple-system,"SF Pro Text",monospace; color: #777777; background: #ffffff;
    -webkit-appearance: none; }
  .field input:focus { outline: none; border-color: #999999; }
  .field select { width: 100%; padding: 4px 5px; border: 1px solid #e2e2e2; border-radius: 4px;
    font: 10px/1.35 -apple-system,"SF Pro Text",sans-serif; color: #777777; background: #ffffff; }
  .field select:focus { outline: none; border-color: #999999; }
  #qc-paste, #qc-essay { display: block; width: 100%; margin-top: 4px; padding: 5px; border: 1px solid #e2e2e2;
    border-radius: 5px; font: 10px/1.45 -apple-system,"SF Pro Text",sans-serif; color: #777777;
    background: #ffffff; resize: none; -webkit-appearance: none; }
  #qc-paste:focus, #qc-essay:focus { outline: none; border-color: #999999; }
  .ico.gear { font-size: 10px; }
  .field input[type=range] { padding: 0; border: 0; background: transparent;
    accent-color: #888888; height: 16px; }
  .wrap.dark {
    background: rgba(28,28,30,var(--qc-alpha,.74)); color: #d2d2d2;
    border-color: rgba(255,255,255,.08); box-shadow: 0 3px 18px rgba(0,0,0,.35);
  }
  .wrap.dark .hd { border-bottom-color: rgba(255,255,255,.08); }
  .wrap.dark .hd .t, .wrap.dark .hd .t small { color: #a8a8a8; }
  .wrap.dark .ico { background: transparent; border-color: rgba(255,255,255,.18); color: #d0d0d0; }
  .wrap.dark .ico:active { background: rgba(255,255,255,.08); }
  .wrap.dark .qtext, .wrap.dark .opt .x, .wrap.dark .ansx,
  .wrap.dark .big, .wrap.dark .en, .wrap.dark .zh { color: #d0d0d0; }
  .wrap.dark .opt { background: transparent; border-color: rgba(255,255,255,.14); }
  .wrap.dark .opt:active { background: rgba(255,255,255,.06); }
  .wrap.dark .opt .k { background: transparent; border: 1px solid rgba(255,255,255,.16); color: #c8c8c8; }
  .wrap.dark .tag { background: transparent; border: 1px solid rgba(255,255,255,.16); color: #c8c8c8; }
  .wrap.dark .explain { background: transparent; border: 1px solid rgba(255,255,255,.12); color: #c8c8c8; }
  .wrap.dark .bar { border-top-color: rgba(255,255,255,.1); }
  .wrap.dark .btn { background: transparent; border-color: rgba(255,255,255,.18); color: #d0d0d0; }
  .wrap.dark .btn:active { background: rgba(255,255,255,.08); }
  .wrap.dark .btn.pri { border-color: rgba(255,255,255,.4); color: #f0f0f0; }
  .wrap.dark .note, .wrap.dark .tip, .wrap.dark .mini, .wrap.dark .err { color: #b0b0b0; }
  .wrap.dark .calbar { background: transparent; color: #b8b8b8; border-bottom-color: rgba(255,255,255,.1); }
  .wrap.dark .field label { color: #b5b5b5; }
  .wrap.dark .field input, .wrap.dark .field select,
  .wrap.dark #qc-paste, .wrap.dark #qc-essay {
    background: transparent; border-color: rgba(255,255,255,.18); color: #e0e0e0;
  }
  .wrap.dark .field input:focus, .wrap.dark .field select:focus,
  .wrap.dark #qc-paste:focus, .wrap.dark #qc-essay:focus { border-color: rgba(255,255,255,.3); }
  .wrap.dark .field input[type=range] { accent-color: #bbbbbb; }
  .wrap.dark .done { color: #c8c8c8; }
  .wrap.dark .done small { color: #9a9a9a; }
  .wrap.dark .spin { border-color: rgba(255,255,255,.15); border-top-color: #bbbbbb; }
  .wrap.dark #qc-paste::placeholder, .wrap.dark #qc-essay::placeholder { color: #888888; }
  `;

  function ensureHost() {
    if (hostEl && hostEl.isConnected) return;
    hostEl = document.createElement('div');
    hostEl.id = '__quiz_coach__';
    hostEl.style.cssText = 'all:initial;position:fixed;z-index:2147483646;top:0;left:0;width:0;height:0;';
    shadow = hostEl.attachShadow({ mode: 'open' });
    (document.body || document.documentElement).appendChild(hostEl);
  }

  function clampPos(p) {
    const w = 264, h = 250;
    const maxL = Math.max(8, window.innerWidth - w - 8);
    const maxT = Math.max(8, window.innerHeight - h);
    return {
      left: Math.min(Math.max(8, p.left), maxL),
      top: Math.min(Math.max(8, p.top), maxT)
    };
  }

  function defaultPos() {
    return { left: Math.max(8, window.innerWidth - 264 - 12), top: 12 };
  }

  function pos() {
    if (!S.pos) S.pos = defaultPos();
    return clampPos(S.pos);
  }

  function render() {
    ensureHost();
    const p = pos();
    const posStyle = 'left:' + p.left + 'px;top:' + p.top + 'px;';

    if (!S.open) {
      const pp = { left: Math.max(8, window.innerWidth - 40), top: 8 };
      shadow.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="pill" data-act="open" style="left:' + pp.left + 'px;top:' + pp.top + 'px;">' +
        '<span class="dot"></span></div>';
      bind();
      return;
    }

    shadow.innerHTML =
      '<style>' + CSS + '</style>' +
      '<div class="wrap' + (S.settings.theme === 'dark' ? ' dark' : '') + '" style="' + posStyle +
      '--qc-alpha:' + Math.min(1, Math.max(0.1, Number(S.settings.opacity) || 0.74)) + ';">' +
      header() + body() + footer() +
      '</div>';
    bind();
  }

  function header() {
    const n = S.data && S.data.number ? t('qTitle', esc(S.data.number)) : '';
    const title = S.mode === 'A' ? '<small>' + esc(t('essayTitle')) + '</small>' : '<small>' + n + '</small>';
    const modeTip = S.mode === 'A' ? t('modeTipA') : t('modeTipC');
    return '<div class="hd" data-drag="1">' +
      '<div class="t" id="qc-title">' + title + '</div>' +
      '<button class="ico gear" data-act="settings" title="' + esc(t('settings')) + '">&#x2699;&#xFE0E;</button>' +
      '<span class="hgap"></span>' +
      '<button class="ico" data-act="toggle-mode" title="' + esc(modeTip) + '">' +
      (S.mode === 'A' ? 'A' : 'C') + '</button>' +
      '<button class="ico" data-act="refresh" title="' + esc(t('refresh')) + '">&#x21bb;</button>' +
      '<button class="ico" data-act="close" title="' + esc(t('close')) + '">&#x2715;</button>' +
      '</div>';
  }

  function body() {
    if (S.mode === 'A' && String(S.phase).indexOf('essay') === 0) return essayBody();

    if (S.phase === 'settings') {
      const st = S.settings || {};
      const langPref = S.langPref || 'auto';
      const theme = st.theme === 'dark' ? 'dark' : 'light';
      const alpha = Math.min(1, Math.max(0.1, Number(st.opacity) || 0.74));
      const answerPref = st.answerLang || 'auto';
      return '<div class="bd">' +
        '<div class="field"><label>' + esc(t('language')) + '</label>' +
        '<select id="qc-lang">' +
        '<option value="auto"' + (langPref === 'auto' ? ' selected' : '') + '>' + esc(t('langAuto')) + '</option>' +
        '<option value="zh"' + (langPref === 'zh' ? ' selected' : '') + '>' + esc(t('langZh')) + '</option>' +
        '<option value="en"' + (langPref === 'en' ? ' selected' : '') + '>' + esc(t('langEn')) + '</option>' +
        '</select></div>' +
        '<div class="field"><label>' + esc(t('answerLang')) + '</label>' +
        '<select id="qc-answer-lang">' +
        '<option value="auto"' + (answerPref === 'auto' ? ' selected' : '') + '>' + esc(t('answerLangAuto')) + '</option>' +
        '<option value="zh"' + (answerPref === 'zh' ? ' selected' : '') + '>' + esc(t('langZh')) + '</option>' +
        '<option value="en"' + (answerPref === 'en' ? ' selected' : '') + '>' + esc(t('langEn')) + '</option>' +
        '</select>' +
        '<div class="note" style="margin-top:3px">' + esc(t('answerHint')) + '</div></div>' +
        '<div class="field"><label>' + esc(t('theme')) + '</label>' +
        '<select id="qc-theme">' +
        '<option value="light"' + (theme === 'light' ? ' selected' : '') + '>' + esc(t('themeLight')) + '</option>' +
        '<option value="dark"' + (theme === 'dark' ? ' selected' : '') + '>' + esc(t('themeDark')) + '</option>' +
        '</select></div>' +
        '<div class="field"><label>' + esc(t('opacity')) +
        ' <span id="qc-opacity-val" style="float:right;font-weight:400">' +
        Math.round(alpha * 100) + '%</span></label>' +
        '<input id="qc-opacity" type="range" min="10" max="100" step="1" value="' + Math.round(alpha * 100) + '"></div>' +
        '<div class="field"><label>' + esc(t('apiBase')) + '</label>' +
        '<input id="qc-api-base" type="text" spellcheck="false" value="' + esc(st.apiBase || '') + '" placeholder="https://api.deepseek.com/v1/chat/completions"></div>' +
        '<div class="field"><label>' + esc(t('apiKey')) + '</label>' +
        '<input id="qc-api-key" type="password" spellcheck="false" value="' + esc(st.apiKey || '') + '" placeholder="sk-..."></div>' +
        '<div class="field"><label>' + esc(t('model')) + '</label>' +
        '<input id="qc-model" type="text" spellcheck="false" value="' + esc(st.model || '') + '" placeholder="deepseek-chat"></div>' +
        '<div class="note">' + esc(t('keyNote')) + '</div>' +
        '<button class="btn" data-act="calibrate" style="width:100%;margin-top:8px">' + esc(t('calibrateSite')) + '</button>' +
        '</div>' +
        '<div class="bar"><button class="btn" data-act="cancel-settings">' + esc(t('cancel')) + '</button>' +
        '<button class="btn pri" data-act="save-settings">' + esc(t('save')) + '</button></div>';
    }

    if (S.phase === 'calibrate') {
      return '<div class="calbar">' +
        (S.calStep === 0 ? esc(t('calStep0')) : esc(t('calStep1'))) +
        '</div>' +
        '<div class="bd"><div class="note">' + esc(t('calNote')) + '<br>' +
        esc(t('calNote2')) + '</div></div>' +
        '<div class="bar"><button class="btn" data-act="cal-restart">' + esc(t('restart')) + '</button>' +
        '<button class="btn" data-act="cal-cancel">' + esc(t('cancelCal')) + '</button></div>';
    }

    if (S.phase === 'paste') {
      const step = S.pasteStep || 1;
      const isQ = step === 1;
      return '<div class="bd">' +
        (S.msg ? '<div class="note" style="margin-bottom:4px">' + esc(S.msg) + '</div>' : '') +
        '<div class="note">' + esc(isQ ? t('pasteQ') : t('pasteO')) + '</div>' +
        '<textarea id="' + (isQ ? 'qc-paste' : 'qc-paste2') + '" rows="' + (isQ ? 3 : 4) + '" spellcheck="false" placeholder="' +
        (isQ ? esc(t('pasteQPH')) : t('pasteOPH')) + '">' +
        esc(isQ ? (S.qText || '') : '') + '</textarea>' +
        '</div>' +
        '<div class="bar">' +
        '<button class="btn" data-act="clip-fill">' + esc(t('pasteOne')) + '</button>' +
        (isQ
          ? '<button class="btn pri" data-act="paste-next">' + esc(t('next')) + '</button>' +
            '<button class="btn" data-act="paste-cancel">' + esc(t('cancel')) + '</button>'
          : '<button class="btn pri" data-act="paste-go">' + esc(t('answer')) + '</button>' +
            '<button class="btn" data-act="paste-back">' + esc(t('back')) + '</button>') +
        '</div>';
    }

    if (S.phase === 'message') {
      return '<div class="bd"><div class="note">' + esc(S.msg) + '</div></div>' +
        '<div class="bar"><button class="btn" data-act="refresh">' + esc(t('reextract')) + '</button>' +
        '<button class="btn pri" data-act="clip">' + esc(t('readClipboard')) + '</button>' +
        '<button class="btn" data-act="calibrate">' + esc(t('calibrate')) + '</button></div>';
    }

    if (S.phase === 'error') {
      return '<div class="bd">' +
        '<div class="err">' + esc(S.msg) + '</div>' +
        (S.data ? '<div class="qtext" style="margin-top:8px">' + esc(S.data.text) + '</div>' : '') +
        '<div class="note" style="margin-top:8px">' + esc(t('configNote')) + '</div>' +
        '</div>' +
        '<div class="bar"><button class="btn pri" data-act="retry">' + esc(t('retry')) + '</button>' +
        '<button class="btn" data-act="refresh">' + esc(t('reextract')) + '</button></div>';
    }

    if (!S.data) {
      return '<div class="bd"><div class="note">' + t('noDataHint') + '</div></div>' +
        '<div class="bar"><button class="btn pri" data-act="refresh">' + esc(t('reextract')) + '</button>' +
        '<button class="btn" data-act="calibrate">' + esc(t('manualCal')) + '</button></div>';
    }

    const d = S.data;
    const srcTag = d.source === 'auto' ? '<span class="tag">' + esc(t('autoTag')) + '</span>'
      : d.source === 'selection' ? '<span class="tag">' + esc(t('selectionTag')) + '</span>' : '';

    if (S.phase === 'result' && S.result) {
      const r = S.result;
      const picked = (S.data.options || []).filter((o) => o.key === r.answer)[0];
      const ansLabel = picked && picked.label ? picked.label : r.answer;
      return '<div class="bd">' +
        '<div class="row">' +
        '<div class="big">' + esc(ansLabel) + '</div>' +
        (picked ? '<div class="ansx">' + esc(picked.text) + '</div>' : '') +
        (r.confidence != null && r.confidence < 0.6 ? '<span class="tag">' + esc(t('uncertain')) + '</span>' : '') +
        '</div>' +
        (r.explain ? '<div class="explain">' + esc(r.explain) + '</div>' : '') +
        '<div class="qtext">' + esc(d.text) + '</div>' +
        '<div class="mini"><span data-act="calibrate">' + esc(t('wrongCal')) + '</span>' +
        '<span data-act="clip">' + esc(t('paste')) + '</span></div>' +
        '</div>';
    }

    // 取答案中
    return '<div class="bd">' +
      '<div class="qtext">' + esc(d.text) + ' ' + srcTag + '</div>' +
      '<div class="note"><span class="spin"></span>' + esc(t('getting')) + '</div>' +
      '</div>';
  }

  // A 模式：只走粘贴 → 生成论述答案 → 一键复制（不在卡片里展示正文，尺寸保持不变）
  function essaySize(s) {
    const txt = String(s || '').trim();
    if (!txt) return '';
    const lang = essayLang();
    return countEssayUnits(txt, lang) + (lang === 'zh' ? t('chars') : t('words'));
  }

  function essayBody() {
    const q = String(S.essayQ || '').trim();

    if (S.phase === 'essay-busy') {
      return '<div class="bd"><div class="done">' +
        '<span><span class="spin"></span>' + esc(t('writing')) + '</span>' +
        '</div></div>' +
        '<div class="bar">' +
        '<button class="btn" disabled>' + esc(t('newQuestion')) + '</button>' +
        '<button class="btn" disabled>' + esc(t('rewrite')) + '</button>' +
        '<button class="btn pri" disabled>' + esc(t('copy')) + '</button>' +
        '</div>';
    }

    if (S.phase === 'essay-result') {
      const size = essaySize(S.essay);
      return '<div class="bd"><div class="done">' +
        esc(t('generatedWith', size)) +
        '<small>' + esc(t('copyHint')) + '</small>' +
        '</div></div>' +
        '<div class="bar">' +
        '<button class="btn" data-act="essay-new">' + esc(t('newQuestion')) + '</button>' +
        '<button class="btn" data-act="essay-go">' + esc(t('rewrite')) + '</button>' +
        '<button class="btn pri" data-act="essay-copy">' + esc(t('copy')) + '</button>' +
        '</div>';
    }

    if (S.phase === 'essay-error') {
      return '<div class="bd"><div class="done">' +
        esc(S.msg || t('genFailedShort')) +
        '</div></div>' +
        '<div class="bar">' +
        '<button class="btn" data-act="essay-new">' + esc(t('newQuestion')) + '</button>' +
        '<button class="btn pri" data-act="essay-go">' + esc(t('retry')) + '</button>' +
        '</div>';
    }

    return '<div class="bd">' +
      (S.msg ? '<div class="note" style="margin-bottom:4px">' + esc(S.msg) + '</div>' : '') +
      '<div class="note">' + esc(t('essayMode')) + '</div>' +
      '<textarea id="qc-essay" rows="4" spellcheck="false" placeholder="' + esc(t('essayPH')) + '">' +
      esc(q) + '</textarea>' +
      '</div>' +
      '<div class="bar">' +
      '<button class="btn" data-act="essay-paste">' + esc(t('pasteOne')) + '</button>' +
      '<button class="btn pri" data-act="essay-go">' + esc(t('generate')) + '</button>' +
      '</div>';
  }

  function footer() {
    if (S.phase === 'calibrate' || S.phase === 'message') return '';
    return '';
  }

  function bind() {
    if (!shadow) return;
    const wrap = shadow.querySelector('.wrap') || shadow.querySelector('.pill');
    if (!wrap) return;

    // 拖拽
    const hd = shadow.querySelector('[data-drag]');
    if (hd) {
      let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
      hd.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        dragging = true;
        const p = pos();
        sx = e.clientX; sy = e.clientY; ox = p.left; oy = p.top;
        try { hd.setPointerCapture(e.pointerId); } catch (err) {}
      });
      hd.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        S.pos = clampPos({ left: ox + (e.clientX - sx), top: oy + (e.clientY - sy) });
        const w = shadow.querySelector('.wrap');
        if (w) { w.style.left = S.pos.left + 'px'; w.style.top = S.pos.top + 'px'; }
      });
      const end = () => {
        if (!dragging) return;
        dragging = false;
        Storage.set({ position: S.pos });
      };
      hd.addEventListener('pointerup', end);
      hd.addEventListener('pointercancel', end);
    }

    // 长按标题（或右键）→ 设置，不占按钮位
    const titleEl = shadow.getElementById('qc-title');
    if (titleEl) {
      let timer = 0;
      const stop = () => { if (timer) { clearTimeout(timer); timer = 0; } };
      titleEl.addEventListener('pointerdown', () => {
        stop();
        timer = setTimeout(() => { timer = 0; onAction('settings'); }, 700);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
        titleEl.addEventListener(ev, stop);
      });
      titleEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        stop();
        onAction('settings');
      });
    }

    // 粘进输入框后自动进入下一步
    const p1 = shadow.getElementById('qc-paste');
    if (p1) {
      p1.addEventListener('paste', () => {
        setTimeout(() => {
          if (p1.value && p1.value.trim()) onAction('paste-next');
        }, 80);
      });
    }
    const p2 = shadow.getElementById('qc-paste2');
    if (p2) {
      p2.addEventListener('paste', () => {
        setTimeout(() => {
          if (p2.value && p2.value.trim()) onAction('paste-go');
        }, 80);
      });
    }

    // 论述题：粘进题目就直接开写（Ctrl/⌘+Enter 也行）
    const pe = shadow.getElementById('qc-essay');
    if (pe) {
      pe.addEventListener('paste', () => {
        setTimeout(() => {
          const v = String(pe.value || '').trim();
          if (v && !S.essayBusy) {
            S.essayQ = v;
            startEssayGeneration();
          }
        }, 80);
      });
      pe.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          startEssayGeneration();
        }
      });
    }

    // 设置里的透明度滑块：拖动时实时更新百分比
    const op = shadow.getElementById('qc-opacity');
    if (op) {
      op.addEventListener('input', () => {
        const v = shadow.getElementById('qc-opacity-val');
        if (v) v.textContent = op.value + '%';
      });
    }

    // 点击委托只绑一次（render 会反复调用 bind）
    if (!clickBound) {
      clickBound = true;
      shadow.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act]');
        if (!t) return;
        e.preventDefault();
        e.stopPropagation();
        const act = t.getAttribute('data-act');
        const k = t.getAttribute('data-k');
        onAction(act, k);
      }, true);
    }
  }

  function onAction(act, k) {
    switch (act) {
      case 'open':
        S.open = true;
        if (S.mode === 'A') {
          if (S.essay && S.essayQ) { S.phase = 'essay-result'; render(); }
          else { startEssayPaste(false); }
          break;
        }
        if (!S.data) extractAndShow();
        else if (!S.result) askAnswer();
        else render();
        break;
      case 'close':
        S.open = false;
        if (S.mode !== 'A') { S.phase = 'grading'; S.result = null; S.picked = null; }
        render();
        break;
      case 'refresh': {
        if (S.mode === 'A') {
          if (String(S.essayQ || '').trim()) startEssayGeneration();
          else startEssayPaste(false);
          break;
        }
        const d = S.sel ? null : nextCandidate();
        if (d) {
          S.data = d; S.picked = null; S.result = null; S.msg = '';
          S.open = true;
          S.phase = 'grading';
          render();
          askAnswer();
          break;
        }
        extractAndShow();
        break;
      }
      case 'toggle-mode':
        toggleMode();
        break;
      case 'essay-paste':
        essayPaste();
        break;
      case 'essay-go':
        startEssayGeneration();
        break;
      case 'essay-new':
        startEssayPaste(true);
        break;
      case 'essay-copy':
        copyEssay();
        break;
      case 'retry':
        askAnswer();
        break;
      case 'pick':
        askAnswer();
        break;
      case 'calibrate':
        startCalibration();
        break;
      case 'settings':
        S.prevPhase = S.phase;
        S.phase = 'settings';
        S.open = true;
        render();
        break;
      case 'cancel-settings':
        if (S.mode === 'A') { restoreEssayPhase(); break; }
        if (!S.data) { S.phase = 'message'; S.msg = t('noQuestion'); render(); break; }
        if (!S.result) { askAnswer(); break; }
        S.phase = 'result';
        render();
        break;
      case 'save-settings': {
        const val = (id) => {
          const el = shadow.getElementById(id);
          return el ? String(el.value || '').trim() : '';
        };
        const rawOpacity = Number(val('qc-opacity'));
        const next = Object.assign({}, S.settings, {
          apiBase: val('qc-api-base') || DEFAULT_SETTINGS.apiBase,
          apiKey: val('qc-api-key'),
          model: val('qc-model') || DEFAULT_SETTINGS.model,
          lang: val('qc-lang') || 'auto',
          answerLang: val('qc-answer-lang') || 'auto',
          theme: val('qc-theme') === 'dark' ? 'dark' : 'light',
          opacity: isFinite(rawOpacity) && rawOpacity > 0
            ? Math.min(1, Math.max(0.1, rawOpacity / 100))
            : 0.74
        });
        saveSettings(next);
        break;
      }
      case 'cal-restart':
        S.calStep = 0; S.calTmp = {}; render();
        break;
      case 'cal-cancel':
        stopCalibration(true);
        break;
      case 'round2sel':
        fromSelection();
        break;
      case 'clip':
        readClipboard();
        break;
      case 'clip-fill':
        fillFromClipboard();
        break;
      case 'paste-next': {
        const ta = shadow.getElementById('qc-paste');
        const v = ta ? String(ta.value || '').trim() : '';
        if (!v) { S.msg = t('questionEmpty'); render(); break; }
        S.qText = v;
        S.clipRaw = '';
        S.msg = '';
        S.pasteStep = 2;
        render();
        focusPaste();
        break;
      }
      case 'paste-back':
        S.pasteStep = 1;
        S.msg = '';
        render();
        break;
      case 'paste-go': {
        const ta = shadow.getElementById('qc-paste2');
        submitOptions(ta ? ta.value : '');
        break;
      }
      case 'paste-cancel':
        if (!S.data) {
          S.phase = 'message';
          S.msg = t('noQuestion');
          render();
          break;
        }
        S.phase = S.result ? 'result' : 'grading';
        render();
        break;
    }
  }

  /* ------------------------------------------------------- A 模式（论述题） */
  function toggleMode() {
    const next = S.mode === 'A' ? 'C' : 'A';
    S.mode = next;
    S.msg = '';
    S.prevPhase = null;
    Storage.set({ mode: next });

    if (next === 'A') {
      S.open = true;
      if (S.essay && S.essayQ) { S.phase = 'essay-result'; render(); }
      else startEssayPaste(false);
      return;
    }

    // 切回选择题：手里有题就不重复抠页面
    if (S.data && S.data.options && S.data.options.length >= 2) {
      S.open = true;
      S.picked = null;
      if (S.result) { S.phase = 'result'; render(); }
      else askAnswer();
      return;
    }
    extractAndShow();
  }

  function startEssayPaste(clear) {
    if (clear) { S.essayQ = ''; S.essay = ''; S.msg = ''; }
    S.open = true;
    S.phase = 'essay';
    render();
    focusEssay();
  }

  function restoreEssayPhase() {
    const prev = S.prevPhase;
    S.prevPhase = null;
    S.phase = (prev && String(prev).indexOf('essay') === 0)
      ? prev
      : (S.essay ? 'essay-result' : 'essay');
    render();
  }

  function focusEssay() {
    const ta = shadow && shadow.getElementById('qc-essay');
    if (ta) setTimeout(() => { try { ta.focus(); } catch (e) {} }, 80);
  }

  function buildEssayPrompt(q) {
    if (essayLang() === 'zh') {
      return [
        '【题目】',
        String(q || '').trim(),
        '',
        '请按下面的要求，写一份可以直接交上去的论述题答案：',
        '1. 答案必须用中文写，不要用英文。',
        '2. 只输出答案正文。不要「答案：」「解析：」这类前缀，不要 Markdown 代码块、不要小标题；用「第一、第二、第三」这样的自然说法分点。',
        '3. 整篇严格控制在 150 字以内，最多 150 字，一个字都不能超；如果写超了，就换更简洁的说法或合并观点，不能删掉半句话，最后一句必须是完整的句子。分几点、每点写多长按题目需要自己定，不固定；每点一段，段与段之间空一行。',
        '4. 你是一个普通大学生：有基本的知识储备，但逻辑别写得太严密，论证别一环扣一环；可以口语一点，举一两个普通的例子，偶尔重复或绕一下前面的意思。',
        '5. 别显得太专业：少堆术语，每点也写得自然一点，别在结尾升华、喊口号。',
        '6. 允许一点点小瑕疵（例子普通、某段稍微跳一下），整体要像人写的，读得过去。',
        '7. 不要提及这些要求，不要解释你是怎么写的。'
      ].join('\n');
    }
    return [
      '[Prompt]',
      String(q || '').trim(),
      '',
      'Write a ready-to-submit essay answer that follows these rules:',
      '1. Write in English only. Answer in English even if the prompt is in Chinese.',
      '2. Output the answer body only. No "Answer:" prefix, no Markdown fences, no headings; use natural "First / Second / Third" phrasing for points.',
      '3. Strictly at most 150 words. If you go over, rephrase or merge points; do not cut a sentence in half, and the final sentence must be complete. Use as many points as the question needs — not a fixed number. One point per paragraph, with a blank line between paragraphs.',
      '4. You are an ordinary college student: you have basic knowledge, but the logic does not need to be airtight; be a little colloquial, give one or two ordinary examples, occasionally repeat or wander a bit.',
      '5. Do not sound too professional: avoid stacking jargon, avoid a rigid template, and do not end with a grand slogan.',
      '6. Allow small imperfections (an ordinary example, a slightly jumpy paragraph) so it reads like a person wrote it.',
      '7. Do not mention these instructions or explain how you wrote it.'
    ].join('\n');
  }

  function parseEssayText(text) {
    let s = String(text || '').trim();
    s = s.replace(/^```[\w-]*\s*/, '').replace(/\s*```$/, '').trim();
    s = s.replace(/^(?:参考答案|答案|答|解析|论述|Answer(?:\s*Key)?|Response|My\s+answer)\s*[:：]\s*/i, '').trim();
    return s;
  }

  function countWords(s) {
    return String(s || '').split(/\s+/).filter(Boolean).length;
  }

  function countEssayUnits(s, lang) {
    if (lang === 'zh') {
      const cjk = (String(s || '').match(/[\u4e00-\u9fff]/g) || []).length;
      return cjk || countWords(s);
    }
    return countWords(s);
  }

  const ESSAY_SYSTEM = {
    zh: '你在帮同学写论述题作业，答案用中文。只输出答案正文。',
    en: 'You are helping a classmate write an essay answer. Output only the answer body, in English.'
  };

  const COMPRESS_SYSTEM = {
    zh: '你在压缩一段中文论述题答案。只输出压缩后的正文。',
    en: 'You are compressing an English essay answer. Output only the compressed body.'
  };

  // 超过 150 单位时：先让模型换说法/合并观点重写；实在压不下来才按完整句子取舍，绝不截半句
  function buildCompressPrompt(text, max, attempt) {
    const lang = essayLang();
    if (lang === 'zh') {
      const lines = [
        '下面这段中文论述题答案现在有 ' + countEssayUnits(text, 'zh') + ' 字，超过了 ' + max + ' 字的上限。',
        '请在不丢掉主要观点的前提下，换更简洁的说法、合并相近的观点，把它压缩到 ' + max + ' 字以内。',
        '',
        '要求：',
        '1. 仍然是中文，普通大学生口吻，逻辑不用太严密，别写得太专业。',
        '2. 每个句子都必须是完整的句子，结尾最后一句也要完整；不要用省略号，不要把句子写一半。',
        '3. 只输出压缩后的答案正文，不要解释，不要「答案：」前缀，不要 Markdown。'
      ];
      if (attempt > 1) {
        lines.push('4. 注意：上一次压缩后仍然超过上限，这次必须写得更短，但结尾仍要是完整句子。');
      }
      lines.push('', '【原文】', text);
      return lines.join('\n');
    }
    const lines = [
      'This English essay answer currently has ' + countEssayUnits(text, 'en') + ' words, over the ' + max + '-word limit.',
      'Rewrite it more concisely — change the wording and merge similar points — so that it is within ' + max + ' words without losing the main ideas.',
      '',
      'Requirements:',
      '1. Keep it in English, in an ordinary college-student voice; the logic does not need to be airtight and it should not sound too professional.',
      '2. Every sentence must be complete, including the final one; no ellipsis and no half sentence.',
      '3. Output only the compressed answer body. No explanation, no "Answer:" prefix, no Markdown.'
    ];
    if (attempt > 1) {
      lines.push('4. Note: the previous compression was still over the limit. This time it must be shorter, and the ending must still be a complete sentence.');
    }
    lines.push('', '[Original]', text);
    return lines.join('\n');
  }

  function cutToCompleteSentences(text, max) {
    const lang = essayLang();
    const s = String(text || '').trim();
    if (countEssayUnits(s, lang) <= max) return s;
    const sentences = s.match(/[^.!?。！？]+[.!?。！？]+["')\]]*\s*/g) || [];
    let out = '';
    let count = 0;
    for (const sentence of sentences) {
      const n = countEssayUnits(sentence, lang);
      if (!n) continue;
      if (count + n > max) break;
      out += sentence;
      count += n;
    }
    // 连一句都放不下时保留原文：宁可略超，也不留半句
    return out.trim() || s;
  }

  function ensureEndPunct(s) {
    const txt = String(s || '').trim();
    if (!txt) return txt;
    if (essayLang() === 'zh') {
      return /[。！？…]["')\]]?$/.test(txt) ? txt : txt + '。';
    }
    return /[.!?…]["')\]]?$/.test(txt) ? txt : txt + '.';
  }

  async function ensureEssayLimit(settings, text, max) {
    const lang = essayLang();
    let draft = text;
    for (let i = 0; i < 2 && countEssayUnits(draft, lang) > max; i++) {
      try {
        const raw = await postChat(
          settings,
          COMPRESS_SYSTEM[lang],
          buildCompressPrompt(draft, max, i + 1),
          0.5
        );
        const next = parseEssayText(raw);
        if (!next) break;
        if (countEssayUnits(next, lang) < countEssayUnits(draft, lang)) draft = next;
        else if (i === 1) break;
      } catch (e) {
        break;
      }
    }
    return ensureEndPunct(countEssayUnits(draft, lang) <= max ? draft : cutToCompleteSentences(draft, max));
  }

  async function postChat(settings, system, prompt, temperature) {
    const body = {
      model: settings.model,
      temperature: temperature == null ? 0.9 : temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    };
    const res = await fetch(settings.apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + '  ' + t.slice(0, 140));
    }
    const json = await res.json();
    return (((json.choices || [])[0] || {}).message || {}).content || '';
  }

  async function askEssayModel(settings, q) {
    if (!settings.apiKey) throw new Error('NO_KEY');
    const raw = await postChat(
      settings,
      ESSAY_SYSTEM[essayLang()],
      buildEssayPrompt(q),
      0.9
    );
    const text = parseEssayText(raw);
    if (!text) throw new Error(t('emptyResponse'));
    return await ensureEssayLimit(settings, text, 150);
  }

  async function startEssayGeneration() {
    const ta = shadow && shadow.getElementById('qc-essay');
    const v = ta ? String(ta.value || '').trim() : String(S.essayQ || '').trim();
    if (!v) {
      S.msg = t('pasteFirst');
      S.phase = 'essay';
      render();
      focusEssay();
      return;
    }
    if (S.essayBusy) return;

    S.essayQ = v;
    S.essay = '';
    S.msg = '';
    S.essayBusy = true;
    S.open = true;
    S.phase = 'essay-busy';
    render();

    if (!S.settings.apiKey) {
      S.essayBusy = false;
      S.phase = 'essay-error';
      S.msg = t('noKey');
      render();
      return;
    }

    try {
      const text = await askEssayModel(S.settings, v);
      S.essay = text;
      S.essayBusy = false;
      if (S.mode === 'A') S.phase = 'essay-result';
      render();
    } catch (e) {
      S.essayBusy = false;
      if (S.mode === 'A') {
        S.phase = 'essay-error';
        S.msg = t('genFailed', (e && e.message ? e.message : String(e)));
      }
      render();
    }
  }

  async function essayPaste() {
    let text = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
    } catch (e) { text = ''; }

    text = String(text || '').trim();
    if (!text) {
      S.msg = t('clipboardBlocked');
      S.phase = 'essay';
      render();
      focusEssay();
      return;
    }
    S.essayQ = text.slice(0, 4000);
    S.msg = '';
    const ta = shadow && shadow.getElementById('qc-essay');
    if (ta) ta.value = S.essayQ;
    startEssayGeneration();
  }

  function copyText(text) {
    const s = String(text || '');
    if (!s) return Promise.resolve(false);
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = s;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        try { ta.setSelectionRange(0, s.length); } catch (e) {}
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(s).then(() => true, () => fallback());
      }
    } catch (e) { /* 往下走 */ }
    return Promise.resolve(fallback());
  }

  async function copyEssay() {
    const ok = await copyText(S.essay);
    const btn = shadow && shadow.querySelector('[data-act="essay-copy"]');
    if (!btn) return;
    btn.textContent = ok ? t('copied') : t('copyFailed');
    btn.disabled = true;
    setTimeout(() => {
      if (!btn.isConnected) return;
      btn.disabled = false;
      btn.textContent = t('copy');
    }, 1200);
  }

  function hasEssayField() {
    const list = document.querySelectorAll('textarea, [contenteditable="true"]');
    for (let i = 0; i < list.length && i < 20; i++) {
      if (isVisible(list[i])) return true;
    }
    return false;
  }

  function extractAndShow() {
    CAND = [];
    CAND_IDX = 0;
    const data = extractQuestion(S.sel);
    S.data = data;
    S.picked = null;
    S.result = null;
    if (!data) {
      S.phase = 'message';
      if (hasEssayField()) {
        S.msg = t('essayDetected');
      } else {
        S.msg = t('noQuestionLong');
      }
      S.open = true;
      render();
      return;
    }
    S.open = true;
    S.phase = 'grading';
    render();
    askAnswer();
  }

  function fromSelection() {
    const raw = window.getSelection ? String(window.getSelection()) : '';
    const data = parseFromSelection(raw);
    if (!data) {
      S.msg = t('selectionNoOptions');
      S.phase = 'message';
      render();
      return;
    }
    S.data = data; S.picked = null; S.result = null;
    S.phase = 'grading';
    S.open = true;
    render();
    askAnswer();
  }

  function startFromData(d) {
    S.data = d;
    S.picked = null;
    S.result = null;
    S.msg = '';
    S.open = true;
    S.phase = 'grading';
    render();
    askAnswer();
  }

  function focusPaste() {
    const ta = shadow.getElementById(S.pasteStep === 1 ? 'qc-paste' : 'qc-paste2');
    if (ta) setTimeout(() => { try { ta.focus(); } catch (e) {} }, 80);
  }

  function goAnswer(q, opts) {
    const text = String(q || '').trim() || t('unrecognizedQuestion');
    S.data = {
      text: text,
      options: opts,
      number: findNumber(text),
      source: 'paste'
    };
    S.picked = null;
    S.result = null;
    S.msg = '';
    S.open = true;
    S.phase = 'grading';
    S.clipRaw = '';
    S.qText = '';
    S.pasteStep = 1;
    render();
    askAnswer();
  }

  // 进入两步粘贴：① 题目 ② 选项（进来永远是空的，不预填任何东西）
  function readClipboard() {
    S.pasteStep = 1;
    S.qText = '';
    S.clipRaw = '';
    S.msg = '';
    S.phase = 'paste';
    S.open = true;
    render();
    focusPaste();
  }

  async function fillFromClipboard() {
    S.msg = '';
    let text = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
    } catch (e) { text = ''; }

    if (!text || !String(text).trim()) {
      S.msg = t('clipboardBlocked');
      render();
      return;
    }

    if ((S.pasteStep || 1) === 1) {
      S.qText = String(text).trim();
      S.msg = t('clipboardFilled');
      render();
      focusPaste();
      return;
    }

    const ta2 = shadow.getElementById('qc-paste2');
    if (ta2) ta2.value = String(text).trim();
    submitOptions(String(text));
  }

  // 第二步提交：先校验「这像不像选项」，否则不往下走
  function submitOptions(raw) {
    const text = String(raw || '').trim();
    if (!text) {
      S.msg = t('optionsEmpty');
      render();
      return;
    }
    if (String(S.qText || '').trim() && text === String(S.qText).trim()) {
      S.msg = t('stillQuestion');
      render();
      return;
    }
    const items = parseOptionsRaw(text);
    if (!optionsLookValid(items)) {
      S.msg = t('notOptions');
      render();
      return;
    }
    goAnswer(S.qText, finalizeOptions(items));
  }

  async function askAnswer() {
    if (!S.data) return;
    S.msg = '';
    S.result = null;
    S.phase = 'grading';
    render();

    if (!S.settings.apiKey) {
      S.phase = 'error';
      S.msg = t('noKey');
      render();
      return;
    }

    try {
      const r = await askModel(S.settings, S.data.text, S.data.options);
      S.result = r;
      if (S.mode === 'C') S.phase = 'result';
      saveStat();
      render();
    } catch (e) {
      if (S.mode === 'C') {
        S.phase = 'error';
        S.msg = t('answerFailed', (e && e.message ? e.message : String(e)));
      }
      render();
    }
  }

  async function saveStat() {
    const cur = (await Storage.get(['stats'])).stats || { total: 0 };
    cur.total = (cur.total || 0) + 1;
    delete cur.right;
    await Storage.set({ stats: cur });
  }

  async function saveSettings(next) {
    S.settings = next;
    await Storage.set({ settings: next });
    applyLang(next.lang);
    S.msg = '';
    if (S.mode === 'A') {
      S.prevPhase = null;
      if (S.essay) { S.phase = 'essay-result'; render(); }
      else if (S.essayQ) startEssayGeneration();
      else startEssayPaste(false);
      return;
    }
    if (S.data) {
      if (!S.result) { askAnswer(); }
      else { S.phase = 'result'; render(); }
    } else {
      extractAndShow();
    }
  }

  /* ------------------------------------------------------------- 标定流程 */
  let calHandler = null;

  function startCalibration() {
    S.phase = 'calibrate';
    S.calStep = 0;
    S.calTmp = {};
    S.open = true;
    render();
    if (calHandler) document.removeEventListener('pointerdown', calHandler, true);
    calHandler = (e) => {
      if (hostEl && e.composedPath && e.composedPath().indexOf(hostEl) >= 0) return;
      e.preventDefault();
      e.stopPropagation();
      const el0 = document.elementFromPoint(e.clientX, e.clientY);
      if (!el0 || el0 === hostEl) return;
      let el = el0;
      // 第一步如果点到很窄的行内元素（比如 <strong>第 3 题</strong>），往上抬一层
      if (S.calStep === 0) {
        let cur = el;
        for (let i = 0; i < 3 && cur; i++) {
          if (((cur.innerText || '').trim()).length >= 6) break;
          cur = cur.parentElement;
        }
        if (cur) el = cur;
      }
      if (S.calStep === 0) {
        S.calTmp.q = cssPath(el);
        S.calStep = 1;
        render();
      } else {
        S.calTmp.opt = cssPath(el);
        finishCalibration();
      }
    };
    document.addEventListener('pointerdown', calHandler, true);
  }

  function stopCalibration(cancel) {
    if (calHandler) document.removeEventListener('pointerdown', calHandler, true);
    calHandler = null;
    if (cancel) {
      S.phase = S.result ? 'result' : (S.data ? 'grading' : 'message');
      S.calStep = 0;
      S.calTmp = {};
      render();
      return;
    }
  }

  async function finishCalibration() {
    if (calHandler) document.removeEventListener('pointerdown', calHandler, true);
    calHandler = null;

    let qEl = null, optEl = null;
    try { qEl = document.querySelector(S.calTmp.q); } catch (e) {}
    try { optEl = document.querySelector(S.calTmp.opt); } catch (e) {}

    // 用户可能点到某个选项而不是「包住所有选项」的容器：往上找能读出 ≥2 个选项的那一层
    let cur = optEl;
    let found = null;
    for (let i = 0; i < 5 && cur; i++) {
      if (optionsIn(cur).length >= 2) { found = cur; break; }
      cur = cur.parentElement;
    }
    if (found) optEl = found;

    const sel = { q: qEl ? cssPath(qEl) : S.calTmp.q, opt: optEl ? cssPath(optEl) : S.calTmp.opt };
    const test = extractFromCalibration(sel);
    if (!test) {
      S.phase = 'message';
      S.msg = t('calFailed');
      render();
      return;
    }
    S.sel = sel;
    await Storage.set({ ['sel:' + HOST]: sel });
    const saved = (await Storage.get(['calibrated'])).calibrated || {};
    saved[HOST] = Date.now();
    await Storage.set({ calibrated: saved });

    S.data = test;
    S.picked = null;
    S.result = null;
    S.phase = 'grading';
    render();
    askAnswer();
  }

  /* ---------------------------------------------------------------- 启动 */
  async function boot() {
    const st = (await Storage.get(['settings'])).settings || {};
    const merged = Object.assign({}, DEFAULT_SETTINGS, st);
    // 脚本里内置了 Key、而这个站点还没单独配过时，用内置的
    if (!merged.apiKey && DEFAULT_SETTINGS.apiKey) merged.apiKey = DEFAULT_SETTINGS.apiKey;
    if (!merged.model && DEFAULT_SETTINGS.model) merged.model = DEFAULT_SETTINGS.model;
    S.settings = merged;
    applyLang(merged.lang);
    S.pos = S.settings.position || null;

    const savedMode = (await Storage.get(['mode'])).mode;
    if (savedMode === 'A' || savedMode === 'C') S.mode = savedMode;

    const sel = (await Storage.get(['sel:' + HOST]))['sel:' + HOST];
    if (sel) S.sel = sel;

    // 子框架：只有在确实抓到题目时才渲染，避免一页多个悬浮球
    // （A 模式不需要读页面，子框架里也不出现）
    if (!IS_TOP) {
      if (S.mode === 'A') return;
      const probe = extractHeuristic();
      if (!probe) return;
      S.data = probe;
    }

    render();

    window.addEventListener('resize', () => { if (S.open) render(); });

    // SPA 路由变化：收起卡片
    const reset = () => {
      if (!S.open) return;
      S.open = false; S.data = null; S.result = null; S.picked = null; S.phase = 'grading';
      render();
    };
    window.addEventListener('popstate', reset);
    window.addEventListener('hashchange', reset);

    // 站点设置从 popup 改了以后同步
    if (HAS_EXT && EXT.storage && EXT.storage.onChanged) {
      EXT.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.settings) {
          S.settings = Object.assign({}, DEFAULT_SETTINGS, changes.settings.newValue || {});
          applyLang(S.settings.lang);
          if (S.open) render();
        }
        const key = 'sel:' + HOST;
        if (changes[key]) S.sel = changes[key].newValue || null;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // 供预览页调试
  try {
    window.__QUIZ_COACH_API__ = {
      version: VERSION,
      extract: () => extractQuestion(S.sel),
      candidates: () => CAND.map((c) => ({
        number: c.number, text: c.text.slice(0, 40), y: Math.round(c.y),
        opts: c.options.map((o) => o.key)
      })),
      rescan: () => { CAND = collectCandidates(); CAND_IDX = 0; return CAND.length; },
      state: S,
      render: render,
      open: () => { S.open = true; render(); },
      toggleMode: toggleMode,
      essay: () => ({ q: S.essayQ, text: S.essay })
    };
  } catch (e) {}
})();
