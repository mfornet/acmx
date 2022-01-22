import * as vscode from "vscode";
import { VSToWebViewMessage, WebviewToVSEvent } from "./types";
import runAllAndSave from "./processRunAll";
import { getAutoShowJudgePref, getRetainWebviewContextPref } from "./types";

import {
    getProblemForDocument,
    SubmitProblem,
    saveProblem,
    AddProblem,
    deleteProblemFile,
    deleteProblemCase,
    setOnlineJudgeEnv,
    selectProblemCase,
} from "./core";
import { runSingleAndSave } from "./processRunSingle";

class JudgeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "cph.judgeView";

    private _view?: vscode.WebviewView;

    private messageBuffer: VSToWebViewMessage[] = [];

    public isViewUninitialized() {
        return this._view === undefined;
    }

    public isViewVisible() {
        return this._view?.visible;
    }

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            async (message: WebviewToVSEvent) => {
                console.log("Got from webview", message);
                switch (message.command) {
                    case "run-single-and-save": {
                        const problem = message.problem;
                        const id = message.id;
                        runSingleAndSave(problem, id);
                        break;
                    }

                    case "run-all-and-save": {
                        const problem = message.problem;
                        runAllAndSave(problem);
                        break;
                    }

                    case "save": {
                        saveProblem(message.problem.srcPath, message.problem);
                        break;
                    }

                    case "kill-running": {
                        // killRunning();
                        break;
                    }

                    case "select-case": {
                        selectProblemCase(message.problem.srcPath, message.id);
                        break;
                    }

                    case "delete-tcs": {
                        if (message.id) {
                            deleteProblemCase(
                                message.problem.srcPath,
                                message.id
                            );
                            break;
                        }
                        this.extensionToJudgeViewMessage({
                            command: "new-problem",
                            problem: undefined,
                        });
                        deleteProblemFile(message.problem.srcPath);
                        break;
                    }

                    case "submitCf": {
                        SubmitProblem(message.problem);
                        break;
                    }
                    case "submitKattis": {
                        // submitKattisProblem(message.problem);
                        break;
                    }

                    case "online-judge-env": {
                        setOnlineJudgeEnv(message.value);
                        break;
                    }

                    case "get-initial-problem": {
                        this.getInitialProblem();
                        break;
                    }

                    case "create-local-problem": {
                        AddProblem();
                        break;
                    }

                    default: {
                        console.error("Unknown event received from webview");
                    }
                }
            }
        );
    }

    private getInitialProblem() {
        const doc = vscode.window.activeTextEditor?.document;
        this.extensionToJudgeViewMessage({
            command: "new-problem",
            problem: getProblemForDocument(doc),
        });

        // also load any messages from before that were lost.
        this.messageBuffer.forEach((message) => {
            console.log("Restored buffer command", message.command);
            this._view?.webview.postMessage(message);
        });

        this.messageBuffer = [];

        return;
    }

    public problemPath: string | undefined;

    public async focus() {
        console.log("focusing");
        if (!this._view) {
            await vscode.commands.executeCommand("cph.judgeView.focus");
        } else {
            this._view.show?.(true);
        }
    }

    private focusIfNeeded = (message: VSToWebViewMessage) => {
        console.log(message.command);

        switch (message.command) {
            case "waiting-for-submit":
            case "compiling-start":
            case "run-all": {
                this.focus();
            }
        }

        if (
            message.command === "new-problem" &&
            message.problem !== undefined &&
            getAutoShowJudgePref()
        ) {
            this.focus();
        }
    };

    /** Posts a message to the webview. */
    public extensionToJudgeViewMessage = async (
        message: VSToWebViewMessage
    ) => {
        this.focusIfNeeded(message);
        if (
            (this._view && this._view.visible) ||
            (this._view && getRetainWebviewContextPref())
        ) {
            // Always focus on the view whenever a command is posted. Meh.
            // this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
            this._view.webview.postMessage(message);
            if (message.command !== "submit-finished") {
                console.log("View got message", message);
            }
            if (message.command === "new-problem") {
                if (message.problem === undefined) {
                    this.problemPath = undefined;
                } else {
                    this.problemPath = message.problem.srcPath;
                }
            }
        } else {
            if (message.command !== "new-problem") {
                console.log("Pushing to buffer", message.command);
                this.messageBuffer.push(message);
            } else {
                this.messageBuffer = [];
            }
        }
    };

    private _getHtmlForWebview(webview: vscode.Webview) {
        const css = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "dist", "app.css")
        );

        const js = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "dist",
                "frontend.module.js"
            )
        );

        const html = `
            <!DOCTYPE html lang="EN">
            <html>
                <head>
                    <link rel="stylesheet" href="${css}" />
                    <meta charset="UTF-8" />
                </head>
                <body>
                    <div id="app">
                        An error occurred! Restarting VS Code may solve the
                        issue. If not, please
                        <a href="https://github.com/mfornet/acmx/issues"
                            >report the bug on GitHub</a
                        >.
                    </div>
                    <script>
                        // Since the react script takes time to load, the problem is sent to the webview before it has even loaded.
                        // So, for the initial request, ask for it again.
                        const vscodeApi = acquireVsCodeApi();
                        document.addEventListener(
                            'DOMContentLoaded',
                            (event) => {
                                vscodeApi.postMessage({
                                    command: 'get-initial-problem',
                                });
                                vscodeApi.postMessage({
                                    command: 'online-judge-env',
                                    value:false,
                                });
                                console.log("Requested initial problem");
                            },
                        );
                    </script>
                    <script src="${js}"></script>
                </body>
            </html>
        `;

        return html;
    }
}

export default JudgeViewProvider;
