import { SiteDescription, Contest, Problem } from "./types";
import { CODEFORCES } from "./parsers/codeforces";

/**
 * Not a real site.
 *
 * Util to create personal problems and debug this tool.
 */
export const PERSONAL = new SiteDescription(
    "personal",
    "Not a site. Custom problems and contest.",
    "Contest name",
    "Problem name",
    async numProblems => {
        let total = Number.parseInt(numProblems);

        let problems = [];

        for (let i = 0; i < total; i++) {
            problems.push(new Problem(`P${i+1}`, `P${i+1}`, ["0\n", "2\n", "9\n"], ["2\n", "4\n", "11\n"]));
        }

        return new Contest("personal", problems);
    },
    async problemId => {
        return new Problem(problemId, problemId, ["0\n", "2\n", "9\n"], ["2\n", "4\n", "11\n"]);
    }
);

/**
 * Not a real site.
 *
 * Create an empty contest that will be filled by user manually.
 */
const EMPTY = new SiteDescription(
    "empty",
    "Not a site. Create empty problems",
    "Contest name",
    "Problem name",
    async problemId => {
        // Parse problemId. It is of the form problem-name-10
        // Where `problem-name` is current name and `10` is number of problems
        let args = problemId.split('-');

        let numProblems =  args[args.length - 1];
        let total = Number.parseInt(numProblems);

        args.pop();
        let name = args.join('-');

        let problems = [];

        for (let i = 0; i < total; i++) {
            problems.push(new Problem(`P${i+1}`, `P${i+1}`, [], []));
        }

        return new Contest(name, problems);
    },
    async problemId => {
        return new Problem(problemId, problemId, [], []);
    }
);

/**
 * Register a new site creating an entry in this dictionary.
 */
export const SITES: SiteDescription[] = [
    EMPTY,
    CODEFORCES,
];

export function getSite(site: string): SiteDescription  {
    let result = undefined;

    SITES.forEach(siteDescription => {
        if (siteDescription.name === site){
            result = siteDescription;
        }
    });

    if (result !== undefined){
        return result;
    }

    throw new Error("Provided site is invalid");
}