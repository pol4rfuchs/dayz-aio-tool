const SECRET_PATTERNS = [
    [/DAYZ_AIO_API_KEY\s*=\s*[^\r\n]+/gi, "DAYZ_AIO_API_KEY=***MASKED***"],
    [/DAYZ_AIO_SECRET_KEY\s*=\s*[^\r\n]+/gi, "DAYZ_AIO_SECRET_KEY=***MASKED***"],
    [/DAYZ_AIO_BATTLEYE_RCON_ENABLED\s*=\s*[^\r\n]+/gi, "DAYZ_AIO_BATTLEYE_RCON_ENABLED=***MASKED***"],
    [/apiKey=([^\s&"']+)/gi, "apiKey=***MASKED***"],
    [/(X-API-Key\s*[:=]\s*)[^\s,;]+/gi, "$1***MASKED***"],
    [/(Authorization\s*[:=]\s*Bearer\s+)[^\s,;]+/gi, "$1***MASKED***"],
    [/(rconPassword\s*[:=]\s*)[^\s,;]+/gi, "$1***MASKED***"],
    [/(rcon_password\s*[:=]\s*)[^\s,;]+/gi, "$1***MASKED***"],
    [/(passwordAdmin\s*=\s*)\"?[^\";\r\n]+\"?/gi, "$1***MASKED***"],
    [/(password\s*=\s*)\"?[^\";\r\n]+\"?/gi, "$1***MASKED***"]
];
export function maskSecrets(input) {
    let output = input;
    for (const [pattern, replacement] of SECRET_PATTERNS)
        output = output.replace(pattern, replacement);
    return output;
}
export function maskJsonSecrets(value) {
    return JSON.parse(maskSecrets(JSON.stringify(value)));
}
