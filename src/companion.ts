import * as vscode from "vscode";
import { newProblemFromCompanion } from "./core";

import * as express from "express";
import bodyParser = require("body-parser");
import { debug } from "./utils";

export class CompanionConfig {
    name: string;
    group: string;
    url: string;
    memoryLimit: number;
    timeLimit: number;

    constructor(data: any) {
        this.name = data.name;
        this.group = data.group;
        this.url = data.url;
        this.memoryLimit = data.memoryLimit;
        this.timeLimit = data.timeLimit;
    }
}

export class TestCase {
    input: string;
    output: string;

    constructor(data: any) {
        this.input = data.input;
        this.output = data.output;
    }
}

export function startCompetitiveCompanionService() {
    let port = 0;
    let app = express();

    if (process.env.ACMX_TESTING === "1") {
        port = 10041; // Use this port for testing.
    } else {
        let port_: number | undefined = vscode.workspace
            .getConfiguration("acmx.companion", null)
            .get("port");
        port = port_!;
    }

    app.use(bodyParser.json());

    app.post("/", async (req: any, res: any) => {
        const data = req.body;
        let companionConfig = new CompanionConfig(data);

        let tests: TestCase[] = data.tests.map((value: any) => {
            return new TestCase(value);
        });

        res.sendStatus(200);
        let problemInContest = newProblemFromCompanion(companionConfig, tests);

        let contestPath = problemInContest.contestPath;
        let mainSolution = problemInContest.problemConfig.mainSolution.unwrapOr(
            ""
        );

        await vscode.commands
            .executeCommand("vscode.openFolder", vscode.Uri.file(contestPath))
            .then(async () => {
                await vscode.commands.executeCommand(
                    "vscode.open",
                    vscode.Uri.file(mainSolution)
                );
            });
    });

    app.listen(port, (err: any) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        debug("companion", `Started companion. Listening on port ${port}`);
    });
}
