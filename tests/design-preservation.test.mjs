import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = p => readFileSync('web/' + p, 'utf8');
const order = ['impacto','regular','bases-legado','consultas-legado','xml','simples','pedagio','nfse','bases','consultas'];

test('polimento visual disponível em todas as telas sem criar outra navegação', () => {
  for (const file of ['index.html','painel.html','simulador.html','oficial.html','simples.html']) {
    const html = page(file);
    assert.match(html, /styles-refinements\.css\?v=20261118-polish/);
    assert.equal((html.match(/styles-refinements\.css/g)||[]).length, 1);
  }
});
test('ordem original, glyphs acessíveis e telas preservadas no painel', () => {
  for (const file of ['index.html','painel.html']) {
    const html = page(file);
    assert.deepEqual([...html.matchAll(/data-tool="([^"]+)"/g)].map(x=>x[1]), order);
    assert.equal((html.match(/<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">/g)||[]).length, 10);
    assert.equal((html.match(/data-pane="/g)||[]).length, 10);
    for (const src of ['/simulador.html?embedded=1','/oficial.html?embedded=1','/simples.html?embedded=1']) {
      assert.ok(html.includes(src));
    }
  }
});
test('refino nao altera a distribuicao dos paineis incorporados', () => {
  const css = page('styles-refinements.css');
  const embed = page('styles-embed.css');
  assert.match(embed, /html\.embedded \.main-content/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /grid-template-columns\s*:/);
  assert.doesNotMatch(css, /height\s*:\s*100dvh/);
});
