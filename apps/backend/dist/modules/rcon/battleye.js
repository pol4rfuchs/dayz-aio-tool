import dgram from "node:dgram";
import { crc32 } from "../../shared/crc32.js";
function packet(payload) {
    const body = Buffer.concat([Buffer.from([0xff]), payload]);
    const out = Buffer.alloc(2 + 4 + body.length);
    out.write("BE", 0, "ascii");
    out.writeUInt32LE(crc32(body), 2);
    body.copy(out, 6);
    return out;
}
function parsePacket(message) {
    if (message.length < 8 || message.subarray(0, 2).toString("ascii") !== "BE")
        return null;
    const body = message.subarray(6);
    if (body[0] !== 0xff)
        return null;
    return body.subarray(1);
}
function onceMessage(socket, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`RCON timeout after ${timeoutMs} ms`));
        }, timeoutMs);
        function cleanup() {
            clearTimeout(timer);
            socket.off("message", onMessage);
            socket.off("error", onError);
        }
        function onMessage(message) { cleanup(); resolve(message); }
        function onError(error) { cleanup(); reject(error); }
        socket.on("message", onMessage);
        socket.on("error", onError);
    });
}
async function sendAndWait(socket, host, port, payload, timeoutMs) {
    const wait = onceMessage(socket, timeoutMs);
    await new Promise((resolve, reject) => socket.send(packet(payload), port, host, (err) => err ? reject(err) : resolve()));
    return parsePacket(await wait);
}
async function sendBattleyeRconCommandRaw(opts) {
    const socket = dgram.createSocket("udp4");
    try {
        const loginPayload = Buffer.concat([Buffer.from([0x00]), Buffer.from(opts.password, "utf8")]);
        const loginResponse = await sendAndWait(socket, opts.host, opts.port, loginPayload, opts.timeoutMs);
        if (!loginResponse || loginResponse[0] !== 0x00 || loginResponse[1] !== 0x01) {
            throw new Error("BattlEye RCON login failed. Check host, port and password.");
        }
        const seq = 0;
        const commandPayload = Buffer.concat([Buffer.from([0x01, seq]), Buffer.from(opts.command, "utf8")]);
        const first = await sendAndWait(socket, opts.host, opts.port, commandPayload, opts.timeoutMs);
        if (!first || first[0] !== 0x01)
            throw new Error("Unexpected BattlEye RCON command response.");
        const chunks = [];
        const firstText = first.subarray(2).toString("utf8");
        if (firstText)
            chunks.push(firstText);
        // Collect short burst of additional response packets. Some BattlEye replies are split.
        let packets = 1;
        const deadline = Date.now() + Math.min(opts.timeoutMs, 2500);
        while (Date.now() < deadline) {
            try {
                const raw = await onceMessage(socket, 250);
                const payload = parsePacket(raw);
                if (!payload || payload[0] !== 0x01)
                    continue;
                packets++;
                const text = payload.subarray(2).toString("utf8");
                if (text)
                    chunks.push(text);
            }
            catch {
                break;
            }
        }
        return { ok: true, command: opts.command, response: chunks.join("\n"), packets };
    }
    finally {
        socket.close();
    }
}
let rconQueue = Promise.resolve();
export function resetBattleyeRconQueueForTests() {
    rconQueue = Promise.resolve();
}
export function sendBattleyeRconCommand(opts) {
    const task = rconQueue.then(() => sendBattleyeRconCommandRaw(opts));
    rconQueue = task.then(() => undefined, () => undefined);
    return task;
}
