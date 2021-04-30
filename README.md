# TW5-fsa-saver

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
