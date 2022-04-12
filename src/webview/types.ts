import * as vscode from "vscode";

/** Valid name for a VS Code preference section for the extension */
export type prefSection =
    | "general.saveLocation"
    | "general.defaultLanguage"
    | "general.timeOut"
    | "general.firstTime"
    | "general.useShortCodeForcesName"
    | "general.menuChoices"
    | "language.c.Args"
    | "language.c.SubmissionCompiler"
    | "language.cpp.Args"
    | "language.cpp.SubmissionCompiler"
    | "language.rust.Args"
    | "language.rust.SubmissionCompiler"
    | "language.java.Args"
    | "language.java.SubmissionCompiler"
    | "language.python.Args"
    | "language.python.SubmissionCompiler"
    | "language.python.Command"
    | "general.retainWebviewContext"
    | "general.autoShowJudge"
    | "general.defaultLanguageTemplateFileLocation";

export function getAutoShowJudgePref(): boolean {
    const x: boolean | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("autoShowJudge");
    return x ?? true;
}

export function getRetainWebviewContextPref(): boolean {
    const x: boolean | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("retainWebviewContext");
    return x ?? false;
}

export type Language = {
    name: LangNames;
    compiler: string;
    args: string[];
    skipCompile: boolean;
};

export type LangNames = "python" | "c" | "cpp" | "rust" | "java";

export type TestCase = {
    input: string;
    output: string;
    id: number;
};

export type Problem = {
    name: string;
    url: string;
    interactive: boolean;
    memoryLimit: number;
    timeLimit: number;
    group: string;
    tests: TestCase[];
    srcPath: string;
    local?: boolean;
};

export type Case = {
    id: number;
    result: RunResult | null;
    testcase: TestCase;
};

export type Run = {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    time: number;
    timeOut: boolean;
};

export type RunResult = {
    pass: boolean | null;
    id: number;
    verdictname: string;
} & Run;

export type WebviewMessageCommon = {
    problem: Problem;
};

export type RunSingleCommand = {
    command: "run-single-and-save";
    id: number;
} & WebviewMessageCommon;

export type RunAllCommand = {
    command: "run-all-and-save";
} & WebviewMessageCommon;

export type OnlineJudgeEnv = {
    command: "online-judge-env";
    value: boolean;
};

export type KillRunningCommand = {
    command: "kill-running";
} & WebviewMessageCommon;

export type SaveCommand = {
    command: "save";
} & WebviewMessageCommon;

export type DeleteTcsCommand = {
    command: "delete-tcs";
    id: number | undefined;
} & WebviewMessageCommon;

export type SubmitCf = {
    command: "submitCf";
} & WebviewMessageCommon;

export type SubmitKattis = {
    command: "submitKattis";
} & WebviewMessageCommon;

export type GetInitialProblem = {
    command: "get-initial-problem";
};

export type CreateLocalProblem = {
    command: "create-local-problem";
};

export type SelectCase = {
    command: "select-case";
    id: number;
} & WebviewMessageCommon;

export type WebviewToVSEvent =
    | RunAllCommand
    | GetInitialProblem
    | CreateLocalProblem
    | RunSingleCommand
    | KillRunningCommand
    | SaveCommand
    | DeleteTcsCommand
    | SubmitCf
    | OnlineJudgeEnv
    | SubmitKattis
    | SelectCase;

export type RunningCommand = {
    command: "running";
    id: number;
} & WebviewMessageCommon;

export type ResultCommand = {
    command: "run-single-result";
    result: RunResult;
} & WebviewMessageCommon;

export type CompilingStartCommand = {
    command: "compiling-start";
};

export type CompilingStopCommand = {
    command: "compiling-stop";
};

export type RunAllInWebViewCommand = {
    command: "run-all";
};

export type WaitingForSubmitCommand = {
    command: "waiting-for-submit";
};

export type SubmitFinishedCommand = {
    command: "submit-finished";
};

export type NewProblemCommand = {
    command: "new-problem";
    problem: Problem | undefined;
};

export type VSToWebViewMessage =
    | ResultCommand
    | RunningCommand
    | RunAllInWebViewCommand
    | CompilingStartCommand
    | CompilingStopCommand
    | WaitingForSubmitCommand
    | SubmitFinishedCommand
    | NewProblemCommand;

export type CphEmptyResponse = {
    empty: true;
};

export type CphSubmitResponse = {
    url: string;
    empty: false;
    problemName: string;
    sourceCode: string;
    languageId: number;
};
