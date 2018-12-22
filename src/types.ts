/**
 * TODO: Move all custom types to this folder
 */

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

    constructor(status: Veredict, failTcId?: string){
        this.status = status;
        this.failTcId = failTcId;
    }
}