import { existsSync, copyFileSync } from "fs";
import * as vscode from "vscode";
import { pathToStatic } from "./core";
import { join } from "path";

// TODO(#51): Use `tcgen`
export function create(outputPath: string) {
    if (!existsSync(outputPath)) {
        copyFileSync(join(pathToStatic(), "templates", "gen.py"), outputPath);
    } else {
        vscode.window.showWarningMessage(
            `Generator already exist at ${outputPath}.`
        );
    }
}
