/*\
title: $:/plugins/slaymaker1907/browser-nativesaver/saver.js
type: application/javascript
module-type: saver

Main module for saving to a file from a browser. Only Chromium based browsers currently
support the necessary APIs.

\*/
enum SaverCapability {
    Save = "save",
    AutoSave = "autosave",
    Download = "download"
}

enum SaverStyle {
    SingleFileVersionBackup = "single-file-version-backup",
    SingleFile = "single-file"
}

function constructEnumPredicate<RuntimeT extends string, EnumClass extends {[key: string]: RuntimeT}>(enumClass: EnumClass): (maybeEnum: string) => maybeEnum is EnumClass[keyof EnumClass] {
    const reverseMapping: {[key: string]: boolean} = {};

    for (const enumVal in enumClass) {
        const enumStr = enumClass[enumVal];
        reverseMapping[enumStr] = true;
    }

    function result(maybeEnum: any): maybeEnum is EnumClass[keyof EnumClass] {
        return !!reverseMapping[maybeEnum];
    }

    return result;
}

const isSaverStyle = constructEnumPredicate(SaverStyle);
interface SaverInfo {
    name: string;
    priority: number;
    capabilities: SaverCapability[]
}

type TWSaverCB = (err: string|null, info?: string) => void;

interface TWSaver {
    info: SaverInfo;
    save(text: string, method: SaverCapability, callback: TWSaverCB): boolean;
}

interface Tiddler {
    // Always returns a string, but may be blank.
    getFieldString(field: string): string;
}

interface TWModalManager {
    display(tiddlerTitle: string): void;
}

interface TWWiki {
    getTiddler(name: string): Tiddler|undefined;
    addTiddler(tiddler: any): void;
    modal: TWModalManager;
}

interface SaverHandler {
    wiki: TWWiki;
}

declare const module: {exports: any};

let problemEncountered = false;
const PLUGIN_NAME = "slaymaker1907/browser-nativesaver";
const BASE_TIDDLER_PATH = `$:/plugins/${PLUGIN_NAME}`;
const PLUGIN_SETTINGS_DATA = `${BASE_TIDDLER_PATH}/settings-data`
const PLUGIN_SETTINGS_TIDDLER = `${BASE_TIDDLER_PATH}/settings`
const ENABLE_LOGGING_FIELD = "enable-logging?";
const ENABLE_SAVER_FIELD = "enable-saver?";
const SAVER_STYLE_FIELD = "save-style";
const ALLOW_INDEXED_DB_FIELD = "allow-indexedDB?";
const WIKI_FILENAME_FIELD = "wiki-file-name";
const YES = "yes";
const UNIQUE_PLUGIN_ID = "QqiTNHy4qkN9TtIYbd5i";
const WELCOME_PAGE = "$:/plugins/slaymaker1907/browser-nativesaver/welcome";
const BACKUP_FOLDER_NAME = "backups";

let logDebug = console.log;

const setupLogging = (wiki: TWWiki) => {
    try {
        const tiddler = wiki.getTiddler(PLUGIN_SETTINGS_DATA);
        if (!tiddler) {
            return;
        }

        const fieldValue = tiddler.getFieldString(ENABLE_LOGGING_FIELD);
        if (fieldValue === YES) {
            logDebug = console.log;
        } else {
            logDebug = () => {};
        }
    } catch (err) {
        console.error("Could not initialize logging due to error: %o", err);
    }
};

const isEnabled = (wiki: TWWiki) => {
    return wiki.getTiddler(PLUGIN_SETTINGS_DATA)!.getFieldString(ENABLE_SAVER_FIELD) === YES;
};

function getSaverStyle(wiki: TWWiki): SaverStyle {
    try {
        const maybeSaverStyle = wiki.getTiddler(PLUGIN_SETTINGS_DATA)!.getFieldString(SAVER_STYLE_FIELD);
        if (isSaverStyle(maybeSaverStyle)) {
            return maybeSaverStyle;
        } else {
            logDebug("Input saver style [%s] is not recognized, using default of SingleFile.", maybeSaverStyle);
            return SaverStyle.SingleFile;
        }
    } catch(err) {
        console.error("Error checking if versioning is enabled, using single file style.");
        console.error(err);
        return SaverStyle.SingleFile;
    }
};

