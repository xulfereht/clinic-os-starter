import fs from 'fs-extra';

function mergeObject(localValue, upstreamValue) {
    return {
        ...(localValue || {}),
        ...(upstreamValue || {}),
    };
}

export function mergeStarterPackageJson(localPackageJson = {}, upstreamPackageJson = {}) {
    const merged = {
        ...localPackageJson,
        ...upstreamPackageJson,
    };

    merged.scripts = mergeObject(localPackageJson.scripts, upstreamPackageJson.scripts);
    merged.dependencies = mergeObject(localPackageJson.dependencies, upstreamPackageJson.dependencies);
    merged.devDependencies = mergeObject(localPackageJson.devDependencies, upstreamPackageJson.devDependencies);
    merged.bin = mergeObject(localPackageJson.bin, upstreamPackageJson.bin);
    merged.engines = upstreamPackageJson.engines
        ? { ...upstreamPackageJson.engines }
        : (localPackageJson.engines || undefined);

    return merged;
}

export function writeStarterPackageJson(targetPath, packageJson) {
    fs.writeFileSync(targetPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
