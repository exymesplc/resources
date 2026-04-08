import { connect } from "framer-api"
import { algoliasearch } from "algoliasearch"

async function main() {
    // Connect to Framer
    const framer = await connect(
        "https://framer.com/projects/Exymes--czdyj1xGi8duWDmv3kS7-82ESk",
        process.env.FRAMER_API_KEY
    )

    // Get all collections and find Resources
    const collections = await framer.getCollections()
    const resourcesCollection = collections.find(c => c.name === "Resources")

    if (!resourcesCollection) {
        console.error("Could not find Resources collection")
        await framer.disconnect()
        process.exit(1)
    }

    // Get fields so we can map field IDs to names
    const fields = await resourcesCollection.getFields()
    console.log("Fields found:", fields.map(f => ({ id: f.id, name: f.name, type: f.type })))

    // Build a field name to ID map
    const fieldMap = {}
    for (const field of fields) {
        fieldMap[field.name.toLowerCase()] = field.id
    }

    // Get all items
    const items = await resourcesCollection.getItems()
    console.log(`Found ${items.length} items in Resources collection`)

    // Build Algolia records
    const records = []
    for (const item of items) {
        if (item.draft) continue

        const fd = item.fieldData

        const title = fd[fieldMap["title"]] || ""
        const linkRaw = fd[fieldMap["link"]] || ""
        const link = typeof linkRaw === "object" ? (linkRaw.url || linkRaw.href || JSON.stringify(linkRaw)) : linkRaw
        const source = typeof fd[fieldMap["source"]] === "object" ? (fd[fieldMap["source"]]?.name || "") : (fd[fieldMap["source"]] || "")
        const type = typeof fd[fieldMap["type"]] === "object" ? (fd[fieldMap["type"]]?.name || "") : (fd[fieldMap["type"]] || "")

        // Content field is rich text (HTML) - strip tags for plain text
        let content = fd[fieldMap["content"]] || ""
        if (typeof content === "object" && content.value) content = content.value
        content = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

        if (!title || !link) continue

        records.push({
            objectID: link,
            title: title,
            url: link,
            description: content,
            content: content,
            type: type,
            source: source,
            slug: item.slug,
        })
    }

    console.log(`Built ${records.length} records for Algolia`)

    // Push to Algolia
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
