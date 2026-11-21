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
import {checkCatalogues, placeholderMismatches, placeholders} from '../../scripts/lib/po.mjs';

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
        // The release version is [info]'s: one in another section does not count.
        'the version only in [config]': {
            files: {'config/theme.ini': THEME_INI.replace('version = "1.2.3"\n', '') + 'version = "1.2.3"\n'},
            message: /declares no \[info\] version/,
        },
        'a registered helper with no file': {
            files: {'config/theme.ini': THEME_INI.replace('helpers[] = "Sample"\n', 'helpers[] = "Sample"\nhelpers[] = "Missing"\n')},
            message: /helpers\[\] = "Missing" has no helper\/Missing\.php/,
        },
        'a helper file nobody registered': {
            files: {'helper/Unregistered.php': HELPER.replace('class Sample', 'class Unregistered')},
            message: /helper\/Unregistered\.php exists but is not registered/,
        },
    });
});

const BROWSE = "<?php echo $this->escapeHtml($this->translate('Browse')); ?>\n";

/** A helper that calls Sample through its view, and a method of its own named alike. */
const caller = (call) => `<?php
namespace OmekaTheme\\Helper;

use Laminas\\View\\Helper\\AbstractHelper;

class Caller extends AbstractHelper
{
    public function __invoke()
    {
        $view = $this->getView();
        return ${call} . $this->sample();
    }

    private function sample()
    {
        return '';
    }
}
`;

