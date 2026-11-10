// The design rules that live in stylelint.config.mjs rather than in a custom
// lint. Each is run on a seeded violation (must fail) and on the idiom it asks
// for (must pass), so a rule that silently stops matching is noticed.
import test from 'node:test';
import assert from 'node:assert/strict';
import stylelint from 'stylelint';
import {resolve} from 'node:path';

const configFile = resolve(import.meta.dirname, '../../stylelint.config.mjs');
const codeFilename = resolve(import.meta.dirname, '../../asset/sass/components/_fixture.scss');

async function warnings(code) {
    const {results} = await stylelint.lint({code, codeFilename, configFile});
    return results[0].warnings.map(w => w.rule);
}

test('outline: none and outline: 0 are refused; the transparent outline passes', async () => {
    for (const declaration of ['outline: none', 'outline: 0', 'outline: 0px', 'outline-style: none']) {
        assert.deepEqual(await warnings(`.a:focus-visible { ${declaration}; box-shadow: var(--ring-focus); }\n`),
            ['declaration-property-value-disallowed-list'], declaration);
    }
    assert.deepEqual(await warnings('.a:focus-visible { outline: 2px solid transparent; box-shadow: var(--ring-focus); }\n'), []);
    assert.deepEqual(await warnings('.a:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 2px; }\n'), []);
});
