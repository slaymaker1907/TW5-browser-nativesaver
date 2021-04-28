/*\
title: test-prefixes-filters.js
type: application/javascript
tags: [[$:/tags/test-spec]]
Tests the reduce prefix and filter.
\*/
(function(){

/* jslint node: true, browser: true */
/* eslint-env node, browser, jasmine */
/* eslint no-mixed-spaces-and-tabs: ["error", "smart-tabs"]*/
/* global $tw, require */
"use strict";

describe("general filter prefix tests", function() {
	it("should handle nonexistent prefixes gracefully", function() {
		var wiki = new $tw.Wiki();
		var results = wiki.filterTiddlers("[tag[A]] :nonexistent[tag[B]]");
		expect(results).toEqual(["Filter Error: Unknown prefix for filter run"]);
	});

	// Test filter run prefix parsing
	it("should parse filter run prefix suffixes", function() {

		// two runs, one with a named prefix but no suffix
		expect($tw.wiki.parseFilter("[[Sparkling water]tags[]] :intersection[[Red wine]tags[]]")).toEqual(
			[
				{
					"prefix": "",
					"operators": [
						{
							"operator": "title",
							"operands": [
								{
									"text": "Sparkling water"
								}
							]
						},
						{
							"operator": "tags",
							"operands": [
								{
									"text": ""
								}
							]
						}
					]
				},
				{
					"prefix": ":intersection",
					"operators": [
						{
							"operator": "title",
							"operands": [
								{
									"text": "Red wine"
								}
							]
						},
						{
							"operator": "tags",
							"operands": [
								{
									"text": ""
								}
							]
						}
					],
					"namedPrefix": "intersection"
				}
			]
		);

		// named prefix with no suffix
		expect($tw.wiki.parseFilter(":reduce[multiply<accumulator>]")).toEqual(
			[
				{
					"prefix": ":reduce",
					"operators": [
						{
							"operator": "multiply",
							"operands": [
								{
									"variable": true,
									"text": "accumulator"
								}
							]
						}
					],
					"namedPrefix": "reduce"
				}
			]
		);

		//named prefix with one simple suffix
		expect($tw.wiki.parseFilter(":reduce:1[multiply<accumulator>]")).toEqual(
			[
				{
					"prefix": ":reduce:1",
					"operators": [
						{
							"operator": "multiply",
							"operands": [
								{
									"variable": true,
									"text": "accumulator"
								}
							]
						}
					],
					"namedPrefix": "reduce",
					"suffixes": [
						[
							"1"
						]
					]
				}
			]
		);

		//named prefix with two simple suffixes
		expect($tw.wiki.parseFilter(":reduce:1:hello[multiply<accumulator>]")).toEqual(
			[
				{
					"prefix": ":reduce:1:hello",
					"operators": [
						{
							"operator": "multiply",
							"operands": [
								{
									"variable": true,
									"text": "accumulator"
								}
							]
						}
					],
					"namedPrefix": "reduce",
					"suffixes": [
						[
							"1"
						],
						[
							"hello",
						]
					]
				}
			]
		);

		//named prefix with two rich (comma separated) suffixes
		expect($tw.wiki.parseFilter(":reduce:1,one:hello,there[multiply<accumulator>]")).toEqual(
			[
				{
					"prefix": ":reduce:1,one:hello,there",
					"operators": [
						{
							"operator": "multiply",
							"operands": [
								{
									"variable": true,
									"text": "accumulator"
								}
							]
						}
					],
					"namedPrefix": "reduce",
					"suffixes": [
						[
							"1",
							"one"
						],
						[
							"hello",
							"there"
						]
					]
				}
			]
		);
		
		// suffixes with spaces
		expect($tw.wiki.parseFilter(":reduce: 1, one:hello, there [multiply<accumulator>]")).toEqual(
			[
				{
					"prefix": ":reduce: 1, one:hello, there ",
					"operators": [
						{
							"operator": "multiply",
							"operands": [
								{
									"variable": true,
									"text": "accumulator"
								}
							]
						}
					],
					"namedPrefix": "reduce",
					"suffixes": [
						[
							"1",
							"one"
						],
						[
							"hello",
							"there"
						]
					]
				}
			]
		);

	});	

});

describe("'reduce' and 'intersection' filter prefix tests", function() {

	var wiki = new $tw.Wiki();

	wiki.addTiddler({
		title: "Brownies",
		text: "//This is a sample shopping list item for the [[Shopping List Example]]//",
		tags: ["shopping","food"],
		price: "4.99",
		quantity: "1"
	});
	wiki.addTiddler({
		title: "Chick Peas",
		text: "//This is a sample shopping list item for the [[Shopping List Example]]//",
		tags: ["shopping","food"],
		price: "1.32",
		quantity: "5"
	});
	wiki.addTiddler({
		title: "Milk",
		text: "//This is a sample shopping list item for the [[Shopping List Example]]//",
		tags: ["shopping", "dairy", "drinks"],
		price: "0.46",
		quantity: "12"
	});
	wiki.addTiddler({
		title: "Rice Pudding",
		price: "2.66",
		quantity: "4",
		tags: ["shopping", "dairy"],
		text: "//This is a sample shopping list item for the [[Shopping List Example]]//"
	});
	wiki.addTiddler({
		title: "Sparkling water",
		tags: ["drinks", "mineral water", "textexample"],
		text: "This is some text"
	});
	wiki.addTiddler({
		title: "Red wine",
		tags: ["drinks", "wine", "textexample"],
		text: "This is some more text"
	});
	wiki.addTiddler({
		title: "Cheesecake",
		tags: ["cakes", "food", "textexample"],
		text: "This is even even even more text"
	});
	wiki.addTiddler({
		title: "Chocolate Cake",
		tags: ["cakes", "food", "textexample"],
		text: "This is even more text"
	});

	it("should handle the :reduce filter prefix", function() {
		expect(wiki.filterTiddlers("[tag[shopping]] :reduce[get[quantity]add<accumulator>]").join(",")).toBe("22");
		expect(wiki.filterTiddlers("[tag[shopping]] :reduce[get[price]multiply{!!quantity}add<accumulator>]").join(",")).toBe("27.75");
		expect(wiki.filterTiddlers("[tag[shopping]] :reduce[<index>compare:number:gt[0]then<accumulator>addsuffix[, ]addsuffix<currentTiddler>else<currentTiddler>]").join(",")).toBe("Brownies, Chick Peas, Milk, Rice Pudding");
		// Empty input should become empty output
		expect(wiki.filterTiddlers("[tag[non-existent]] :reduce[get[price]multiply{!!quantity}add<accumulator>]").length).toBe(0);
		expect(wiki.filterTiddlers("[tag[non-existent]] :reduce[get[price]multiply{!!quantity}add<accumulator>] :else[[0]]").join(",")).toBe("0");
		
		expect(wiki.filterTiddlers("[tag[non-existent]] :reduce:11,22[get[price]multiply{!!quantity}add<accumulator>] :else[[0]]").join(",")).toBe("0");

		expect(wiki.filterTiddlers("[tag[non-existent]] :reduce:11[get[price]multiply{!!quantity}add<accumulator>] :else[[0]]").join(",")).toBe("0");
	});

	it("should handle the reduce operator", function() {
		var widget = require("$:/core/modules/widgets/widget.js");
		var rootWidget = new widget.widget({ type:"widget", children:[ {type:"widget", children:[]} ] },
										   { wiki:wiki, document:$tw.document});
		rootWidget.makeChildWidgets();
		var anchorWidget = rootWidget.children[0];
		rootWidget.setVariable("add-price","[get[price]multiply{!!quantity}add<accumulator>]");
		rootWidget.setVariable("num-items","[get[quantity]add<accumulator>]");
		rootWidget.setVariable("join-with-commas","[<index>compare:number:gt[0]then<accumulator>addsuffix[, ]addsuffix<currentTiddler>else<currentTiddler>]");

		expect(wiki.filterTiddlers("[tag[shopping]reduce<num-items>]",anchorWidget).join(",")).toBe("22");
		expect(wiki.filterTiddlers("[tag[shopping]reduce<add-price>]",anchorWidget).join(",")).toBe("27.75");
		expect(wiki.filterTiddlers("[tag[shopping]reduce<join-with-commas>]",anchorWidget).join(",")).toBe("Brownies, Chick Peas, Milk, Rice Pudding");
		// Empty input should become empty output
		expect(wiki.filterTiddlers("[tag[non-existent]reduce<add-price>,[0]]",anchorWidget).join(",")).not.toBe("0");
		expect(wiki.filterTiddlers("[tag[non-existent]reduce<add-price>,[0]]",anchorWidget).length).toBe(0);
		expect(wiki.filterTiddlers("[tag[non-existent]reduce<add-price>else[0]]",anchorWidget).join(",")).toBe("0");
	});

	it("should handle the average operator", function() {
		expect(wiki.filterTiddlers("[tag[shopping]get[price]average[]]").join(",")).toBe("2.3575");
		expect(parseFloat(wiki.filterTiddlers("[tag[food]get[price]average[]]").join(","))).toBeCloseTo(3.155);
	});

	it("should handle the median operator", function() {
		expect(parseFloat(wiki.filterTiddlers("[tag[shopping]get[price]median[]]").join(","))).toBeCloseTo(1.99);
		expect(parseFloat(wiki.filterTiddlers("[tag[food]get[price]median[]]").join(","))).toBeCloseTo(3.155);
	});
	
	it("should handle the variance operator", function() {
		expect(parseFloat(wiki.filterTiddlers("[tag[shopping]get[price]variance[]]").join(","))).toBeCloseTo(2.92);
		expect(parseFloat(wiki.filterTiddlers("[tag[food]get[price]variance[]]").join(","))).toBeCloseTo(3.367);
		expect(wiki.filterTiddlers(" +[variance[]]").toString()).toBe("NaN");
	});

	it("should handle the standard-deviation operator", function() {
		expect(parseFloat(wiki.filterTiddlers("[tag[shopping]get[price]standard-deviation[]]").join(","))).toBeCloseTo(1.71);
		expect(parseFloat(wiki.filterTiddlers("[tag[food]get[price]standard-deviation[]]").join(","))).toBeCloseTo(1.835);
		expect(wiki.filterTiddlers(" +[standard-deviation[]]").toString()).toBe("NaN");
	});	

	it("should handle the :intersection prefix", function() {
		expect(wiki.filterTiddlers("[[Sparkling water]tags[]] :intersection[[Red wine]tags[]]").join(",")).toBe("drinks,textexample");
		expect(wiki.filterTiddlers("[[Brownies]tags[]] :intersection[[Chocolate Cake]tags[]]").join(",")).toBe("food");
		expect(wiki.filterTiddlers("[tag[shopping]] :intersection[tag[food]]").join(",")).toBe("Brownies,Chick Peas");
		expect(wiki.filterTiddlers("[tag[shopping]] :intersection[tag[drinks]]").join(",")).toBe("Milk");
		expect(wiki.filterTiddlers("[tag[shopping]] :intersection[tag[wine]]").join(",")).toBe("");
	});
	
	it("should handle the :filter prefix and filter operator", function() {
		var widget = require("$:/core/modules/widgets/widget.js");
		var rootWidget = new widget.widget({ type:"widget", children:[ {type:"widget", children:[]} ] },
										   { wiki:wiki, document:$tw.document});
		rootWidget.makeChildWidgets();
		var anchorWidget = rootWidget.children[0];
		rootWidget.setVariable("larger-than-18","[get[text]length[]compare:integer:gteq[18]]");
		expect(wiki.filterTiddlers("[tag[textexample]] :filter[get[text]length[]compare:integer:gteq[18]]",anchorWidget).join(",")).toBe("Red wine,Cheesecake,Chocolate Cake");
		expect(wiki.filterTiddlers("[tag[textexample]]",anchorWidget).join(",")).toBe("Sparkling water,Red wine,Cheesecake,Chocolate Cake");
		expect(wiki.filterTiddlers("[tag[textexample]filter<larger-than-18>]",anchorWidget).join(",")).toBe("Red wine,Cheesecake,Chocolate Cake");
	})

});

})();