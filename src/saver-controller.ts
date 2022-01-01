/*\
title: $:/plugins/slaymaker1907/browser-nativesaver/saver-controller.js
type: application/javascript
module-type: widget

Provides a message catcher for manipulating the native saver.

\*/
const Widget: {new(): IWidget} = require("$:/core/modules/widgets/widget.js").widget;
const Saver: any = require("$:/plugins/slaymaker1907/browser-nativesaver/saver.js");
declare class IWidget {
	protected parentDomNode: IWidget;
	initialise(node: ParseTreeNode, options: WidgetOptions): void;
	render(parent: IWidget, nextSibling: IWidget): void;
	addEventListener(type: string, handler: (this: this, event: any) => boolean): void;
	refreshSelf(): void; // Seems to refresh underlying stuff for widget.
	computeAttributes(): {[attrName: string]: any};
	execute(): void;
	renderChildren(parent: IWidget, nextSibling: IWidget): void;
	makeChildWidgets(): void;
	refresh(changedTiddlers: any): boolean; // Return true if changed.
	refreshSelf(): void;
	refreshChildren(changedTiddlers: any): boolean; // Return true if changed.
}

interface ParseTreeNode {
}
interface WidgetOptions {
}
interface EventListener {
	type: string;
	handler: string;
}

// declare const module: {exports: any};
declare const require: (name: string) => any;
// declare const require: (name: "$:/core/modules/widgets/widget.js") => {widget: {new(): IWidget}}
// 	| ((name: "$:/plugins/slaymaker1907/browser-nativesaver/saver.js") => {widget: {new(): IWidget}});

function isObjectEmpty(obj: {[attrName: string]: any}): boolean {
	for (let _key in obj) {
		return false;
	}

	return true;
}

class SaverControllerWidget extends Widget {
	constructor(parseTreeNode: ParseTreeNode, options: WidgetOptions) {
		super();
		this.initialise(parseTreeNode, options);
	}

	render(parent: IWidget, nextSibling: IWidget) {
		this.parentDomNode = parent;
		this.computeAttributes();
		this.execute();

		this.addEventListener("ns-reset-file-saver", () => {
			Saver.getCurrentSaver().reset();
			return false;
		});

		// Only needed for listeners
		this.renderChildren(parent, nextSibling);
	}

	execute() {
		// Compute internal state here
		// this.actionMessage = this.getAttribute("$message");
		this.makeChildWidgets();
	}

	refresh(changedTiddlers: any) {
		const changed = this.computeAttributes();

		if (!isObjectEmpty(changed)) {
			this.refreshSelf();
			return true;
		} else {
			return this.refreshChildren(changedTiddlers);
		}
	}
}

module.exports ={
	nativesavercontroller: SaverControllerWidget
};
