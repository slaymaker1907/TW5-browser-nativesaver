/*\
title: $:/plugins/tiddlywiki/browser-storage/rawmarkup.js
type: application/javascript
module-type: library

Startup code injected as raw markup

\*/

(function() {

// Need to initialise these because we run before bootprefix.js and boot.js
$tw = window.$tw || Object.create(null);
$tw.hooks = $tw.hooks || { names: {}};
$tw.boot = $tw.boot || {};
$tw.boot.preloadDirty = $tw.boot.preloadDirty || [];

// Hook the point in the startup process when the tiddlers have been loaded but plugins not unpacked
var hookName = "th-boot-tiddlers-loaded";
if(Object.prototype.hasOwnProperty.call($tw.hooks.names,hookName)) {
	$tw.hooks.names[hookName].push(hookBootTiddlersLoaded);
} else {
	$tw.hooks.names[hookName] = [hookBootTiddlersLoaded];
}

// Load tiddlers from browser storage
function hookBootTiddlersLoaded() {
	var url = window.location.pathname,
		log = [];
	// Check that browser storage is available
	try {
		window.localStorage;
	} catch(e) {
		return;
	}
	// Step through each browsder storage item
	for(var index=0; index<window.localStorage.length; index++) {
		var key = window.localStorage.key(index),
			parts = key.split("#");
		// If it's ours
		if(parts[0] === "tw5" && parts[1] === url) {
			// Read it as JSON
			var jsonString = window.localStorage.getItem(key),
				jsonData;
			if(jsonString) {
				try {
					jsonData = JSON.parse(jsonString);
				} catch(e) {}
				if(jsonData) {
					// Convert it to a tiddler
					var incomingTiddler = new $tw.Tiddler(jsonData);
					if(incomingTiddler) {
						// Get any existing tiddler
						var title = incomingTiddler.fields.title,
							existingTiddler = $tw.wiki.getTiddler(title);
						if(existingTiddler && existingTiddler.isEqual(incomingTiddler)) {
							// If the incoming tiddler is the same as the existing then we can delete the local storage version
							window.localStorage.removeItem(key);
						} else {
							$tw.wiki.addTiddler(incomingTiddler);
							log.push(title);
						}
					}
				}
			}
		}
	}
	// Make sure that all the tiddlers we've loaded are marked as dirty at startup
	Array.prototype.push.apply($tw.boot.preloadDirty,log);
	// Save the log
	$tw.wiki.addTiddler({
		title: "$:/temp/BrowserStorage/Log",
		text: $tw.utils.stringifyList(log)
	});
}

})();
