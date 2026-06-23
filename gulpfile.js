'use strict';

const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const fs = require('fs');
const { Transform } = require('stream');

// Single source of truth for the theme version: config/theme.ini [info] version
// (the value Omeka actually reads and appends to assetUrl() for cache-busting).
// Read it fresh at build time so the compiled CSS header can never drift from
// it the way the hand-maintained SCSS header did (it sat at 2.0.3 for ~30
// releases). Throws loudly rather than shipping a wrong/blank version.
function themeVersion() {
    const ini = fs.readFileSync('./config/theme.ini', 'utf8');
    const match = ini.match(/^\s*version\s*=\s*"([^"]+)"/m);
    if (!match) {
        throw new Error('gulp: could not read [info] version from config/theme.ini');
    }
    return match[1];
}

// Prepend the theme's CSS file header (Theme Name / Version / license) to the
// compiled output. The header lives HERE, not as a loud `/* */` comment in
// style.scss: under the Dart Sass module system a loud comment that precedes
// `@use "abstracts"` is re-emitted at every file that loads the abstracts module
// (~50×). Building it post-compile keeps it to exactly one copy, with the real
// version stamped from theme.ini. Inserted after the hoisted @charset so the
// result stays valid CSS.
function cssHeader(version) {
    return `/*
Theme Name: Africa Multiple — DRE
Theme URI: https://github.com/AM-Digital-Research-Environment/DRE-theme
Author: Frédérick Madore
Author URI: https://www.frederickmadore.com/
Description: Digital Research Environment theme for the Africa Multiple Cluster of Excellence (University of Bayreuth). Scholarly Modernism on an OKLCH design-token foundation, with light and dark modes.
Version: ${version}
Omeka Version Constraint: ^4.2.0
Requires PHP: 8.1
License: GNU General Public License v3 or later
License URI: LICENSE
Text Domain: dre-theme
*/
`;
}

function prependHeader() {
    const header = cssHeader(themeVersion());
    return new Transform({
        objectMode: true,
        transform(file, _enc, cb) {
            if (file.isBuffer()) {
                let css = file.contents.toString('utf8');
                if (css.startsWith('@charset')) {
                    const nl = css.indexOf('\n') + 1;
                    css = css.slice(0, nl) + header + css.slice(nl);
                } else {
                    css = '@charset "UTF-8";\n' + header + css;
                }
                file.contents = Buffer.from(css, 'utf8');
            }
            cb(null, file);
        },
    });
}

// Compile asset/sass/*.scss -> asset/css/*.css (compressed, autoprefixed).
// Uses the Dart Sass module system (@use / @forward); leaf partials are
// prefixed with "_" and are never compiled directly.
function css() {
    return gulp.src('./asset/sass/*.scss')
        .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
        .pipe(postcss([autoprefixer()]))
        .pipe(prependHeader())
        .pipe(gulp.dest('./asset/css'));
}

function watch() {
    gulp.watch('./asset/sass/**/*.scss', css);
}

exports.css = css;
exports['css:watch'] = watch;
exports.default = gulp.series(css, watch);
