import { connect } from "framer-api"
import { algoliasearch } from "algoliasearch"

async function main() {
    const framer = await connect(
        "https://framer.com/projects/Exymes--czdyj1xGi8duWDmv3kS7-82ESk",
        process.env.FRAMER_API_KEY
    )

    const collections = await framer.getCollections()

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

    const readButtonField = fields.find(f => f.type === "boolean")
    if (readButtonField) {
        fieldMap["readbutton"] = readButtonField.id
        console.log(`Read button field resolved: "${readButtonField.name}" (${readButtonField.id})`)
    } else {
        console.warn("Could not find boolean field for Read button")
    }

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
            researchAreaMap[item.id] = name
        }
        console.log("Research Area terms loaded:", Object.values(researchAreaMap))
    } else {
        console.warn("Research Area collection not found — researchAreas field will be empty on all records")
    }

    const items = await resourcesCollection.getItems()
    console.log(`Found ${items.length} items in Resources collection`)

    const records = []
    let readButtonLogCount = 0

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

        if (!title || !link) continue

        // Log raw readButton value for first 5 external records to diagnose
        const rawReadButton = fd[fieldMap["readbutton"]]
        if (readButtonLogCount < 5 && source.toLowerCase().includes("external")) {
            console.log(`readButton raw value for "${title.substring(0,40)}...": ${JSON.stringify(rawReadButton)} (type: ${typeof rawReadButton})`)
            readButtonLogCount++
        }

        const readButton = !!rawReadButton

        const researchAreasRaw = fd[fieldMap["research areas"]]
        let researchAreas = []
        if (Array.isArray(researchAreasRaw)) {
            researchAreas = researchAreasRaw
                .map(r => {
                    const id = typeof r === "object" ? (r.id || r) : r
                    return researchAreaMap[id] || null
                })
                .filter(name => name && name.toLowerCase() !== "unclassified")
        }

        records.push({
            objectID: link,
            title: title,
            url: link,
            description: content,
            content: content,
            type: type,
            source: source,
            readButton: readButton,
            researchAreas: researchAreas,
            slug: item.slug,
        })
    }

    console.log(`Built ${records.length} records for Algolia`)

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
