import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob";

process.env.ACMX_TESTING = "1";
/**
 *  There is an issue on github actions:
 *
 * ```
 * Error: async hook stack has become corrupted (actual: 1269, expected: 0)
 * ```
 *
 * Workaround from: https://github.com/microsoft/vscode/issues/85601#issuecomment-558917205
 */
process.env.NODE_OPTIONS = "--no-force-async-hooks-checks";

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: "tdd",
        color: true,
    });

    const testsRoot = path.resolve(__dirname, "..");

    return new Promise((c, e) => {
        glob("**/**.test.js", { cwd: testsRoot }, (err, files) => {
            if (err) {
                return e(err);
            }

            // Add files to the test suite
            files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run((failures) => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                console.error(err);
                e(err);
            }
        });
    });
}