test('check-templates.mjs fails on a seeded structural violation', async t => {
    await assertCatches(t, 'check-templates.mjs', {
        'config/theme.ini': '[info]\nhelpers[] = "Sample"\nhelpers[] = "Caller"\n',
        'helper/Sample.php': HELPER,
        // Inside a helper, $this->sample() is its own method, not the view's.
        'helper/Caller.php': caller("$view->Sample() . $this->getView()->Sample() . $view->plugin('Sample')()"),
        'view/common/header.phtml': '<header><?php echo $this->Sample(); ?></header>\n',
        'view/omeka/site/item/browse.phtml': BROWSE,
    }, {
        'unbalanced brace': {
            files: {'view/omeka/site/item/browse.phtml': BROWSE + '<?php if ($items) { ?>\n'},
            message: /unbalanced braces/,
        },
        'helper called through $view with the wrong casing': {
            files: {'helper/Caller.php': caller('$view->sample()')},
            message: /helper\/Caller\.php:\d+\s+\$view->sample\( must match the theme\.ini helper name exactly: Sample/,
        },
        'helper called through getView() with the wrong casing': {
            files: {'helper/Caller.php': caller('$this->getView()->sample()')},
            message: /->getView\(\)->sample\( must match the theme\.ini helper name exactly/,
        },
        'helper fetched with plugin() under the wrong casing': {
            files: {'helper/Caller.php': caller("$view->plugin('sample')()")},
            message: /plugin\('sample' must match the theme\.ini helper name exactly/,
        },
        'helper class named unlike its file': {
            files: {'helper/Sample.php': HELPER.replace('class Sample', 'class Sampler')},
            message: /class Sampler does not match file name Sample\.php/,
        },
        'partial() target that does not exist': {
            files: {'view/common/header.phtml': "<header><?php echo $this->partial('common/nowhere'); ?></header>\n"},
            message: /partial\('common\/nowhere'\)/,
        },
        'helper called with the wrong casing': {
            files: {'view/common/header.phtml': '<header><?php echo $this->sample(); ?></header>\n'},
            message: /must match the theme\.ini helper name exactly/,
        },
        'translation echoed without escaping': {
            files: {'view/common/header.phtml': "<header><?php echo $this->translate('Menu'); ?></header>\n"},
            message: /unescaped translate\(\)/,
        },
        'translation short-echoed without escaping': {
            files: {'view/common/header.phtml': "<header><?= $this->translate('Menu') ?></header>\n"},
            message: /unescaped translate\(\)/,
        },
        'translated format passed to sprintf()': {
            files: {'view/common/header.phtml': "<header><?php echo $this->escapeHtml(sprintf($translate('Page %s'), 2)); ?></header>\n"},
            message: /sprintf\(\) over a translation/,
        },
        'escaped translated format passed to sprintf()': {
            files: {'view/common/header.phtml': "<header><?php echo sprintf($this->escapeHtml($this->translate('By %s')), '<b>x</b>'); ?></header>\n"},
            message: /sprintf\(\) over a translation/,
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

// i18n:check: a translation's printf placeholders must be its msgid's, or
// PHP 8's sprintf() throws on the page in that language (scripts/lib/po.mjs).
const PO = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "%s items in %s"
msgstr "%2$s : %1$s documents"

#, fuzzy
msgid "%d records"
msgstr "%d notices de %s"

msgid "Search %s"
msgstr ""

msgid "One record"
msgid_plural "%d records"
msgstr[0] "Une notice"
msgstr[1] "%d notices"

msgid "100% open"
msgstr "100 % ouvert"
`;

test('placeholders are read by argument and type, in any order', () => {
    assert.deepEqual(placeholders('%s items in %s'), ['1$s', '2$s']);
    assert.deepEqual(placeholders('%2$s : %1$s'), ['1$s', '2$s']);
    assert.deepEqual(placeholders('%05.1f%% of %\'*10d'), ['1$f', '2$d']);
    assert.deepEqual(placeholders('50 % de réduction, 100%'), []);
});

test('i18n:check fails on a translation whose placeholders differ from its msgid', async t => {
    assert.deepEqual(placeholderMismatches(PO, 'language/fr.po'), [], 'reordered, fuzzy, untranslated and plural forms are fine');
    const extra = placeholderMismatches(PO.replace('"%2$s : %1$s documents"', '"%s documents dans %s (%d)"'), 'language/fr.po');
    assert.equal(extra.length, 1);
    assert.match(extra[0], /^language\/fr\.po:5\s+msgstr uses 1\$s, 2\$s, 3\$d but msgid "%s items in %s" has 1\$s, 2\$s$/);
    const dropped = placeholderMismatches(PO.replace('"%2$s : %1$s documents"', '"%s documents"'));
    assert.match(dropped[0], /msgstr uses 1\$s but msgid/);
    const plural = placeholderMismatches(PO.replace('msgstr[1] "%d notices"', 'msgstr[1] "%d notices (%s)"'));
    assert.match(plural[0], /msgstr\[1\] uses 2\$s, which msgid "One record" \/ msgid_plural do not have/);

    const root = await fixtureRoot(t, {'language/fr.po': PO, 'language/de.po': PO.replace('%2$s : %1$s', '%1$s %2$d')});
    const {files, problems} = checkCatalogues(join(root, 'language'));
    assert.equal(files, 2);
    assert.deepEqual(problems.map(p => p.split(':')[0]), ['language/de.po']);
    assert.deepEqual(checkCatalogues(join(root, 'nowhere')), {files: 0, problems: []});
});

test('the custom lints pass on the repository tree', () => {
    assert.deepEqual(checkCatalogues(resolve(SCRIPTS, '..', 'language')).problems, []);
    for (const script of ['check-theme-ini.mjs', 'check-templates.mjs', 'check-compiled-css.mjs']) {
        const result = lint(script);
        assert.equal(result.status, 0, `${script} on the repository:\n${result.output}`);
    }
});

test('ESLint flags undefined globals and syntax newer than the Safari 16.2 floor', async () => {
    const { ESLint } = await import('eslint');
    const eslint = new ESLint({ cwd: join(import.meta.dirname, '..', '..') });
    const lint = async (code, filePath) => (await eslint.lintText(code, { filePath }))[0].messages;
    assert.deepEqual(await lint('(function () { window.DREUtils.onReady(() => {}); })();\n', 'asset/js/ok.js'), []);
    assert.ok((await lint('undefinedHelper();\n', 'asset/js/bad.js')).some(m => m.ruleId === 'no-undef'));
    // A regular expression with the ES2024 v flag is a parse error in Safari 16.2.
    assert.ok((await lint(String.raw`const re = /[\p{L}--[a-z]]/v;` + '\n', 'asset/js/new-syntax.js')).some(m => m.fatal));
    assert.ok((await lint('const unused = 1;\n', 'scripts/bad.mjs')).some(m => m.ruleId === 'no-unused-vars'));
});
