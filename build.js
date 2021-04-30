const fs = require("fs/promises");
const path = require("path");
const mkdirp = require("mkdirp");
const { spawn } = require("child_process");

const SRC_DIR = path.join(__dirname, "src");
const TW5_DIR = path.join(__dirname, "TiddlyWiki5");
const PLUGIN_DIR = path.join(TW5_DIR, "plugins", "slaymaker1907", "browser-nativesaver");
const BUILD_DIR = path.join(__dirname, "build");
const TW5_COM_DIR = path.join(TW5_DIR, "editions", "tw5.com");

async function moveTiddler(tiddler) {
    await fs.copyFile(path.join(SRC_DIR, tiddler), path.join(PLUGIN_DIR, tiddler));
    console.log("Moved [%s].", tiddler);
}

async function movePlainTiddlers(createPluginDirPromise) {
    const files = await fs.readdir(SRC_DIR);
    const tiddlers = files.filter(tid => tid.endsWith(".tid") || tid.endsWith(".info"));

    await createPluginDirPromise;
    const movePromises = tiddlers.map(moveTiddler);
    await Promise.all(movePromises);
    console.log("Moved all plain tiddlers.")
}

function runBuildCmd(cmd, args = [], opts = {}) {
    const inherit = "inherit";
    const ourOpts = {
        stdio: [
            inherit,
            inherit,
            inherit
        ],
        windowsHide: false,
        ...opts
    };

    const cp = spawn(cmd, args, ourOpts);
    return new Promise((resolve, reject) => {
        let done = false;
        cp.on("exit", code => {
            if (done) {
                return;
            }

            done = true;
            if (code === 0) {
                resolve();
            } else {
                reject(`Non-zero exit code: ${code}`);
            }
        });

        cp.on("error", err => {
            console.error(err);
            if (!done) {
                done = true;
                reject(err);
            }
        });
    });
}

async function compileTypescript() {
    await mkdirp(BUILD_DIR);

    try {
        const tsc = process.platform === "win32" ? "tsc.cmd" : "tsc";
        await runBuildCmd(tsc);
        console.log("Compiled code.");
    } catch (err) {
        console.error("tsc encountered error.")
        throw err;
    }
}

async function moveTSTiddlers(createPluginDirPromise) {
    await compileTypescript();
    const files = await fs.readdir(BUILD_DIR);
    await createPluginDirPromise;

    const promises = files.map(async file => {
        await fs.copyFile(path.join(BUILD_DIR, file), path.join(PLUGIN_DIR, file));
        console.log("Moved [%s].", file);
    });
    await Promise.all(promises);
    console.log("Finished processing TS files.");
}

async function compileTiddlyWiki() {
    console.log("Compiling TiddlyWiki.")
    try {
        await runBuildCmd("node", ["./tiddlywiki.js", "editions/tw5.com", "--build", "index"], {
            "cwd": TW5_DIR
        })
        console.log("Compiled TiddlyWiki.");
    } catch (err) {
        console.error("Error running TW5 build script.");
    }
}

async function withPluginInInfoFile(cb) {
    const filePath = path.join(TW5_COM_DIR, "tiddlywiki.info");
    const fileStr = await fs.readFile(filePath, "utf8");
    const fileJson = JSON.parse(fileStr);

    fileJson.plugins.push("slaymaker1907/browser-nativesaver");
    const newStr = JSON.stringify(fileJson);
    try {
        await fs.writeFile(filePath, newStr, "utf8");
        await cb();
    } finally {
        await fs.writeFile(filePath, fileStr, "utf8");
    }
}

async function main() {
    const createPluginDirPromise = mkdirp(PLUGIN_DIR);
    const plainPromise = movePlainTiddlers(createPluginDirPromise);
    const tsPromise = moveTSTiddlers(createPluginDirPromise);
    await Promise.all([plainPromise, tsPromise]);

    // Don't do this till the end to try and keep atomicity.
    await withPluginInInfoFile(async () =>  {
        await compileTiddlyWiki();
    });
}

main().then(() => {
    console.log("Moved files successfully.");
}, err => {
    console.error("Could not move files.");
    console.error(err);
    console.trace();
});
