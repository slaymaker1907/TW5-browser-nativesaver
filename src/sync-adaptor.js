/*\
title: $:/plugins/slaymaker1907/browser-nativesaver/sync-adaptor.js
type: application/javascript
module-type: syncadaptor

Adaptor for saving individual servers in a directory

\*/
const saver = require("$:/plugins/slaymaker1907/browser-nativesaver/saver.js");

const isNode = (typeof window) === "undefined";

// Don't expose syncadaptor unless we are in the browser.
// Can also disable the adaptor completely by commenting this out.
if (!isNode) {
	module.exports = {
		adaptorClass: saver.syncAdaptor
	};
}
