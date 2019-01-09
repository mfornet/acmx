import { SiteDescription, Contest, Problem } from "./types";
import { CODEFORCES } from "./parsers/codeforces";

/**
 * Not a real site.
 *
 * Util to create personal problems and debug this tool.
 */
const PERSONAL = new SiteDescription(
    "personal",
    "Not a site. Custom problems and contest.",
    async numProblems => {
        let total = Number.parseInt(numProblems);

        let problems = [];

        for (let i = 0; i < total; i++) {
            problems.push(new Problem(`P${i+1}`, `P${i+1}`, ["0\n", "2\n", "9\n"], ["2\n", "4\n", "11\n"]));
        }

        return new Contest(problems);
    },
    async problemId => {
        return new Problem("W", "W", ["0\n", "2\n", "9\n"], ["2\n", "4\n", "11\n"]);
    }
);

/**
 * Register a new site creating an entry in this dictionary.
 */
export const SITES: SiteDescription[] = [
    PERSONAL,
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