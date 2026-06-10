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

// Stamp the real version onto the compiled CSS header's "Version:" line. The
// SCSS source carries a @@VERSION@@ sentinel; replacing the whole line keeps
// this robust regardless of the source placeholder. A sentinel left unstamped
// would be glaringly visible, surfacing a broken build instead of a silently
// stale number.
function stampVersion() {
    const version = themeVersion();
    return new Transform({
        objectMode: true,
        transform(file, _enc, cb) {
            if (file.isBuffer()) {
                const css = file.contents.toString('utf8')
                    .replace(/^Version:[^\n]*$/m, `Version: ${version}`);
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
        .pipe(stampVersion())
        .pipe(gulp.dest('./asset/css'));
}

function watch() {
    gulp.watch('./asset/sass/**/*.scss', css);
}

exports.css = css;
exports['css:watch'] = watch;
exports.default = gulp.series(css, watch);
