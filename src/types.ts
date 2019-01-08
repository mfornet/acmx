export enum Veredict{
    OK,     // Accepted
    WA,     // Wrong Answer
    TLE,    // Time Limit Exceeded
    RTE,    // Runtime Error
    CE,     // Compilation Error
}

export class TestcaseResult{
    status: Veredict;
    spanTime?: number;

    constructor(status: Veredict, spanTime?: number){
        this.status = status;
        this.spanTime = spanTime;
    }
}

export class SolutionResult{
    status: Veredict;
    failTcId?: string;
    maxTime?: number;

    constructor(status: Veredict, failTcId?: string, maxTime?: number){
        this.status = status;
        this.failTcId = failTcId;
        this.maxTime = maxTime;
    }
}

export class Problem{
    name?: string;
    inputs?: string[];
    outputs?: string[];

    constructor(name?: string, inputs?: string[], outputs?: string[]){
        this.name = name;
        this.inputs = inputs;
        this.outputs = outputs;
    }
}

export class Contest{
    problems?: Problem[];

    constructor(problems?: Problem[]){
        this.problems = problems;
    }
}

export class SiteDescription{
    name: string;
    description: string;
    contestParser: (contestId: string | number) => Contest;
    problemParser: (problemId: string) => Problem;

    constructor(name: string, description: string, contestParser: (contestId: string | number) => Contest, problemParser: (problemId: string) => Problem){
        this.name = name;
        this.description = description;
        this.contestParser = contestParser;
        this.problemParser = problemParser;
    }
}