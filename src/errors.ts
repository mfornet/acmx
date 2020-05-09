import * as vscode from "vscode";

import { debug } from "./utils";
import { Execution, ATTIC } from "./primitives";
import { join } from "path";
import { openSync, writeSync } from "fs";

/**
 * Check if the execution failed and show relevant error.
 * Run after preRun.
 *
 * @param code Code to compile
 * @param path Path of the problem
 * @param execution Execution result
 */
export function onCompilationError(
    code: string,
    path: string,
    execution: Execution
) {
    debug("compile-error", `Compilation error ${code}`);
    vscode.window.showErrorMessage(`Compilation Error. ${code}`);
    showCompileError(path, execution.stderr().toString("utf8"));
}

export function showCompileError(path: string, compileError: string) {
    let errorPath = join(path, ATTIC, "stderr");
    let errorFile = openSync(errorPath, "w");
    writeSync(errorFile, compileError);
    vscode.commands.executeCommand("vscode.setEditorLayout", {
        orientation: 1,
        groups: [
            { groups: [{}], size: 0.5 },
            { groups: [{}], size: 0.5 },
        ],
    });

    vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(errorPath),
        vscode.ViewColumn.Two
    );
}
