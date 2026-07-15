import { connect } from "framer-api"

const PROJECT_URL =
    "https://framer.com/projects/Exymes--czdyj1xGi8duWDmv3kS7-82ESk"

console.log("Node version:", process.version)
console.log(
    "FRAMER_API_KEY present:",
    process.env.FRAMER_API_KEY ? "yes" : "NO — secret missing"
)
if (process.env.FRAMER_API_KEY) {
    const k = process.env.FRAMER_API_KEY
    console.log("Key length:", k.length)
    console.log("Key prefix:", k.slice(0, 3))
    console.log(
        "Leading/trailing whitespace:",
        k !== k.trim() ? "YES — problem" : "none"
    )
}

console.log("Attempting connect()...")

try {
    const framer = await connect(PROJECT_URL, process.env.FRAMER_API_KEY)
    console.log("CONNECT OK")

    const info = await framer.getProjectInfo()
    console.log("Project name:", info.name)

    await framer.disconnect()
    console.log("DONE — connection works")
} catch (err) {
    console.error("CONNECT FAILED")
    console.error("Message:", err?.message)
    console.error("Code:", err?.code)
    console.error("Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2))
    process.exit(1)
}
