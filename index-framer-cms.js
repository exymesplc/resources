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
            researchAreaMap[item.id] = name
            researchAreaMap[item.slug] = name
        }
        const uniqueTerms = [...new Set(Object.values(researchAreaMap))]
        console.log("Research Area terms loaded:", uniqueTerms)
    } else {
        console.warn("Research Area collection not found — researchAreas field will be empty on all records")
    }

    // ── Products collection ───────────────────────────────────────────────
    const productsCollection = collections.find(c => c.name === "Products")
    const productsMap = {}  // id -> { name, color }

    if (productsCollection) {
        const pFields = await productsCollection.getFields()
        const pNameFieldId    = pFields.find(f => f.name === "Product Name")?.id
        const pColorFieldId   = pFields.find(f => f.name === "Label Color")?.id
        const pItems = await productsCollection.getItems()
        for (const item of pItems) {
            const nameRaw  = item.fieldData[pNameFieldId]
            const colorRaw = item.fieldData[pColorFieldId]
            const name  = typeof nameRaw  === "object" ? (nameRaw?.value  || item.slug) : (nameRaw  || item.slug)
            const color = typeof colorRaw === "object" ? (colorRaw?.value || "")        : (colorRaw || "")
            productsMap[item.id]   = { name: String(name).trim(), color: color ? `#${String(color).replace(/^#/, "").trim()}` : "" }
            productsMap[item.slug] = { name: String(name).trim(), color: color ? `#${String(color).replace(/^#/, "").trim()}` : "" }
        }
        console.log("Products loaded:", Object.values(productsMap).filter((v, i, a) => a.findIndex(x => x.name === v.name) === i).map(p => `${p.name} (${p.color})`))
    } else {
        console.warn("Products collection not found — product tags will be empty")
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
        let year = typeof yearRaw === "object"
            ? (yearRaw?.value || "")
            : (yearRaw || "")
        // Strip trailing .0 that appears when year was imported as a number
        year = String(year).replace(/\.0$/, "").trim()
        if (year === "nan" || year === "undefined") year = ""

        const journalRaw = fd[fieldMap["journal"]]
        const journal = typeof journalRaw === "object"
            ? (journalRaw?.value || "")
            : (journalRaw || "")

        const authorRaw = fd[fieldMap["lead author"]]
        const author = typeof authorRaw === "object"
            ? (authorRaw?.value || "")
            : (authorRaw || "")

        // Products — multi-collection reference, resolve to name + color
        const rawProducts = fd[fieldMap["products"]]
        const productsArray = (typeof rawProducts === "object" && rawProducts !== null && Array.isArray(rawProducts.value))
            ? rawProducts.value : []
        const products = productsArray
            .map(entry => {
                const key = typeof entry === "object" ? (entry.id || entry.slug || "") : entry
                return productsMap[key] || null
            })
            .filter(p => p && p.name)

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

        // Keep description short for Algolia snippet display
        const description = content.length > 300 ? content.substring(0, 300).trim() + "..." : content

        records.push({
            objectID: link,
            title: title,
            url: link,
            description: description,
            content: content,
            type: type,
            source: source,
            readButton: readButton,
            year: String(year),
            author: String(author),
            journal: String(journal),
            products: products,
            researchAreas: researchAreas,
            slug: item.slug,
        })
    }

    // Check for duplicate objectIDs — Algolia merges records with the same objectID
    const objectIDCounts = {}
    for (const record of records) {
        objectIDCounts[record.objectID] = (objectIDCounts[record.objectID] || 0) + 1
    }
    const duplicateIDs = Object.entries(objectIDCounts).filter(([id, count]) => count > 1)
    if (duplicateIDs.length > 0) {
        console.warn(`Found ${duplicateIDs.length} duplicate objectIDs (will be merged by Algolia):`)
        for (const [id, count] of duplicateIDs) {
            const dupeRecords = records.filter(r => r.objectID === id)
            console.warn(`  ${id} (${count}x): ${dupeRecords.map(r => r.title.substring(0, 50)).join(' | ')}`)
        }
    } else {
        console.log("No duplicate objectIDs found")
    }

    console.log(`Built ${records.length} records for Algolia`)

    // Check record sizes before pushing — Algolia limit is 10,000 bytes per record
    const encoder = new TextEncoder()
    const oversized = []
    const safeRecords = []
    for (const record of records) {
        const size = encoder.encode(JSON.stringify(record)).length
        if (size > 9500) {
            // Truncate content further until it fits
            let truncated = { ...record }
            while (encoder.encode(JSON.stringify(truncated)).length > 9500 && truncated.content.length > 100) {
                truncated.content = truncated.content.substring(0, truncated.content.length - 200).trim() + "..."
                truncated.description = truncated.content.substring(0, 300)
            }
            const finalSize = encoder.encode(JSON.stringify(truncated)).length
            if (finalSize <= 9500) {
                safeRecords.push(truncated)
                console.log(`Truncated large record (${size} -> ${finalSize} bytes): ${record.title.substring(0, 60)}`)
            } else {
                oversized.push(record.title)
                console.warn(`Skipping record too large to truncate: ${record.title.substring(0, 60)}`)
            }
        } else {
            safeRecords.push(record)
        }
    }

    if (oversized.length > 0) {
        console.warn(`Skipped ${oversized.length} oversized records:`, oversized)
    }

    console.log(`Pushing ${safeRecords.length} records to Algolia`)

    // ── Push to Algolia ───────────────────────────────────────────────────
    const client = algoliasearch(
        process.env.ALGOLIA_APP_ID,
        process.env.ALGOLIA_ADMIN_KEY
    )
    await client.clearObjects({ indexName: "exymesplc_pdfs" })
    const result = await client.saveObjects({ indexName: "exymesplc_pdfs", objects: safeRecords })
    console.log(`Indexing complete`, JSON.stringify(result))

    await framer.disconnect()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
