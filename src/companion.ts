import * as vscode from 'vscode';
import { newProblemFromCompanion } from './core';

const app = require('express')();
const bodyParser = require('body-parser');

export function startCompetitiveCompanionService() {
    let _port: number | undefined = vscode.workspace.getConfiguration('acmx.companion', null).get('port');
    let port: number = _port!;

    app.use(bodyParser.json());

    app.post('/', async (req: any, res: any) => {
        const data = req.body;

        res.sendStatus(200);
        let contestPath = newProblemFromCompanion(data);
        await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(contestPath));
    });

    app.listen(port, (err: any) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        console.log(`Listening on port ${port}.`);
    });
}