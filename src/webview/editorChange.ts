import * as vscode from 'vscode';
import { getJudgeViewProvider } from '../extension';
import { currentProblem } from '../core'

/**
 * Show the webview with the problem details if a source code with existing
 * saved problem is opened. If switch is to an invalid document of unsaved
 * problem, closes the active webview, if any.
 *
 * @param e An editor
 * @param context The activation context
 */
export const editorChanged = async (e: vscode.TextEditor | undefined) => {
    console.log('Changed editor to', e?.document.fileName);

    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    if (
        /*getAutoShowJudgePref()*/true &&
        getJudgeViewProvider().isViewUninitialized()
    ) {
        vscode.commands.executeCommand('cph.judgeView.focus');
    }

    console.log('Sent problem @', Date.now());
    getJudgeViewProvider().extensionToJudgeViewMessage({
        command: 'new-problem',
    });
};

export const editorClosed = (e: vscode.TextDocument) => {
    console.log('Closed editor:', e.uri.fsPath);
    
    let path_ = currentProblem();

    if (path_.isNone()) {
        getJudgeViewProvider().extensionToJudgeViewMessage({
            command: 'new-problem',
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
