import { SiteDescription, Contest, Problem } from "./types";

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
        numProblems => {
            let problems = [];

            for (let i = 0; i < numProblems; i++) {
                problems.push(new Problem(`P${i+1}`, ["0\n", "2\n", "9\n"], ["2\n", "4\n", "11\n"]));
            }

            return new Contest(problems);
        },
        problemId => {
            return new Problem("W", ["0\n", "2\n", "9\n"], ["2\n", "4\n", "11\n"]);
        }
    ),

    new SiteDescription(
        "codeforces",
        "codeforces.com",
        contestId => {
            return new Contest();
        },
        problemId => {
            return new Problem();
        },
    ),
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