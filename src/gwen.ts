import { openSync, writeSync } from "fs";
import { spawnSync } from "child_process";
import * as vscode from 'vscode';
import { TESTCASES } from "./core";
import { join } from "path";

const DEFAULT = 'import random\n\nprint(random.randint(1, 100))\n';

export function create(problemPath: string, outputPath: string) {
    let python_path: string | undefined = vscode.workspace.getConfiguration('acmx.execution', null).get('pythonPath');
    let tcPath = join(problemPath, TESTCASES);
    let exitCode = spawnSync(python_path!, ["-m", `tcgen`, "--path", `${tcPath}`, "--output", `${outputPath}`]);

    console.log("exticode:", exitCode);

    if (exitCode.status !== 0){
        let generator_fd = openSync(outputPath, 'w');
        writeSync(generator_fd, DEFAULT);
    }
}
