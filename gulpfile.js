"use strict";

const gulp = require("gulp");
const sass = require("gulp-sass");
const uglify = require("gulp-uglify");
const watchify = require("watchify");
const sourcemaps = require("gulp-sourcemaps");
const autoprefixer = require("gulp-autoprefixer");
const sassExport = require('gulp-sass-export');
const log = require('fancy-log');
const beautify = require("js-beautify").html;
const ncp = require('ncp').ncp;

const _ = require("lodash");
const browserify = require("browserify");
const sourceStream = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");
const glob = require("glob");
const through = require("through2");
const path = require("path");

const fs = require('fs');

const jsSource = "./sources/js-source";
const sassSource = "./sources/sass";
const assets = "./assets";
const js = assets + "/js/";
const css = assets + "/css/";


// The main entry file
const JS_APP_FILE = "app.js";

ncp.limit = 16;

async function generateSassReference() {

    let sourceFiles = [
        sassSource + "/page/common/globals/_token-variables.scss",
        sassSource + "/page/common/globals/_mixins.scss",
        sassSource + "/page/components/modifiers/*.scss",
    ];

    gulp
        .src(sourceFiles)
        .pipe(sassExport({
                fileName: "exodus-references.json",
                dependencies: [
                    sassSource + "/page/common/globals/",
                    sassSource + "/page/components/modifiers/",
                    sassSource + "/page/components/"
                ]
            }))
        .pipe(gulp.dest(jsSource + "/app/"));
        
    log("-- SASS Reference successfully generated");
}

/*----------------------------------------
 SOURCE DIRECTORIES
 *---------------------------------------- */

// Initialize browserify javascript code bundle
let getClassPath = (file, marker) => {
    let classPath = _.dropRight(file.split(path.sep)),
        classFolderIndex = _.lastIndexOf(classPath, marker);

    classPath = _.drop(classPath, classFolderIndex + 1);
    classPath.push(path.basename(file, ".js"));
    classPath = classPath.join("/");

    return classPath;
};

let createStream = (destination, outFile) => {
    let stream = through();

    stream
        .pipe(sourceStream(outFile))
        .pipe(buffer())
        .pipe(
            uglify({
                compress: {
                    sequences: true,
                    dead_code: true,
                    conditionals: true,
                    booleans: true,
                    unused: true,
                    if_return: true,
                    join_vars: true
                }
            })
        )
        .on("error", err => {
            console.log(err.toString());
        })
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(sourcemaps.write("./maps"))
        .pipe(gulp.dest(destination));

    return stream;
};

let loadFiles = sources => {
    let files = [];

    _.each(sources, marker => {
        let jsPath = jsSource + "/" + marker + "/**/*.js";

        _.each(glob.sync(jsPath), file => {
            file = getClassPath(file, marker);
            files[file] = jsSource + "/" + marker + "/" + file + ".js";
        });
    });

    return files;
};

let libraries = (() => {
    return loadFiles(["libs"]);
})();

let application = (() => {
    return loadFiles(["classes"]);
})();

let buildJs = b => {
    for (let name in libraries) {
        if (libraries.hasOwnProperty(name)) {
            let jsFile = libraries[name];
            b.require(jsFile, { expose: name });
        }
    }

    return b
        .bundle()
        .on("error", err => {
            console.log(err.toString(), err);
        })
        .pipe(createStream(js, "libs.js"));
};

let buildApp = b => {

    // add the main application
    b.add(jsSource + "/app/" + JS_APP_FILE);

    // return the final application code stream
    return b
        .transform("babelify", { presets: ["env"] })
        .external(_.keys(libraries))
        .bundle()
        .on("error", err => {
            console.log(err.toString());
        })
        .pipe(createStream(js, JS_APP_FILE));
};


gulp.task("default", gulp.parallel(watch));

function watch(done) {
    
    log('-- Awaiting changes...');
    gulp.watch(sassSource + "/**/*.scss", {usePolling: true}, buildSass)

    gulp.watch(jsSource + "/app/**/*.js", {usePolling: true}, buildJsApp);
    gulp.watch(jsSource + "/libs/**/*.js", {usePolling: true}, buildJsLib);


    // Watch for any changes on the javascript for
    // both classes, libs and pages
    gulp.watch("./sources/design-token.json", {usePolling: true}, gulp.series(generateSassFromToken, buildJsApp));

    done();
}


// Do a clean rebuild
gulp.task("rebuild", 
    gulp.series(
        gulp.parallel(buildSass, rebuildJsLib, rebuildJsApp)
    )
);

/*---------- CSS Pre-processor: SASS ----------*/

async function buildSass() {
    log('-- Building SASS files');

    gulp
        .src(sassSource + "/**/*.scss")
        .pipe(sourcemaps.init())
        .pipe(sass({ outputStyle: "compressed" }))
        .on("error", error => {
            // Would like to catch the error here
            console.log(error);
        })
        .pipe(
            autoprefixer({
                browsers: [
                    "last 2 version",
                    "safari 5",
                    "ie 8",
                    "ie 9",
                    "opera 12.1",
                    "ios 6",
                    "android 4"
                ],
                cascade: false
            })
        )
        .pipe(sourcemaps.write("/maps"))
        .pipe(gulp.dest(css));
}

/*------------------- JS ----------------------*/
/* JS Are bundling into browserify and uses a class format
 * with one-to-one file name to class name assignment
 * This makes code management easy for developers to call
 * and control
 * */

async function rebuildJsLib() {
    log('-- Rebuilding JS Libraries');
    return buildJs(browserify({
        insertGlobals: true,
        detectGlobals: true,
        ignoreMissing: true,
        debug: true
    }));
}

async function rebuildJsApp() {
    log('-- Rebuilding JS Application');
    return buildApp(browserify({
        detectGlobals: true,
        ignoreMissing: false,
        debug: true
    }));
}

async function buildJsLib() {
    log('-- Building JS Libraries...');
    return buildJs(watchify(
        browserify({
            insertGlobals: true,
            detectGlobals: true,
            ignoreMissing: true,
            debug: true
        })
    ));
}

// Entry Files
async function buildJsApp() {
    log('-- Building JS Application...');
    return buildApp(watchify(
        browserify({
            detectGlobals: true,
            ignoreMissing: false,
            debug: true
        })
    ));
}

/*
    This generate a sass file based on the design token
    files (design-token.json). These tokens are used to
    centralize variable declaration that can be shared to
    other digital assets
 */

 async function generateSassFromToken() {

    let tokenFile = "./sources/design-token.json";
    let tokens = JSON.parse(fs.readFileSync(tokenFile));
    let buffer = ["/* This file is generated through a design token. Don't edit this file */"];
    
    log("-- Generating Design tokens...");
    _.each(tokens, (values, scope) => {
        
        buffer.push(
            "/*---------------------------------------------------\n  " + 
            ((scope !== '') ? scope.toUpperCase() : 'NON-SCOPED VARIABLES') + 
            "\n---------------------------------------------------*/");

        _.each(values, (value, name) => {
            // for non scoped variables
            if (scope === "") {
                buffer.push("$" + name + ": " + value + ";");
            } else {
                buffer.push("$" + name + "-" + scope + ": " + value + ";");
            }
        });

        buffer.push("\n");
    });

    fs.writeFileSync(sassSource + "/page/common/globals/_token-variables.scss", buffer.join("\n"));

    // duplicate it on js-source folder as well
    fs.createReadStream(tokenFile)
        .pipe(fs.createWriteStream(jsSource+"/app/design-token.json"));

    log('-- SASS Token successfully created.');
    await generateSassReference();
};