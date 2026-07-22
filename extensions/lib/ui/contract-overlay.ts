import type { Theme } from "@earendil-works/pi-coding-agent";
import {
	type KeyId,
	matchesKey,
	truncateToWidth,
} from "@earendil-works/pi-tui";
import { OVERLAY } from "../strings";
import type { GoalState } from "../types";
import {
	coreRows,
	evidenceRows,
	headerLines,
	optionalRows,
} from "./overlay-rows";

const closeKeys: KeyId[] = ["escape", "ctrl+c"];

const buildLines = (s: GoalState, theme: Theme, width: number): string[] => {
	const close = truncateToWidth(`  ${theme.fg("dim", OVERLAY.close)}`, width);
	return [
		...headerLines(theme, width),
		...coreRows(s, theme, width),
		...optionalRows(s, theme, width),
		"",
		...evidenceRows(s, theme, width),
		close,
		"",
	];
};

export class ContractOverlay {
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		private readonly s: GoalState,
		private readonly theme: Theme,
		private readonly close: () => void,
	) {}

	handleInput(data: string): void {
		if (closeKeys.some((k) => matchesKey(data, k))) this.close();
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
		this.cachedLines = buildLines(this.s, this.theme, width);
		this.cachedWidth = width;
		return this.cachedLines;
	}

	invalidate(): void {
		this.cachedLines = undefined;
		this.cachedWidth = undefined;
	}

	dispose(): void {}
}