const isServedFromFS = () => {
    try {
        const protocol = window.location.protocol;
        logDebug("TiddlyWiki location protocol is [%o]", protocol);
        return protocol.startsWith
    } catch (err) {
        logDebug("Error occurred trying to determine protocol for TiddlyWiki: %o", err);
        logDebug("Assuming that it is file:/ to maximimize security");
    }
};

function canUseIndexedDB(wiki: TWWiki): boolean {
    return !isServedFromFS() || wiki.getTiddler(PLUGIN_SETTINGS_DATA)!.getFieldString(ALLOW_INDEXED_DB_FIELD) === YES;
}

/**
 * Converts an IDBRequest to an equivalent Promise.
 */
function idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            try {
                resolve(request.result);
            } catch (err) {
                // This is possible only on incorrect API usage, but just want to be safe to avoid
                // infinite loops.
                reject(err);
            }
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Return a Promise which will resolve when the transaction succeeds or
 * reject when it faild and/or aborts.
 */
const getTransactionCommitPromise = (transaction: IDBTransaction) => {
    return new Promise<void>((resolve, reject) => {
        let errorSeen = false;
        transaction.oncomplete = () => resolve();
        const errorHandler = () => {
            if (!errorSeen) {
                errorSeen = true;
                reject(transaction.error || "Transaction aborted/failed");
            }
        };
        transaction.onerror = errorHandler;
        transaction.onabort = errorHandler;
    });
};

const DB_VERSION = 1;
const DB_NAME = `FileHandles-${UNIQUE_PLUGIN_ID}`;
const DB_HANDLE_OBJECT_STORE_NAME = "FileHandles";
const CURRENT_FILE_HANDLE_NAME = "CURRENT_FILE_HANDLE";
const IDB_READWRITE = "readwrite";
const IDB_READONLY = "readonly";
const IDB_RELAXED = "relaxed";
const tryCreateHandleStore = async (wiki: TWWiki) => {
    if (!window.indexedDB) {
        const message = "Cannot save file handle across browser sessions because your browser does not support IndexedDB.";
        logDebug(message);
        return Promise.reject(message);
    } else if (!canUseIndexedDB(wiki)) {
        const message = "It is not secure to save sensitive data to IndexedDB when using the file:/ protocol.";
        logDebug(message);
        logDebug("This is a security issue because anything served via file:/ share a single origin in Chromium browsers.");
        logDebug("See https://bugs.chromium.org/p/chromium/issues/detail?id=1202597#c3 for details.")
        return Promise.reject(message);
    }

    logDebug("Browser supports IndexedDB so will attempt to create/retrieve a DB for storing a file handle.");
    const dbOpenRequest = window.indexedDB.open(DB_NAME, DB_VERSION);

    dbOpenRequest.onupgradeneeded = event => {
        logDebug("Initializing file handle DB since received event %o", event);
        const db = dbOpenRequest.result;

        // Don't specify keyPath or autoIncrement so that keys are stored separately from values which lets
        // us store any kind of value.
        const store = db.createObjectStore(DB_HANDLE_OBJECT_STORE_NAME);

        logDebug("Successfully created store %o/%o", DB_NAME, DB_HANDLE_OBJECT_STORE_NAME);
        return store;
    };

    try {
        const db = await idbRequestToPromise(dbOpenRequest);
        logDebug("Successfully opened database for storing file handles %o.", db)
        return db;
    } catch (err) {
        logDebug("Could not open database for storing file handles: %o", err);
        throw err;
    }
};

const requestFileHandle = async (startIn?: FileSystemHandle) => {
    for (let i = 0; i < 2; i++) {
        const result = await window.showSaveFilePicker({
            types: [{
                description: "HTML file",
                accept: {
                    "text/html": [
                        ".html",
                        ".htm"
                    ]
                }
            }],
            id: UNIQUE_PLUGIN_ID,
            startIn
        } as any);
        logDebug("Received file handle: %o", result)
        if (result.kind === "file") {
            return result;
        }
        alert("File input must be a file, not a directory.");
    }

    return await Promise.reject("Could not get file for saving.");
}

