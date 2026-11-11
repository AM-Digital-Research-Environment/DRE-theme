// scripts/check-integration-contract.mjs, the theme–module contract check.
//
// The real contract runs against the real tree (and the sibling modules when
// they are checked out). Every check type is then proved to bite: a small
// fixture layout (a theme beside three "modules") passes with a small contract,
// and each single seeded drift fails, naming it. A missing module is skipped
// locally and fails under CI=true.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {basename, dirname, join, resolve, sep} from 'node:path';
import {tmpdir} from 'node:os';

import {CONTRACT, DOCUMENT} from '../../scripts/lib/integration-contract.mjs';

const SCRIPT = resolve(import.meta.dirname, '../../scripts/check-integration-contract.mjs');

function check(args = [], ci = '') {
    // CI is set explicitly: GitHub sets CI=true for every job, including the
    // one that runs these tests without the modules checked out.
    const result = spawnSync(process.execPath, [SCRIPT, ...args], {encoding: 'utf8', env: {...process.env, CI: ci}});
    return {status: result.status, output: `${result.stdout}${result.stderr}`};
}

const CLEAN = {
    'DRE-theme/docs/C.md': '`dreThing` `--dre-search-bar-*` `--dre-search-bar-min-height` `metrics` `window.Tokens` `table`\n',
    'DRE-theme/view/x.phtml': "<?php if ($this->getHelperPluginManager()->has('dreThing')) echo $r['key'];\n",
    'DRE-theme/asset/sass/s.scss': '.a {\n    // --dre-search-bar-radius: 0; is a comment, not a declaration\n    --dre-search-bar-min-height: 1px;\n}\n',
    'DRE-theme/config/p.php': "<?php return [\n    'statPages' => [\n        'a' => 'x',\n        'b' => 'y',\n    ],\n];\n",
    'DRE-theme/js/p.js': 'ns.alpha = 1;\nns.beta = 2;\n',
    'DRE-theme/helper/R.php': "<?php class R {\n    private const REGISTERS = [\n        'example.org' => 'Example',\n    ];\n}\n",
    'DRESearch/config/module.config.php': "<?php\nreturn [\n    'block_layouts' => [\n        'dreOther' => X::class,\n    ],\n    'view_helpers' => [\n        'factories' => [\n            'dreThing' => X::class,\n        ],\n    ],\n];\n",
    'DRESearch/src/H.php': "<?php\n/* 'ghost' => 1 */\nreturn ['key' => 1];\n",
    'DRESearch/src/M.php': "<?php class M {\n    private const METRICS = [\n        'a' => 'p',\n        'b' => 'q',\n    ];\n}\n",
    'DRESearch/src/Bar.svelte': '<style>.b { min-height: var(--dre-search-bar-min-height, auto); }</style>\n',
    'DRESearch/src/c.ts': 'tokens.alpha();\n',
    'DRE-LinkedData/config/table.php': "<?php return ['x' => [\n    'label' => 'Example',\n    'canonical' => 'https://www.example.org/$1',\n]];\n",
    'DRE-SEO/config/table.php': "<?php return ['x' => [\n    'label' => 'Example',\n    'canonical' => 'https://www.example.org/$1',\n]];\n",
};

