import { Contest, Problem, SiteDescription } from "./primitives";

/**
 * Not a real site.
 *
 * Create an empty contest that will be filled by user manually.
 */
export const EMPTY = new SiteDescription(
    "empty",
    "Not a site. Create empty problems",
    "Contest name",
    "Problem name",
    (problemId) => {
        // Parse problemId. It is of the form problem-name-10
        // Where `problem-name` is current name and `10` is number of problems
        let args = problemId.split("-");

        let numProblems = args[args.length - 1];
        let total = Number.parseInt(numProblems);

        args.pop();
        let name = args.join("-");

        let problems = [];

        for (let i = 0; i < total; i++) {
            let name = `Z${i - 25}`;
            if (i < 26) {
                name = String.fromCharCode(i + 65);
            }
            problems.push(new Problem(name, name, [], []));
        }

        return new Contest(name, problems);
    },
    (problemId) => {
        return new Problem(problemId, problemId, [], []);
    }
);