const requestDirectoryHandle = async (startIn?: FileSystemHandle) => {
    for (let i = 0; i < 2; i++) {
        const result = await window.showDirectoryPicker({
            id: UNIQUE_PLUGIN_ID,
            startIn
        } as any);
        logDebug("Received directory handle: %o", result)
        if (result.kind === "directory") {
            return result;
        }
        alert("File input must be a directory, not a file.");
    }

    return await Promise.reject("Could not get directory for saving.");
}

const getIndexedDBKey = async () => {
    return CURRENT_FILE_HANDLE_NAME + (await hashToString(window.location.href));
}

interface IndexedDBCacheable<T> {
    requestNew(): Promise<T>;
    oldIsValid(old: any): old is T;
}

async function getCachedHandle<T extends FileSystemHandle>(wiki: TWWiki, cacheable: IndexedDBCacheable<T>): Promise<T> {
    let transaction: IDBTransaction;
    let store: IDBObjectStore;
    let db: IDBDatabase;

    const storageKey = await getIndexedDBKey();
    logDebug("Computed storage key to be: [%s]", storageKey);

    try {
        db = await tryCreateHandleStore(wiki);
        transaction = db.transaction([DB_HANDLE_OBJECT_STORE_NAME], IDB_READONLY);
        store = transaction.objectStore(DB_HANDLE_OBJECT_STORE_NAME);
    } catch (err) {
        logDebug("Could not get handle store due to error, must request file location from user: %o", err);
        return await cacheable.requestNew();
    }
    // store must now be initialized

    const requestAndStoreNewFile = async () => {
        const handle = await cacheable.requestNew();

        logDebug("Saving handle %o to object store to avoid requests in the future", handle);
        // Don't await this and just let it execute in background since it isn't really that
        // important.
        try {
            // Have to get a new transaction because requestFileHandle puts us in a new event loop.
            transaction = db.transaction([DB_HANDLE_OBJECT_STORE_NAME], IDB_READWRITE);
            store = transaction.objectStore(DB_HANDLE_OBJECT_STORE_NAME);
            idbRequestToPromise(store.put(handle, storageKey)).then(async () => {
                await getTransactionCommitPromise(transaction);
                logDebug("Successfully saved file handle %o to object store.", handle);
            }, err => {
                logDebug("Could not save file handle %o to object store (user will have to select file once they refresh): %o",
                    handle, err);
            });
        } catch (err) {
            logDebug("Failed to initate save request for file hande due to error: %o", err);
        }

        return handle;
    };

    try {
        const maybeFileHandle = await idbRequestToPromise(store.get(storageKey));
        if (!cacheable.oldIsValid(maybeFileHandle)) {
            logDebug("No existing file handle found, must request new one");
            return await requestAndStoreNewFile();
        }

        // Explicitly request permission to readwrite to avoid permissions issues later on.
        logDebug("Found a previous file handle so try to avoid duplicate requests to user for file location %o", maybeFileHandle);
        logDebug("Requesting permission for RW on file object.");
        const status = await maybeFileHandle.requestPermission({ mode: IDB_READWRITE }); // These strings happen to be the same for IDB and files.
        logDebug("Requesting permission for RW on file returned status: %o", status);
        if (status !== "granted") {
            throw Error(`RW on file was not granted, status of the permission is: [${status}]`);
        }
        logDebug("Successfully obtained RW permission on file system object.");

        return maybeFileHandle;
    } catch (err) {
        logDebug("Could not get previous handle, must request a new one due to error: %o", err);
        return await requestAndStoreNewFile();
    }
}

const getFileHandle = (wiki: TWWiki, startHandle?: FileSystemHandle) => {
    function isFileHandle(obj: any): obj is FileSystemFileHandle {
        return obj && obj.kind === "file";
    }

    return getCachedHandle(wiki, {
        requestNew: () => requestFileHandle(startHandle),
        oldIsValid: isFileHandle
    });
}

const getDirectoryHandle = async (wiki: TWWiki, startHandle?: FileSystemHandle) => {
    function isDirectoryHandle(obj: any): obj is FileSystemDirectoryHandle {
        return obj && obj.kind === "directory"
    }

    return getCachedHandle(wiki, {
        requestNew: () => requestDirectoryHandle(startHandle),
        oldIsValid: isDirectoryHandle
    });
}

