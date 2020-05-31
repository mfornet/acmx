import * as vscode from "vscode";
import { newProblemFromCompanion } from "./core";

import * as express from "express";
import bodyParser = require("body-parser");
import { debug } from "./utils";

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

        res.sendStatus(200);
        let problmeInContest = newProblemFromCompanion(data);

        let contestPath = problmeInContest.contestPath;
        let mainSolution = problmeInContest.problemConfig.mainSolution.unwrapOr(
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

        // TODO(#21): Move to logs of the extension for debugging purposes.
        debug("companion", `Started companion. Listening on port ${port}`);
    });
}
