import * as vscode from "vscode";

import { debug } from "./utils";
import { Execution } from "./primitives";

/**
 * Check if the execution failed and show relevant error.
 * Run after preRun.
 *
 * @param code Code to compile
 * @param path Path of the problem
 * @param execution Execution result
 */
export function onCompilationError(code: string, execution: Execution) {
    debug("compile-error", `Compilation error ${code}`);
    vscode.window.showErrorMessage(`Compilation Error. ${code}`);
    showCompileError(execution.stderr().toString("utf8"));
}

export function showCompileError(compileError: string) {
    const writeEmitter = new vscode.EventEmitter<string>();
    const pty = {
        onDidWrite: writeEmitter.event,
        open: () => writeEmitter.fire(`${compileError.replace(/\n/g, "\n\r")}`),
    };

    vscode.window.terminals.forEach((value) => {
        if (value.name === "CompileError") {
            value.dispose();
        }
    });
    const target = (<any>vscode.window).createTerminal({
        name: "CompileError",
        pty,
    });

    target.show();
}
