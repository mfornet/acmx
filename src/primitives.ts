import { SpawnSyncReturns } from "child_process";
import { join } from "path";
import { writeToFileSync } from "./utils";
import { readFileSync, existsSync } from "fs";
import { CompanionConfig } from "./companion";

export const ATTIC = "attic";
export const TESTCASES = "testcases";
export const LANGUAGES = "languages";
// TODO(#68): Allow checker to compile without time limit (this should be added after cancel is available).
export const FRIEND_TIMEOUT = 50_000;
export const MAIN_SOLUTION_BINARY = "sol";
export const CHECKER_BINARY = "checker";
export const BRUTE_BINARY = "brute";
export const GENERATOR_BINARY = "generator";
export const GENERATED_TEST_CASE = "gen";

export enum Verdict {
    OK, // Accepted
    WA, // Wrong Answer
    TLE, // Time Limit Exceeded
    RTE, // Runtime Error
    CE, // Compilation Error
    FAIL, // Failed. This verdict is emitted when there is a problem with checker or brute solution.
    NO_TESTCASES,
}

export class TestCaseResult {
    status: Verdict;
    spanTime?: number;
    stdout?: string;
    stderr?: string;

    constructor(
        status: Verdict,
        spanTime?: number,
        stdout?: string,
        stderr?: string
    ) {
        this.status = status;
        this.spanTime = spanTime;
        this.stdout = stdout;
        this.stderr = stderr;
    }

    isOk() {
        return this.status === Verdict.OK;
    }
}

export class SolutionResult {
    status: Verdict;
    private failTestCaseId: Option<string>;
    private maxTime: Option<number>;

    constructor(status: Verdict, failTestCaseId?: string, maxTime?: number) {
        this.status = status;
        this.failTestCaseId = new Option(failTestCaseId);
        this.maxTime = new Option(maxTime);
    }

    isOk() {
        return this.status === Verdict.OK;
    }

    /**
     * Return id from failing test case. Will throw error if isOk()
     */
    getFailTestCaseId() {
        return this.failTestCaseId.unwrap();
    }

    /**
     * Return max time among all test cases. Will throw error if !isOk()
     */
    getMaxTime() {
        return this.maxTime.unwrap();
    }
}

export class Problem {
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
    private cached: boolean;
    private result: Option<SpawnSyncReturns<Buffer>>;
    timeSpan: Option<number>;
    timeout: Option<number>;

    constructor(
        result?: SpawnSyncReturns<Buffer>,
        timeSpan?: number,
        timeout?: number,
        cached?: boolean
    ) {
        this.result = new Option(result);
        this.timeSpan = new Option(timeSpan);
        this.timeout = new Option(timeout);
        this.cached = cached || false;
    }

    static cached() {
        return new Execution(undefined, undefined, undefined, true);
    }

    getCached() {
        return this.cached;
    }

    isTLE() {
        return (
            !this.getCached() && this.timeSpan.unwrap() >= this.timeout.unwrap()
        );
    }

    failed() {
        return !this.getCached() && this.result.unwrap().status !== 0;
    }

    status() {
        return this.result.mapOr(0, (result) => {
            return result.status;
        });
    }

    /**
     * This method will raise an error if is called on a cached execution.
     */
    stdout() {
        return this.result.unwrap().stdout;
    }

    /**
     * This method will raise an error if is called on a cached execution.
     */
    stderr() {
        return this.result.unwrap().stderr;
    }
}

export class LanguageCommand {
    run: string[];
    preRun: string[];

    constructor(run: string[], preRun: string[]) {
        this.run = run;
        this.preRun = preRun;
    }
}

export class Option<T> {
    value?: T;

    constructor(value?: T) {
        this.value = value;
    }

    static none<T>() {
        return new Option<T>(undefined);
    }

    static some<T>(value: T) {
        return new Option<T>(value);
    }

    isSome() {
        return this.value !== undefined;
    }

    isNone() {
        return !this.isSome();
    }

    unwrap(): T {
        if (this.value === undefined) {
            throw new Error("Expected value found undefined");
        } else {
            return this.value;
        }
    }

    unwrapOr(value: T): T {
        if (this.isSome()) {
            return this.unwrap();
        } else {
            return value;
        }
    }

