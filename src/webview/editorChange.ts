import * as vscode from "vscode";
import { getJudgeViewProvider } from "../extension";

import { getAutoShowJudgePref } from "./types";
import { setOnlineJudgeEnv, getProblemForDocument } from "./core";

/**
 * Show the webview with the problem details if a source code with existing
 * saved problem is opened. If switch is to an invalid document of unsaved
 * problem, closes the active webview, if any.
 *
 * @param e An editor
 * @param context The activation context
 */
export const editorChanged = async (e: vscode.TextEditor | undefined) => {
    console.log("Changed editor to", e?.document.fileName);

    if (e === undefined) {
        getJudgeViewProvider().extensionToJudgeViewMessage({
            command: "new-problem",
            problem: undefined,
        });
        setOnlineJudgeEnv(false); // reset the non-debug mode set in webview.
        return;
    }

    if (e.document.uri.scheme !== "file") {
        return;
    }

    setOnlineJudgeEnv(false); // reset the non-debug mode set in webview.

    const problem = getProblemForDocument(e.document);

    if (problem === undefined) {
        getJudgeViewProvider().extensionToJudgeViewMessage({
            command: "new-problem",
            problem: undefined,
        });
        return;
    }

    if (
        getAutoShowJudgePref() &&
        getJudgeViewProvider().isViewUninitialized()
    ) {
        vscode.commands.executeCommand("cph.judgeView.focus");
    }

    console.log("Sent problem @", Date.now());
    getJudgeViewProvider().extensionToJudgeViewMessage({
        command: "new-problem",
        problem,
    });
};

export const editorClosed = (e: vscode.TextDocument) => {
    console.log("Closed editor:", e.uri.fsPath);
    const srcPath = e.uri.fsPath;

    if (getJudgeViewProvider().problemPath === srcPath) {
        getJudgeViewProvider().extensionToJudgeViewMessage({
            command: "new-problem",
            problem: undefined,
        });
    }
};

export const checkLaunchWebview = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    editorChanged(editor);
};
