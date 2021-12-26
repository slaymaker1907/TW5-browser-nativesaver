/*\
title: $:/plugins/slaymaker1907/browser-nativesaver/saver-controller.js
type: application/javascript
module-type: saver

Main module for saving to a file from a browser. Only Chromium based browsers currently
support the necessary APIs.

\*/
declare class IWidget {
	protected parentDomNode: IWidget;
	initialise(node: ParseTreeNode, options: WidgetOptions): void;
	render(parent: IWidget, nextSibling: IWidget): void;
	addEventListener(type: string, handler: (this: this, event: any) => boolean): void;
	refreshSelf(): void; // Seems to refresh underlying stuff for widget.
	computeAttributes(): void;
	execute(): void;
	renderChildren(parent: IWidget, nextSibling: IWidget): void;
	makeChildWidgets(): void;
	refresh(changedTiddlers: any): boolean; // Return true if changed.
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
const Widget: {new(): IWidget} = require("$:/core/modules/widgets/widget.js").widget;
const Saver: any = require("$:/plugins/slaymaker1907/browser-nativesaver/saver.js");

class ResetSaveLocationAction extends Widget {
	constructor(parseTreeNode: ParseTreeNode, options: WidgetOptions) {
		super();
		this.initialise(parseTreeNode, options);
	}

	render(parent: IWidget, nextSibling: IWidget) {
		this.parentDomNode = parent;
		this.addEventListener("ns-reset-file-saver", () => false);
		this.computeAttributes();
		this.renderChildren(parent, nextSibling);
	}

	execute() {
		this.makeChildWidgets();
	}

	refresh(changedTiddlers: any) {
		return this.refreshChildren(changedTiddlers);
	}
}
