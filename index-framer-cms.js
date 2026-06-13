import { connect } from "framer-api"
import { algoliasearch } from "algoliasearch"

async function main() {
    const framer = await connect(
        "https://framer.com/projects/Exymes--czdyj1xGi8duWDmv3kS7-82ESk",
        process.env.FRAMER_API_KEY
    )

    const collections = await framer.getCollections()

    // ── Resources collection ──────────────────────────────────────────────
    const resourcesCollection = collections.find(c => c.name === "Resources")
    if (!resourcesCollection) {
        console.error("Could not find Resources collection")
        await framer.disconnect()
        process.exit(1)
    }

    const fields = await resourcesCollection.getFields()
    console.log("Fields found:", fields.map(f => ({ id: f.id, name: f.name, type: f.type })))

    const fieldMap = {}
    for (const field of fields) {
        fieldMap[field.name.toLowerCase()] = field.id
    }

    // Resolve boolean field by type to avoid special character matching issues
    const readButtonField = fields.find(f => f.type === "boolean")
    if (readButtonField) {
        fieldMap["readbutton"] = readButtonField.id
        console.log(`Read button field resolved: "${readButtonField.name}" (${readButtonField.id})`)
    } else {
        console.warn("Could not find boolean field for Read button")
    }

    // Resolve Research Areas field by type to avoid name matching issues
    const researchAreasField = fields.find(f => f.type === "multiCollectionReference" && f.name.toLowerCase().includes("research"))
    if (researchAreasField) {
        fieldMap["researchareas"] = researchAreasField.id
        console.log(`Research Areas field resolved: "${researchAreasField.name}" (${researchAreasField.id})`)
    } else {
        console.warn("Could not find Research Areas field")
    }

    // ── Research Area collection ──────────────────────────────────────────
    const researchAreaCollection = collections.find(c => c.name === "Research Area")
    const researchAreaMap = {}

    if (researchAreaCollection) {
        const raFields = await researchAreaCollection.getFields()
        const raTitleFieldId = raFields.find(f => f.name.toLowerCase() === "title")?.id
        const raItems = await researchAreaCollection.getItems()
        for (const item of raItems) {
            const name = raTitleFieldId
                ? (typeof item.fieldData[raTitleFieldId] === "object"
                    ? (item.fieldData[raTitleFieldId]?.value || item.slug)
                    : (item.fieldData[raTitleFieldId] || item.slug))
                : item.slug
            // Store by both item.id and slug for flexible lookup
            researchAreaMap[item.id] = name
            researchAreaMap[item.slug] = name
        }
        const uniqueTerms = [...new Set(Object.values(researchAreaMap))]
        console.log("Research Area terms loaded:", uniqueTerms)
    } else {
        console.warn("Research Area collection not found — researchAreas field will be empty on all records")
    }

    // ── Fetch and build records ───────────────────────────────────────────
    const items = await resourcesCollection.getItems()
    console.log(`Found ${items.length} items in Resources collection`)

    const records = []

    for (const item of items) {
        if (item.draft) continue

        const fd = item.fieldData

        const title = typeof fd[fieldMap["title"]] === "object"
            ? (fd[fieldMap["title"]]?.value || "")
            : (fd[fieldMap["title"]] || "")

        const linkRaw = fd[fieldMap["link"]] || ""
        const link = typeof linkRaw === "object"
            ? (linkRaw.value || linkRaw.url || linkRaw.href || "")
            : linkRaw

        const source = typeof fd[fieldMap["source"]] === "object"
            ? (fd[fieldMap["source"]]?.name || fd[fieldMap["source"]]?.value || "")
            : (fd[fieldMap["source"]] || "")

        const type = typeof fd[fieldMap["type"]] === "object"
            ? (fd[fieldMap["type"]]?.name || fd[fieldMap["type"]]?.value || "")
            : (fd[fieldMap["type"]] || "")

        let content = fd[fieldMap["content"]] || ""
        if (typeof content === "object") {
            content = content.html || content.value || content.markdown || ""
        }
        content = String(content).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        // Truncate content to keep Algolia records under 10KB limit
        if (content.length > 1500) content = content.substring(0, 1500).trim() + "..."

        if (!title || !link) continue

        // Framer wraps all field values in {type, value} objects
        const rawReadButton = fd[fieldMap["readbutton"]]
        const readButton = typeof rawReadButton === "object"
            ? rawReadButton.value === true
            : rawReadButton === true

        // Year and Journal — plain text fields
        const yearRaw = fd[fieldMap["year"]]
        const year = typeof yearRaw === "object"
            ? (yearRaw?.value || "")
            : (yearRaw || "")

        const journalRaw = fd[fieldMap["journal"]]
        const journal = typeof journalRaw === "object"
            ? (journalRaw?.value || "")
            : (journalRaw || "")

        // Research Areas — Framer returns {"type":"multiCollectionReference","value":["slug1","slug2"]}
        const rawRA = fd[fieldMap["researchareas"]]
        const raArray = (typeof rawRA === "object" && rawRA !== null && Array.isArray(rawRA.value))
            ? rawRA.value
            : []

        const researchAreas = raArray
            .map((entry) => {
                const key = typeof entry === "object" ? (entry.id || entry.slug || "") : entry
                return researchAreaMap[key] || null
            })
            .filter((name) => name && name.toLowerCase() !== "unclassified")

        records.push({
            objectID: link,
            title: title,
            url: link,
            description: content,
            content: content,
            type: type,
            source: source,
            readButton: readButton,
            year: String(year),
            journal: String(journal),
            researchAreas: researchAreas,
            slug: item.slug,
        })
    }

    console.log(`Built ${records.length} records for Algolia`)

    // ── Push to Algolia ───────────────────────────────────────────────────
    const client = algoliasearch(
        process.env.ALGOLIA_APP_ID,
        process.env.ALGOLIA_ADMIN_KEY
    )
    await client.clearObjects({ indexName: "exymesplc_pdfs" })
    const result = await client.saveObjects({ indexName: "exymesplc_pdfs", objects: records })
    console.log(`Indexing complete`, JSON.stringify(result))

    await framer.disconnect()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
