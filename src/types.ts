export enum Verdict{
    OK,     // Accepted
    WA,     // Wrong Answer
    TLE,    // Time Limit Exceeded
    RTE,    // Runtime Error
    CE,     // Compilation Error
    NO_TESTCASES,
}

export class TestcaseResult{
    status: Verdict;
    spanTime?: number;

    constructor(status: Verdict, spanTime?: number){
        this.status = status;
        this.spanTime = spanTime;
    }
}

export class SolutionResult{
    status: Verdict;
    failTcId?: string;
    maxTime?: number;

    constructor(status: Verdict, failTcId?: string, maxTime?: number){
        this.status = status;
        this.failTcId = failTcId;
        this.maxTime = maxTime;
    }
}

export class Problem{
    // Identifier will be used as folder name
    identifier?: string;
    name?: string;
    inputs?: string[];
    outputs?: string[];

    constructor(identifier?: string, name?: string, inputs?: string[], outputs?: string[]){
        this.identifier = identifier;
        this.name = name;
        this.inputs = inputs;
        this.outputs = outputs;
    }
}

export class Contest{
    name: string;
    problems: Problem[];

    constructor(name: string, problems: Problem[]){
        this.name = name;
        this.problems = problems;
    }
}

export class SiteDescription{
    name: string;
    description: string;
    contestIdPlaceholder: string;
    problemIdPlaceholder: string;
    contestParser: (contestId: string) => Promise<Contest>;
    problemParser: (problemId: string) => Promise<Problem>;

    constructor(name: string, description: string,
                contestIdPlaceholder: string, problemIdPlaceholder: string,
                contestParser: (contestId: string) => Promise<Contest>,
                problemParser: (problemId: string) => Promise<Problem>){
        this.name = name;
        this.description = description;

        this.contestIdPlaceholder = contestIdPlaceholder;
        this.problemIdPlaceholder = problemIdPlaceholder;

        this.contestParser = contestParser;
        this.problemParser = problemParser;
    }
}