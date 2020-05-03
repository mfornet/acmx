import { SpawnSyncReturns } from "child_process";

export enum Verdict {
    OK, // Accepted
    WA, // Wrong Answer
    TLE, // Time Limit Exceeded
    RTE, // Runtime Error
    CE, // Compilation Error
    NO_TESTCASES,
}

export class TestCaseResult {
    status: Verdict;
    spanTime?: number;

    constructor(status: Verdict, spanTime?: number) {
        this.status = status;
        this.spanTime = spanTime;
    }
}

export class SolutionResult {
    status: Verdict;
    failTcId?: string;
    maxTime?: number;

    constructor(status: Verdict, failTcId?: string, maxTime?: number) {
        this.status = status;
        this.failTcId = failTcId;
        this.maxTime = maxTime;
    }
}

export class Problem {
    // Identifier will be used as folder name
    identifier?: string;
    name?: string;
    inputs?: string[];
    outputs?: string[];

    constructor(
        identifier?: string,
        name?: string,
        inputs?: string[],
        outputs?: string[]
    ) {
        this.identifier = identifier;
        this.name = name;
        this.inputs = inputs;
        this.outputs = outputs;
    }
}

export class Contest {
    name: string;
    problems: Problem[];

    constructor(name: string, problems: Problem[]) {
        this.name = name;
        this.problems = problems;
    }
}

export class SiteDescription {
    name: string;
    description: string;
    contestIdPlaceholder: string;
    problemIdPlaceholder: string;
    contestParser: (contestId: string) => Contest;
    problemParser: (problemId: string) => Problem;

    constructor(
        name: string,
        description: string,
        contestIdPlaceholder: string,
        problemIdPlaceholder: string,
        contestParser: (contestId: string) => Contest,
        problemParser: (problemId: string) => Problem
    ) {
        this.name = name;
        this.description = description;

        this.contestIdPlaceholder = contestIdPlaceholder;
        this.problemIdPlaceholder = problemIdPlaceholder;

        this.contestParser = contestParser;
        this.problemParser = problemParser;
    }
}

export class Execution {
    // Identifier will be used as folder name
    result: SpawnSyncReturns<Buffer>;
    timeSpan: number;
    timeout: number;

    constructor(
        result: SpawnSyncReturns<Buffer>,
        timeSpan: number,
        timeout: number
    ) {
        this.result = result;
        this.timeSpan = timeSpan;
        this.timeout = timeout;
    }

    isTLE() {
        return this.timeSpan >= this.timeout;
    }

    failed() {
        return this.result.status !== 0;
    }
}

export class LanguageCommand {
    preRun: string[];
    run: string[];

    constructor(preRun: string[], run: string[]) {
        this.preRun = preRun;
        this.run = run;
    }
}
