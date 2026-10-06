// A lint that has only ever been seen to pass proves nothing: it may not be
// looking at anything. Each custom lint is run here against a minimal, clean
// fixture theme (must pass), then against the same fixture with exactly one
// seeded violation (must fail, naming it), and finally against the real tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {basename, dirname, join, resolve, sep} from 'node:path';
import {tmpdir} from 'node:os';

const SCRIPTS = resolve(import.meta.dirname, '../../scripts');

function lint(script, root) {
    const args = [join(SCRIPTS, script)];
    if (root) args.push(`--root=${root}`);
    const result = spawnSync(process.execPath, args, {encoding: 'utf8'});
    return {status: result.status, output: `${result.stdout}${result.stderr}`};
}

async function fixtureRoot(t, files) {
    const root = await mkdtemp(join(tmpdir(), 'dre-lint-test-'));
    t.after(async () => {
        // Cleanup is restricted to the temporary directory this test created.
        assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
        assert.ok(basename(root).startsWith('dre-lint-test-'));
        await rm(root, {recursive: true, force: true});
    });
    for (const [path, content] of Object.entries(files)) {
        await mkdir(dirname(join(root, path)), {recursive: true});
        await writeFile(join(root, path), content);
    }
    return root;
}

/** Clean fixture passes; each single seeded violation fails with its message. */
async function assertCatches(t, script, clean, violations) {
    const cleanRoot = await fixtureRoot(t, clean);
    const baseline = lint(script, cleanRoot);
    assert.equal(baseline.status, 0, `${script} must pass its clean fixture:\n${baseline.output}`);
    for (const [label, {files, message}] of Object.entries(violations)) {
        const root = await fixtureRoot(t, {...clean, ...files});
        const result = lint(script, root);
        assert.notEqual(result.status, 0, `${script} must fail on: ${label}\n${result.output}`);
        assert.match(result.output, message, `${script} must report: ${label}`);
    }
}

const HELPER = `<?php
namespace OmekaTheme\\Helper;

use Laminas\\View\\Helper\\AbstractHelper;

class Sample extends AbstractHelper
{
    public function __invoke()
    {
        return 'sample';
    }
}
`;

const THEME_INI = `[info]
name = "Fixture"
version = "1.2.3"
omeka_version_constraint = "^4.2.1"
helpers[] = "Sample"

[config]
elements.greeting.name = "greeting"
elements.greeting.type = "Laminas\\Form\\Element\\Text"
elements.greeting.options.label = "Greeting"
elements.greeting.attributes.value = "hello"
`;

test('check-theme-ini.mjs fails on a seeded contract violation', async t => {
    await assertCatches(t, 'check-theme-ini.mjs', {
        'config/theme.ini': THEME_INI,
        'view/layout/layout.phtml': "<p><?php echo $this->themeSetting('greeting', 'hello'); ?></p>\n",
        'helper/Sample.php': HELPER,
        'package.json': JSON.stringify({version: '1.2.3'}),
        'package-lock.json': JSON.stringify({version: '1.2.3', packages: {'': {version: '1.2.3'}}}),
        'CITATION.cff': 'cff-version: 1.2.0\nversion: 1.2.3\n',
        'composer.json': JSON.stringify({require: {'omeka/omeka-s': '^4.2.1'}}),
    }, {
        'composer.json Omeka range differs from theme.ini': {
            files: {'composer.json': JSON.stringify({require: {'omeka/omeka-s': '^4.2.0'}})},
            message: /composer\.json requires omeka\/omeka-s \^4\.2\.0/,
        },
        '`.info` instead of `.options.info`': {
            files: {'config/theme.ini': THEME_INI + 'elements.greeting.info = "Ignored"\n'},
            message: /elements\.greeting\.info is ignored by Omeka/,
        },
        'CITATION.cff names another version': {
            files: {'CITATION.cff': 'cff-version: 1.2.0\nversion: 1.2.2\n'},
            message: /CITATION\.cff says version 1\.2\.2/,
        },
    });
});

const BROWSE = "<?php echo $this->pageTitle($this->translate('Browse'), 1); ?>\n";

test('check-templates.mjs fails on a seeded structural violation', async t => {
    await assertCatches(t, 'check-templates.mjs', {
        'config/theme.ini': '[info]\nhelpers[] = "Sample"\n',
        'helper/Sample.php': HELPER,
        'view/common/header.phtml': '<header><?php echo $this->Sample(); ?></header>\n',
        'view/omeka/site/item/browse.phtml': BROWSE,
        'view/omeka/site/item-set/browse.phtml': BROWSE,
        'view/omeka/site/page/browse.phtml': BROWSE,
        'view/common/resource-page-block-layout/mirador.phtml':
            '<div class="block resource-block block-mirador" role="application" '
            + 'aria-label="<?php echo $this->escapeHtmlAttr($viewerLabel); ?>"></div>\n',
    }, {
        'unbalanced brace': {
            files: {'view/omeka/site/item/browse.phtml': BROWSE + '<?php if ($items) { ?>\n'},
            message: /unbalanced braces/,
        },
        'partial() target that does not exist': {
            files: {'view/common/header.phtml': "<header><?php echo $this->partial('common/nowhere'); ?></header>\n"},
            message: /partial\('common\/nowhere'\)/,
        },
        'helper called with the wrong casing': {
            files: {'view/common/header.phtml': '<header><?php echo $this->sample(); ?></header>\n'},
            message: /must match the theme\.ini helper name exactly/,
        },
    });
});

const CSS = '@charset "UTF-8";\n/*\nTheme Name: Fixture\n*/\n:root{--gap:1rem}.x{margin:var(--gap)}';

test('check-compiled-css.mjs fails on a seeded build defect', async t => {
    await assertCatches(t, 'check-compiled-css.mjs', {
        'asset/css/style.css': CSS,
    }, {
        'BOM welded to the first selector': {
            files: {'asset/css/style.css': CSS.replace(':root', '﻿:root')},
            message: /U\+FEFF BOM/,
        },
        'var() with no definition and no fallback': {
            files: {'asset/css/style.css': CSS + '.y{color:var(--undefined-token)}'},
            message: /var\(--undefined-token\) has no definition/,
        },
    });
});

test('the custom lints pass on the repository tree', () => {
    for (const script of ['check-theme-ini.mjs', 'check-templates.mjs', 'check-compiled-css.mjs']) {
        const result = lint(script);
        assert.equal(result.status, 0, `${script} on the repository:\n${result.output}`);
    }
});
