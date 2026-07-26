/* CodeMirror matchbrackets addon (MIT) — сокращённая версия */
(function (mod) {
  if (typeof exports === 'object' && typeof module === 'object') mod(require('./codemirror'));
  else if (typeof define === 'function' && define.amd) define(['./codemirror'], mod);
  else mod(CodeMirror);
})(function (CodeMirror) {
  var matching = { '(': ')', '[': ']', '{': '}' };
  var findMatching = {
    ')': '(', ']': '[', '}': '{'
  };

  function findMatchingBracket(cm, where) {
    var line = cm.getLine(where.line);
    var pos = where.ch;
    if (pos >= line.length) return null;
    var c = line.charAt(pos);
    var type = matching[c] ? 1 : findMatching[c] ? -1 : 0;
    if (!type) return null;

    var d = type > 0 ? 1 : -1;
    var match = type > 0 ? matching[c] : findMatching[c];
    var depth = 1;

    for (var lineNo = where.line, ch = pos + d; ; ch += d) {
      if (lineNo < 0 || lineNo >= cm.lineCount()) return null;
      line = cm.getLine(lineNo);
      if (ch < 0 || ch >= line.length) {
        lineNo += d;
        ch = d > 0 ? 0 : line.length - 1;
        continue;
      }
      var next = line.charAt(ch);
      if (next === c) depth++;
      else if (next === match) {
        depth--;
        if (depth === 0) return { from: CodeMirror.Pos(lineNo, ch), to: CodeMirror.Pos(lineNo, ch + 1) };
      }
    }
  }

  function highlightMatches(cm) {
    cm.state.matchBrackets = cm.state.matchBrackets || {};
    var state = cm.state.matchBrackets;
    if (state.mark) { state.mark.clear(); state.mark = null; }
    if (state.mark2) { state.mark2.clear(); state.mark2 = null; }

    var cursor = cm.getCursor();
    var match = findMatchingBracket(cm, cursor) ||
      findMatchingBracket(cm, CodeMirror.Pos(cursor.line, cursor.ch - 1));
    if (!match) return;

    state.mark = cm.markText(match.from, match.to, { className: 'CodeMirror-matchingbracket' });
    state.mark2 = cm.markText(cursor, CodeMirror.Pos(cursor.line, cursor.ch + 1),
      { className: 'CodeMirror-matchingbracket' });
  }

  CodeMirror.defineOption('matchBrackets', false, function (cm, val) {
    if (val && !cm.state.matchBracketsOn) {
      cm.state.matchBracketsOn = true;
      cm.on('cursorActivity', highlightMatches);
    } else if (!val && cm.state.matchBracketsOn) {
      cm.state.matchBracketsOn = false;
      cm.off('cursorActivity', highlightMatches);
    }
  });
});
