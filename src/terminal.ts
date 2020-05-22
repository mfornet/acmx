"use strict";
import * as vscode from "vscode";

function getTerminal(name: string) {
    let target = undefined;

    vscode.window.terminals.forEach((value) => {
        if (value.name === name) {
            target = value;
        }
    });

    if (target === undefined) {
        target = vscode.window.createTerminal(name);
    }

    return target;
}

export function acmxTerminal() {
    return getTerminal("acmx");
}

export function hideTerminals() {
    vscode.window.terminals.forEach((ter) => {
        ter.hide();
    });
}
