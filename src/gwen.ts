import { openSync, writeSync } from "fs";
import { spawnSync } from "child_process";
import { TESTCASES } from "./core";
import { join } from "path";

const DEFAULT = 'import random\n\nprint(random.randint(1, 100))\n';

export function create(problemPath: string, outputPath: string) {
    let tcPath = join(problemPath, TESTCASES);
    let exitCode = spawnSync("python3", ["-m", `tcgen`, "--path", `${tcPath}`, "--output", `${outputPath}`]);

    console.log("exticode:", exitCode);

    if (exitCode.status !== 0){
        let generator_fd = openSync(outputPath, 'w');
        writeSync(generator_fd, DEFAULT);
    }
}