// Returns a string hash in hex for easy comparison and printing.
async function hashToString(data: string | ArrayBuffer): Promise<string> {
    let buffer: ArrayBuffer;
    if (typeof data === "string") {
        const encoder = new TextEncoder();
        buffer = encoder.encode(data);
    } else {
        buffer = data;
    }

    // Adapted from example at https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
    const hashBytes = await window.crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBytes));
    const hexChars = hashArray.map(byte => byte.toString(16))

    // Pad in case hash is small.
    return hexChars.join("").padStart(64, "0");
}

async function getWikiFileName(wiki: TWWiki): Promise<string> {
    const explicitName = wiki.getTiddler(PLUGIN_SETTINGS_DATA)!.getFieldString(WIKI_FILENAME_FIELD);

    if (!explicitName || explicitName.trim() === "") {
        const wikiButtonFilename = wiki.getTiddler("$:/config/SaveWikiButton/Filename");
        const siteTitle = wiki.getTiddler("$:/SiteTitle");

        if (wikiButtonFilename) {
            return wikiButtonFilename.getFieldString("text").trim();
        } else if (siteTitle) {
            return `${siteTitle.getFieldString("text").trim()}.html`;
        } else {
            return "index.html"
        }
    } else {
        return explicitName.trim();
    }
}

class FileSystemSaver implements TWSaver {
    public info: SaverInfo = {
        name: PLUGIN_NAME,
        priority: 100000,
        capabilities: [SaverCapability.Save, SaverCapability.AutoSave]
    };
    private initError: any = null;
    private fileHandle?: Promise<FileSystemFileHandle>;
    private prevPageHash?: Promise<string>;
    private dirHandle?: Promise<FileSystemDirectoryHandle>;
    private backupSaveProm: Promise<void> = Promise.resolve();

    constructor(private wiki: TWWiki) {
        setupLogging(wiki);
        logDebug("Constructing a FileSystemSaver");
    }

    userInteractionInit() {
        if (this.fileHandle) {
            return;
        }

        // const saverStyle = getSaverStyle(this.wiki);
        if (getSaverStyle(this.wiki) === SaverStyle.SingleFile) {
            logDebug("Attempting to get file handle.");

            this.fileHandle = getFileHandle(this.wiki);
            this.fileHandle.catch(err => {
                problemEncountered = true;
                this.initError = err;
                logDebug("Could not get file handle due to error: %o", err);
            });
        } else {
            logDebug("Attempting to get directory handle.");

            this.dirHandle = getDirectoryHandle(this.wiki);
            this.fileHandle = this.dirHandle.then(async actualDirHandle => {
                const wikiFileName = await getWikiFileName(this.wiki);
                logDebug("Filename of wiki is: %o", wikiFileName);
                return actualDirHandle.getFileHandle(wikiFileName, {
                    create: true
                });
            });
        }
    }

    async checkConsistency(newText: string) {
        if (!this.shouldCheckConsistency()) {
            logDebug("Skipping consistency check since it is disabled");
            return;
        }

        if (!this.prevPageHash) {
            logDebug("No previous known hash to compare against");
            this.prevPageHash = hashToString(newText);
            return;
        }

        const handle = await this.fileHandle!;
        logDebug("Reading current value to check consistency");
        const reader = await handle.getFile();
        const currentText = await reader.text();
        const currentHash = await hashToString(currentText);
        const prevHash = await this.prevPageHash;
        if (currentHash !== prevHash) {
            logDebug("Expected hash to be [%s] but it is currently [%s]", prevHash, currentHash);
            problemEncountered = true;
            const err = "Previous page source does not match the current text"
            return Promise.reject(err);
        }

        logDebug("Previous value matches the current value so saving is safe");
        logDebug("Computing hash of text to save...");
        this.prevPageHash = hashToString(newText);

        return {
            fileHash: currentHash,
            fileText: currentText
        };
    }

