import { connect } from "framer-api"

// Try several ways of identifying the project. The API key is bound to a
// specific project; if the identifier we pass doesn't match how the key is
// bound, Framer returns UNAUTHORIZED. One of these variants should match.
const candidates = [
    // Full editor URL exactly as in the browser
    "https://framer.com/projects/Exymes--czdyj1xGi8duWDmv3kS7-82ESk",
    // URL without the trailing fragment after the project id
    "https://framer.com/projects/Exymes--czdyj1xGi8duWDmv3kS7",
    // Bare project id only
    "czdyj1xGi8duWDmv3kS7",
    // Project id with trailing fragment, no slug prefix
    "czdyj1xGi8duWDmv3kS7-82ESk",
]

console.log("Node version:", process.version)
const k = process.env.FRAMER_API_KEY || ""
console.log("Key present:", k ? "yes" : "NO")
console.log("Key length:", k.length, "prefix:", k.slice(0, 3))
console.log("")

for (const id of candidates) {
    process.stdout.write(`Trying: ${id}\n`)
    try {
        const framer = await connect(id, process.env.FRAMER_API_KEY)
        const info = await framer.getProjectInfo()
        console.log(`  ✓ SUCCESS — project name: ${info.name}`)
        await framer.disconnect()
        console.log("")
        console.log(`WORKING IDENTIFIER: ${id}`)
        process.exit(0)
    } catch (err) {
        console.log(`  ✗ ${err?.code || "ERR"}: ${err?.message}`)
    }
    console.log("")
}

console.log("None of the identifier formats worked with this key.")
console.log("This points to the key itself not being bound to the project,")
console.log("rather than an identifier-format mismatch.")
process.exit(1)