const FIXTURE_CONTRACT = `export const DOCUMENT = 'docs/C.md';
export const CONTRACT = [
    {id: 'dreThing', checks: [
        {type: 'helper', repo: 'search', file: 'config/module.config.php', name: 'dreThing'},
        {type: 'includes', repo: 'theme', file: 'view/x.phtml', text: ["has('dreThing')", {re: 'echo \\\\$r'}]},
        {type: 'keys', repo: 'search', files: ['src/H.php'], keys: ['key']},
        {type: 'reads', repo: 'theme', files: ['view/x.phtml'], keys: ['key']},
    ]},
    {id: '--dre-search-bar-*', checks: [
        {type: 'properties', repo: 'search', file: 'src/Bar.svelte', theme: 'asset/sass/s.scss', names: ['--dre-search-bar-min-height']},
    ]},
    {id: 'metrics', checks: [
        {type: 'listKeys', repo: 'search', file: 'src/M.php', list: 'METRICS', keys: ['a', 'b']},
        {type: 'listKeys', repo: 'theme', file: 'config/p.php', list: 'statPages', keys: ['a', 'b']},
    ]},
    {id: 'window.Tokens', checks: [
        {type: 'members', provider: {repo: 'theme', file: 'js/p.js', pattern: String.raw\`\\bns\\.(\\w+)\\s*=\`},
            consumers: [{repo: 'search', file: 'src/c.ts', pattern: String.raw\`\\btokens\\.(\\w+)\`}]},
    ]},
    {id: 'table', checks: [
        {type: 'identical', files: [{repo: 'linkedData', file: 'config/table.php'}, {repo: 'seo', file: 'config/table.php'}]},
        {type: 'registers', repo: 'linkedData', file: 'config/table.php', theme: 'helper/R.php'},
    ]},
];
`;

async function layout(t, files) {
    const dir = await mkdtemp(join(tmpdir(), 'dre-contract-test-'));
    t.after(async () => {
        // Cleanup is restricted to the temporary directory this test created.
        assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
        assert.ok(basename(dir).startsWith('dre-contract-test-'));
        await rm(dir, {recursive: true, force: true});
    });
    for (const [path, content] of Object.entries({...files, 'contract.mjs': FIXTURE_CONTRACT})) {
        if (content === null) continue;
        await mkdir(dirname(join(dir, path)), {recursive: true});
        await writeFile(join(dir, path), content);
    }
    return [`--root=${join(dir, 'DRE-theme')}`, `--contract=${join(dir, 'contract.mjs')}`];
}

// The theme half only: `npm run check:contract` (CI's module-integration and
// contract-drift jobs) runs the whole contract against the modules.
test('the real contract holds on the theme side, under CI=true too', () => {
    for (const ci of ['', 'true']) {
        const {status, output} = check(['--theme-only'], ci);
        assert.equal(status, 0, output);
        assert.match(output, /Integration contract: \d+ check\(s\) on \d+ entries passed, \d+ skipped for --theme-only\./);
        assert.doesNotMatch(output, /MISSING/);
    }
});

