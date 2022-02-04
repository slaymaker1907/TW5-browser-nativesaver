# TW5-fsa-saver

If you just want to install the plugin, download [example-wiki.html](./example-wiki.html)
and import into your wiki.

On startup, a modal is displayed with file saver settings. Note that it
is recommended to leave the consistency check on. This helps avoid concurrent
writes such as happens when the same wiki is open in separate tabs.

Allowing IndexedDB usage when the wiki is loaded from file:// instead
of a webserver is a potential security issue. Chromium based browsers
consider every page from file:// to be the same origin. This means if you
open an untrusted html file, it could read/write to your wiki file. Note
that this requires you to explicitly download the html page and then
open it from your file system. Merely going to a webpage served via http(s)
is not enough to exploit this vulnerability.

It is recommended to backup the location where you store your wiki regularly.
However, the single file with versioned backup saver style saves each version
of your wiki under /{selected folder}/backups/{wiki filename/{version hash}.html.

# Updating TW5 Version

This project uses git-subtree to sync with TiddlyWiki 5 as described
in https://www.atlassian.com/git/tutorials/git-subtree.

## Adding Remote

Add the TiddlyWiki5 remote via

```
git remote add tw5 git@github.com:Jermolene/TiddlyWiki5.git
```

## Fetch Changes From Remote

```
git fetch tw5 master
git subtree pull --prefix TiddlyWiki5 tw5 master --squash
```

# Building

1. Run `npm install`
2. Run `node ./build.js`
3. Open `./TiddlyWiki5/editions/tw5.com/output/index.html`
4. Click and drag plugin icon to install in another wiki.
