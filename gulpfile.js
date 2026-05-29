'use strict';

const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');

// Compile asset/sass/*.scss -> asset/css/*.css (compressed, autoprefixed).
// Uses the Dart Sass module system (@use / @forward); leaf partials are
// prefixed with "_" and are never compiled directly.
function css() {
    return gulp.src('./asset/sass/*.scss')
        .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
        .pipe(postcss([autoprefixer()]))
        .pipe(gulp.dest('./asset/css'));
}

function watch() {
    gulp.watch('./asset/sass/**/*.scss', css);
}

exports.css = css;
exports['css:watch'] = watch;
exports.default = gulp.series(css, watch);
