/* ============================================================
   ds-level2 — 실습 과제 덤프 (Node 전용)

   node tools/extract_practice.js data/a1-sql.js [data/...] > out.json
   인수가 없으면 data/*.js 전부(_sample.js 제외).

   registry.js·curriculum.js·대상 파일을 vm 컨텍스트에 로드하고 등록된
   practices[] 를 JSON 배열로 표준 출력에 쓴다. 각 항목:
     { id, node, title, setup, solution, answer, verified }
   setup/solution 은 줄 배열을 "\n" 으로 합친 문자열이다.
   이 출력은 tools/verify_practice.py 의 입력이다 — 거기서 실제로 실행해 answer 와 대조한다.
   ============================================================ */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');

var appDir = path.resolve(__dirname, '..');
var args = process.argv.slice(2);
if (!args.length) {
  var dataDir = path.join(appDir, 'data');
  args = fs.existsSync(dataDir) ? fs.readdirSync(dataDir)
    .filter(function (f) { return /\.js$/.test(f) && f !== '_sample.js'; })
    .sort().map(function (f) { return path.join(dataDir, f); }) : [];
}

var ctx = vm.createContext({ console: console });
function load(file, label) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: label || file });
}
load(path.join(appDir, 'js', 'registry.js'), 'registry.js');
load(path.join(appDir, 'js', 'curriculum.js'), 'curriculum.js');

var failed = 0;
args.forEach(function (f) {
  var abs = path.resolve(f);
  var name = path.basename(abs);
  if (!fs.existsSync(abs)) { process.stderr.write('파일 없음: ' + abs + '\n'); failed++; return; }
  ctx.DS2.__currentFile = name;
  try { load(abs, name); }
  catch (e) { process.stderr.write(name + ' 로드 실패: ' + e.message + '\n'); failed++; }
});

var DS2 = ctx.DS2;
var text = DS2.text;
var out = DS2.allPractices().map(function (p) {
  return {
    id: p.id, node: p.node, title: text(p.title), file: DS2.fileOf(p.id),
    setup: text(p.setup), solution: text(p.solution),
    answer: p.answer, verified: p.verified || null
  };
});
// 레지스트리 단계에서 버려진 실습(id 형식·answer 형식 오류)은 여기도 빠진다. 사람이 알도록 stderr 에 적는다.
DS2.warnings.filter(function (w) { return w.type === 'practice-invalid' || w.type === 'practice-duplicate'; })
  .forEach(function (w) { process.stderr.write('제외됨: ' + (w.id || '?') + ' (' + w.type + (w.reason ? ': ' + w.reason : '') + ')\n'); });

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.stderr.write('실습 ' + out.length + '개 추출 (' + args.length + ' 파일)\n');
process.exit(failed ? 1 : 0);