    shouldCheckConsistency() {
        return this.wiki.getTiddler(PLUGIN_SETTINGS_DATA)!.getFieldString(ENABLE_SAVER_FIELD) === YES;
    }

    async saveFile(text: string) {
        const handle = await this.fileHandle!;

        if (this.shouldCheckConsistency()) {
            await this.checkConsistency(text);
        } else {
            logDebug("Skipping consistency check");
        }

        logDebug("Creating writable...");
        const writable = await handle.createWritable();
        logDebug("Created writable");

        try {
            await writable.write(text);
            logDebug("Wrote data successfully");
        } finally {
            await writable.close();
            logDebug("Closed writable");
        }
    }

    async saveBackup(text: string) {
        const textHashProm = hashToString(text);
        const dirHandle = await this.dirHandle!;
        const backupDir = await dirHandle.getDirectoryHandle(BACKUP_FOLDER_NAME, {
            create: true
        });
        const wikiFileName = await (await this.fileHandle!).name;
        const wikiBackupDir = await backupDir.getDirectoryHandle(wikiFileName, {
            create: true
        });

        const textHash = await textHashProm;
        const backupFileName = `${textHash}.html`;
        logDebug("Backing up wiki file to %o", backupFileName);
        const backupFile = await wikiBackupDir.getFileHandle(backupFileName, {
            create: true
        });

        const backupWriter = await backupFile.createWritable();
        try {
            await backupWriter.write(text);
            logDebug("Wrote backup successfully");
        } finally {
            await backupWriter.close();
        }
    }

    async saveWithDirBackup(text: string) {
        // First start save to new folder since that doesn't overwrite anything.
        const newBackupProm = this.saveBackup(text);

        // Now wait for last backup to complete.
        await this.backupSaveProm;

        this.backupSaveProm = newBackupProm;

        return this.saveFile(text);
    }

    save(text: string, method: SaverCapability, callback: TWSaverCB) {
        setupLogging(this.wiki);
        if (!isEnabled(this.wiki)) {
            logDebug("Not saving since this saver is not enabled.");
            return false;
        }

        logDebug("Saving with method %o", method);
        this.userInteractionInit();

        if (this.initError !== null) {
            logDebug("Encountered init, can't save");
            callback(this.initError);
            return false;
        }

        const saverStyle = getSaverStyle(this.wiki);
        let savePromise: Promise<void>;
        switch (saverStyle) {
            case SaverStyle.SingleFile:
                savePromise = this.saveFile(text);
                break;
            case SaverStyle.SingleFileVersionBackup:
                savePromise = this.saveWithDirBackup(text);
                break;
            default:
                callback(`Unsupported SaverStyle: [${saverStyle}]`);
                return false;
        }

        savePromise.then(() => {
            logDebug("Successfully saved to file system");
            callback(null);
        }, err => {
            problemEncountered = true;
            logDebug("Encountered error while saving: %o", err);
            callback(`Encountered error while saving to file system: [${err}]`);
        });

        return true;
    }

    reset() {
        logDebug("Reseting file saver...");
        try {
            window.indexedDB.deleteDatabase(DB_NAME);
        } catch(err) {
            logDebug("Failed to delete file save location: %o", err);
        }
        setupLogging(this.wiki);
        this.fileHandle = undefined;
        this.initError = null;
        this.prevPageHash = undefined;
        logDebug("Reset file save location.");
    }
}

// Has one parameter, wiki if necessary
const canSave = (handler: SaverHandler) => {
    try {
        setupLogging(handler.wiki);
        return isEnabled(handler.wiki) && (!!window.showOpenFilePicker) && window.isSecureContext && !problemEncountered;
    } catch(err) {
        logDebug(err);
        return false;
    }
};

let currentSaver: FileSystemSaver | null = null;

// Also has access to wiki if necessary
const create = (wiki: TWWiki) => {
    const result = new FileSystemSaver(wiki);
    currentSaver = result;

    // Wait one event cycle before trying to show the welcome page.
    window.setTimeout(() => {
        const modal = (window as any).$tw.modal as TWModalManager;
        modal.display(WELCOME_PAGE);
    }, 0);

    return result;
};

module.exports = {
    canSave,
    create,
    getCurrentSaver: () => currentSaver
};
