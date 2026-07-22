import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import ts from "typescript";

const MAX_FILE_LINES = 200;
const MAX_CONSTRUCT_LINES = 30;
const MAX_NESTING = 3;
const root = join(process.cwd(), "extensions");

const sourceFiles = (directory) =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return extname(path) === ".ts" ? [path] : [];
	});

const location = (source, position) => {
	const point = source.getLineAndCharacterOfPosition(position);
	return `${source.fileName}:${point.line + 1}`;
};

const constructName = (node) => {
	if (node.name && "text" in node.name) return node.name.text;
	return ts.SyntaxKind[node.kind];
};

const isFunction = (node) =>
	ts.isFunctionDeclaration(node) ||
	ts.isFunctionExpression(node) ||
	ts.isArrowFunction(node) ||
	ts.isMethodDeclaration(node) ||
	ts.isConstructorDeclaration(node) ||
	ts.isGetAccessorDeclaration(node) ||
	ts.isSetAccessorDeclaration(node);

const increasesNesting = (node) =>
	ts.isIfStatement(node) ||
	ts.isForStatement(node) ||
	ts.isForInStatement(node) ||
	ts.isForOfStatement(node) ||
	ts.isWhileStatement(node) ||
	ts.isDoStatement(node) ||
	ts.isSwitchStatement(node) ||
	ts.isTryStatement(node) ||
	ts.isCatchClause(node);

const checkAst = (source, errors) => {
	const visit = (node, depth) => {
		let nextDepth = isFunction(node) ? 0 : depth;
		if (isFunction(node)) {
			const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
			const end = source.getLineAndCharacterOfPosition(node.end).line;
			if (end - start + 1 > MAX_CONSTRUCT_LINES) {
				errors.push(
					`${location(source, node.getStart(source))} ${constructName(node)} is ${end - start + 1} lines`,
				);
			}
		}
		if (ts.isIfStatement(node)) {
			const branchDepth = nextDepth + 1;
			visit(node.expression, nextDepth);
			visit(node.thenStatement, branchDepth);
			if (node.elseStatement) {
				visit(node.elseStatement, ts.isIfStatement(node.elseStatement) ? nextDepth : branchDepth);
			}
			return;
		}
		if (increasesNesting(node)) nextDepth += 1;
		if (nextDepth > MAX_NESTING) {
			errors.push(`${location(source, node.getStart(source))} nesting depth ${nextDepth}`);
			return;
		}
		ts.forEachChild(node, (child) => visit(child, nextDepth));
	};
	visit(source, 0);
};

const errors = [];
for (const path of sourceFiles(root)) {
	const text = readFileSync(path, "utf8");
	const lines = text.split(/\r?\n/u).length;
	if (lines > MAX_FILE_LINES) errors.push(`${path}:1 file is ${lines} lines`);
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
	checkAst(source, errors);
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exit(1);
}
console.log("structural constraints: green");
