/*\
title: $:/core/modules/filters/is/variable.js
type: application/javascript
module-type: isfilteroperator

Filter function for [is[variable]]

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

/*
Export our filter function
*/
exports.variable = function(source,prefix,options) {
	var results = [];
	if(prefix === "!") {
		source(function(tiddler,title) {
			if(!(title in options.widget.variables)) {
				results.push(title);
			}
		});
	} else {
		source(function(tiddler,title) {
			if(title in options.widget.variables) {
				results.push(title);
			}
		});
	}
	return results;
};

})();