    map<R>(predicate: (arg: T) => R): Option<R> {
        if (this.isSome()) {
            return Option.some(predicate(this.unwrap()));
        } else {
            return Option.none();
        }
    }

    mapOr<R>(value: R, predicate: (arg: T) => R): R {
        if (this.isSome()) {
            return predicate(this.unwrap());
        } else {
            return value;
        }
    }
}

/**
 * Result of compiling code file.
 * Path to code file, and output file.
 * If no compilation was performed `output` is Option.none
 */
export class CompileResult {
    code: string;
    private output: Option<string>;

    constructor(code: string, output?: string) {
        this.code = code;
        this.output = new Option(output);
    }

    getOutput() {
        return this.output.unwrapOr("");
    }
}

export class ConfigFile {
    mainSolution: Option<string>;
    bruteSolution: Option<string>;
    generator: Option<string>;
    checker: Option<string>;
    companionConfig: Option<CompanionConfig>;

    constructor(
        mainSolution?: string,
        bruteSolution?: string,
        generator?: string,
        checker?: string
    ) {
        this.mainSolution = new Option(mainSolution);
        this.bruteSolution = new Option(bruteSolution);
        this.generator = new Option(generator);
        this.checker = new Option(checker);
        this.companionConfig = Option.none();
    }

    setCompanionConfig(companionConfig: CompanionConfig) {
        this.companionConfig = Option.some(companionConfig);
    }

    /**
     * Check configuration file already exist, and create it otherwise with
     * default solution problem.
     */
    static checkExist(path: string) {
        if (!existsSync(join(path, ATTIC, "config.json"))) {
            const config = ConfigFile.empty();
            const mainSolution = join(path, "sol.cpp");
            if (existsSync(mainSolution)) {
                config.mainSolution = Option.some(mainSolution);
            }
            config.dump(path);
        }
    }

    dump(path: string) {
        const configFile = JSON.stringify(this, null, 2);
        writeToFileSync(join(path, ATTIC, "config.json"), configFile);
    }

    /**
     * Check that all files specified in configurations exist and remove it otherwise.
     */
    private verify() {
        let changed = false;

        if (!this.mainSolution.mapOr(true, existsSync)) {
            this.mainSolution = Option.none();
            changed = true;
        }

        if (!this.bruteSolution.mapOr(true, existsSync)) {
            this.bruteSolution = Option.none();
            changed = true;
        }

        if (!this.generator.mapOr(true, existsSync)) {
            this.generator = Option.none();
            changed = true;
        }

        if (!this.checker.mapOr(true, existsSync)) {
            this.checker = Option.none();
            changed = true;
        }

        return changed;
    }

    static loadConfig(path: string, checkExist = false): Option<ConfigFile> {
        if (checkExist) {
            ConfigFile.checkExist(path);
        }

        const configPath = join(path, ATTIC, "config.json");

        if (existsSync(configPath)) {
            const configData = readFileSync(
                join(path, ATTIC, "config.json"),
                "utf8"
            );
            const parsed = JSON.parse(configData);

            const config = new ConfigFile(
                parsed.mainSolution?.value,
                parsed.bruteSolution?.value,
                parsed.generator?.value,
                parsed.checker?.value
            );

            config.setCompanionConfig(parsed.companionConfig?.value);

            if (config.verify()) {
                config.dump(path);
            }

            return Option.some(config);
        } else {
            return Option.none();
        }
    }

    static empty(): ConfigFile {
        return new ConfigFile();
    }

    timeLimit(): Option<number> {
        return this.companionConfig.map((config) => config.timeLimit);
    }

    url(): Option<string> {
        return this.companionConfig.map((config) => config.url);
    }
}

export class ProblemInContest {
    problemConfig: ConfigFile;
    contestPath: string;

    constructor(problemConfig: ConfigFile, contestPath: string) {
        this.problemConfig = problemConfig;
        this.contestPath = contestPath;
    }
}

export function verdictName(verdict: Verdict) {
    switch (verdict) {
        case Verdict.OK:
            return "OK";

        case Verdict.WA:
            return "WA";

        case Verdict.TLE:
            return "TLE";

        case Verdict.RTE:
            return "RTE";

        case Verdict.CE:
            return "CE";

        case Verdict.FAIL:
            return "FAIL";

        default:
            throw new Error("Invalid Verdict");
    }
}