test('the contract list names unique entries, each with checks', () => {
    const ids = CONTRACT.map(entry => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(CONTRACT.every(entry => entry.checks.length > 0));
    assert.equal(DOCUMENT, 'docs/INTEGRATION-CONTRACT.md');
});

test('the fixture passes with every module present, and under CI=true', async t => {
    const args = await layout(t, CLEAN);
    for (const ci of ['', 'true']) {
        const {status, output} = check(args, ci);
        assert.equal(status, 0, output);
        assert.doesNotMatch(output, /MISSING/);
    }
});

test('each drift on either side fails, naming it', async t => {
    const drifts = {
        'a helper renamed': [{'DRESearch/config/module.config.php': CLEAN['DRESearch/config/module.config.php'].replace("'dreThing'", "'dreThings'")},
            /no longer registers the view helper 'dreThing'/],
        'a helper name left only outside view_helpers': [{'DRESearch/config/module.config.php': CLEAN['DRESearch/config/module.config.php']
            .replace("'dreOther'", "'dreThing'").replace("'dreThing' => X::class,\n        ],\n    ],\n];", "'dreElse' => X::class,\n        ],\n    ],\n];")},
            /no longer registers the view helper 'dreThing'/],
        'a returned key left only in a comment': [{'DRESearch/src/H.php': "<?php\n/* 'key' => 1 */\nreturn ['other' => 1];\n"},
            /no longer returns the key 'key'/],
        'the theme no longer reading a key': [{'DRE-theme/view/x.phtml': "<?php if ($this->getHelperPluginManager()->has('dreThing')) echo $r['other'];\n"},
            /no longer reads \['key'\]/],
        'a consumer string gone': [{'DRE-theme/view/x.phtml': "<?php echo $r['key'];\n"},
            /view\/x\.phtml no longer contains has\('dreThing'\)/],
        'the theme setting an unlisted property': [{'DRE-theme/asset/sass/s.scss': '.a {\n    --dre-search-bar-min-height: 1px;\n    --dre-search-bar-radius: 0;\n}\n'},
            /sets --dre-search-bar-radius, which the contract does not list/],
        'the module no longer reading a property': [{'DRESearch/src/Bar.svelte': '<style>.b { min-height: auto; }</style>\n'},
            /no longer reads --dre-search-bar-min-height/],
        'a metric reordered': [{'DRESearch/src/M.php': "<?php class M {\n    private const METRICS = [\n        'b' => 'q',\n        'a' => 'p',\n    ];\n}\n"},
            /METRICS is \[b, a\]/],
        'a module calling a member the theme does not define': [{'DRESearch/src/c.ts': 'tokens.alpha();\ntokens.gamma();\n'},
            /calls 'gamma', which js\/p\.js does not define/],
        'the copies of a shared table diverging': [{'DRE-SEO/config/table.php': CLEAN['DRE-SEO/config/table.php'] + '\n'},
            /are no longer byte-identical/],
        'an authority the theme labels differently': [{'DRE-theme/helper/R.php': CLEAN['DRE-theme/helper/R.php'].replace("=> 'Example'", "=> 'Sample'")},
            /REGISTERS labels www\.example\.org 'Sample', the identity table 'Example'/],
        'an authority the theme cannot label': [{'DRE-theme/helper/R.php': CLEAN['DRE-theme/helper/R.php'].replace("'example.org'", "'example.net'")},
            /REGISTERS has no entry for www\.example\.org/],
        'a module file gone': [{'DRESearch/src/H.php': null},
            /search:src\/H\.php does not exist/],
        'the document no longer naming an entry': [{'DRE-theme/docs/C.md': '`dreThing` `--dre-search-bar-*` `--dre-search-bar-min-height` `metrics` `window.Tokens`\n'},
            /does not name `table`/],
    };
    for (const [label, [files, message]] of Object.entries(drifts)) {
        const {status, output} = check(await layout(t, {...CLEAN, ...files}));
        assert.notEqual(status, 0, `must fail on: ${label}\n${output}`);
        assert.match(output, message, `must report: ${label}`);
    }
});

test('a missing module is skipped with a warning locally and fails under CI=true', async t => {
    const files = Object.fromEntries(Object.entries(CLEAN).filter(([path]) => !path.startsWith('DRE-SEO/')));
    const args = await layout(t, files);

    const local = check(args, '');
    assert.equal(local.status, 0, local.output);
    assert.match(local.output, /MISSING \(not checked out\): .*DRE-SEO — 1 check\(s\) on it skipped/);
    assert.match(local.output, /skipped for missing modules/);

    const ci = check(args, 'true');
    assert.notEqual(ci.status, 0, ci.output);
    assert.match(ci.output, /module checkout\(s\) missing under CI=true/);
});

test('without the modules, or with --theme-only, the theme half of a split check still runs', async t => {
    const sass = '.a {\n    --dre-search-bar-min-height: 1px;\n    --dre-search-bar-radius: 0;\n}\n';
    const themeFiles = Object.fromEntries(Object.entries(CLEAN).filter(([path]) => path.startsWith('DRE-theme/')));
    for (const [files, extra] of [[themeFiles, []], [CLEAN, ['--theme-only']]]) {
        const args = await layout(t, {...files, 'DRE-theme/asset/sass/s.scss': sass});
        const {status, output} = check([...args, ...extra], '');
        assert.notEqual(status, 0, output);
        assert.match(output, /sets --dre-search-bar-radius, which the contract does not list/);
        assert.match(output, extra.length ? /skipped \(--theme-only\)/ : /MISSING/);
    }
});

test('--theme-only ignores drift in a module that is checked out', async t => {
    const args = await layout(t, {...CLEAN, 'DRESearch/src/Bar.svelte': '<style>.b { min-height: auto; }</style>\n'});
    const {status, output} = check([...args, '--theme-only'], 'true');
    assert.equal(status, 0, output);
});
