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
    contestParser: (contestId: string) => Contest;
    problemParser: (problemId: string) => Problem;

    constructor(name: string, description: string, contestParser: (contestId: string) => Contest, problemParser: (problemId: string) => Problem){
        this.name = name;
        this.description = description;
        this.contestParser = contestParser;
        this.problemParser = problemParser;
    }
}

/**
 * Register a new site creating an entry in this dictionary.
 */
export const SITES: SiteDescription[] = [
    /**
     * Not a real site.
     *
     * Util to create personal problems and debug this tool.
     */
    new SiteDescription(
        "personal",
        "Not a site. Custom problems and contest.",
        function(contestId: string) {
            return new Contest();
        },
        function(problemId: string) {
            return new Problem();
        },
    ),

    new SiteDescription(
        "codeforces",
        "codeforces.com",
        function(contestId: string) {
            return new Contest();
        },
        function(problemId: string){
            return new Problem();
        }
    ),
];

export function getSite(site: string): SiteDescription  {
    SITES.forEach(siteDescription => {
        if (siteDescription.name === site){
            return siteDescription;
        }
    });

    throw new Error("Provided site is invalid");
}