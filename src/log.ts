export function debug(target: String, ...optionalParams: any[]) {
    console.log(`${new Date().toISOString()}[${target}]:`, ...optionalParams);
}
