import * as vscode from "vscode";

import { debug } from "./log";
import { Execution } from "./types";
import { showCompileError } from "./core";

/**
 * Check if the execution failed and show relevant error.
 * Run after pre_run.
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
    showCompileError(path, execution.result.stderr.toString());
}
