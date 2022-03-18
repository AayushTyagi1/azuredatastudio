/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ICellModel, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Event } from 'vs/base/common/event';

export type CellChangeEventType = 'hide' | 'insert' | 'active' | 'execution' | 'update';
export type CardChangeEventType = 'delete' | 'insert' | 'update';

export type CellChangeEvent = {
	cell: ICellModel,
	event: CellChangeEventType
};

export type CardChangeEvent = {
	card: INotebookViewCard,
	event: CardChangeEventType
};

export interface INotebookViewsTab {
	title: string,
	guid: string,
	cell: INotebookViewCell
}

export type TabContentType = 'cell';

export interface TabContent {
	type: TabContentType,
	content: any
}

export interface INotebookViews {
	onViewDeleted: Event<void>;
	onActiveViewChanged: Event<void>;

	metadata: INotebookViewMetadata;
	notebook: INotebookModel;

	createNewView(name?: string): INotebookView;
	removeView(guid: string): void;
	generateDefaultViewName(): string;
	getViews(): INotebookView[];
	getActiveView(): INotebookView;
	setActiveView(view: INotebookView);
	viewNameIsTaken(name: string): boolean;
}

export interface INotebookView {
	readonly guid: string;
	readonly onDeleted: Event<INotebookView>;
	readonly onCellVisibilityChanged: Event<ICellModel>;

	cards: INotebookViewCard[];
	isNew: boolean;
	cells: Readonly<ICellModel[]>;
	hiddenCells: Readonly<ICellModel[]>;
	displayedCells: Readonly<ICellModel[]>;
	name: string;
	initialize(isNew?: boolean): void;
	nameAvailable(name: string): boolean;
	getCellMetadata(cell: ICellModel): INotebookViewCell;
	hideCell(cell: ICellModel): void;
	moveCell(cell: ICellModel, x: number, y: number): void;
	moveTab(tab: INotebookViewsTab, index: number, card: INotebookViewCard);
	compactCells();
	resizeCell(cell: ICellModel, width: number, height: number): void;
	getCell(guid: string): Readonly<ICellModel>;
	insertCell(cell: ICellModel): void;
	markAsViewed(): void;
	save(): void;
	delete(): void;
}

export interface INotebookViewCard {
	readonly guid?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	tabs?: INotebookViewsTab[];
	activeTab?: INotebookViewsTab;
}

export interface INotebookViewCell {
	readonly guid?: string;
	hidden?: boolean;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

/*
 * Represents the metadata that will be stored for the
 * view at the notebook level.
 */
export interface INotebookViewMetadata {
	version: number;
	activeView: string;
	views: INotebookView[];
}

/*
 * Represents the metadata that will be stored for the
 * view at the cell level.
 */
export interface INotebookViewCellMetadata {
	views: INotebookViewCell[];
}
