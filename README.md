# TW5-fsa-saver

If you just want to install the plugin, download [example-wiki.html](./example-wiki.html)
and import into your wiki.

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
