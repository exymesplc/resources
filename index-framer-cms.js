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
            const color = typeof colorRaw === "object" ? (colorRaw?.value || "") : (colorRaw || "")
            // Framer may return color as "rgb(...)", plain hex "RRGGBB", or "#RRGGBB"
            // Normalise to a valid CSS color string
            const colorStr = String(color).trim()
            let cssColor = ""
            if (colorStr.startsWith("rgb")) {
                cssColor = colorStr  // already valid CSS
            } else if (colorStr.match(/^[0-9A-Fa-f]{6}$/)) {
                cssColor = `#${colorStr}`  // bare hex, add #
            } else if (colorStr.startsWith("#")) {
                cssColor = colorStr  // already has #
            }
            productsMap[item.id]   = { name: String(name).trim(), color: cssColor }
            productsMap[item.slug] = { name: String(name).trim(), color: cssColor }
        }
        console.log("Products loaded:", Object.values(productsMap).filter((v, i, a) => a.findIndex(x => x.name === v.name) === i).map(p => `${p.name} (${p.color})`))
    } else {
        console.warn("Products collection not found — product tags will be empty")
    }

    // ── Helper: strip HTML tags without introducing word-boundary spaces ───
    // Inline tags (e.g. <em>prep</em>GEM) have zero whitespace either side
    // in the source markup. Replacing the tag with " " instead of "" inserts
    // a space that was never there, breaking words like "prepGEM" into
    // "prep GEM". Stripping to "" preserves the original word boundaries;
    // the subsequent whitespace-collapse still normalises any genuine
    // multi-space or newline runs from block-level tags.
    function stripHtml(input) {
        return String(input).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
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

        // File field — Framer CDN URL for direct download
        // Framer returns file fields as {"type":"file","value":{"id":"...","url":"https://..."}}
        const fileRaw = fd[fieldMap["file"]]
        let fileUrl = ""
        if (fileRaw && typeof fileRaw === "object") {
            // Handle {type, value} wrapper
            const fileInner = fileRaw.value || fileRaw
            if (typeof fileInner === "object") {
                fileUrl = fileInner.url || fileInner.href || ""
            } else {
                fileUrl = String(fileInner)
            }
        } else if (fileRaw && typeof fileRaw === "string") {
            fileUrl = fileRaw
        }

        let content = fd[fieldMap["content"]] || ""
        if (typeof content === "object") {
            content = content.html || content.value || content.markdown || ""
        }
        content = stripHtml(content)
        // Truncate content to keep Algolia records under 10KB limit
        if (content.length > 3000) content = content.substring(0, 3000).trim() + "..."

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
        const description = content.length > 1500 ? content.substring(0, 1500).trim() + "..." : content

        records.push({
            objectID: link,
            title: title,
            url: link,
            description: description,
            content: content,
            type: type,
            source: source,
            readButton: readButton,
            fileUrl: fileUrl,
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

    // ── Initialise Algolia client ────────────────────────────────────────────
    const client = algoliasearch(
        process.env.ALGOLIA_APP_ID,
        process.env.ALGOLIA_ADMIN_KEY
    )

    // ── Index Insights collection ─────────────────────────────────────────
    const insightsCollection = collections.find(c => c.name === "Insights")
    const insightsRecords = []

    if (insightsCollection) {
        const iFields = await insightsCollection.getFields()
        console.log("Insights fields:", iFields.map(f => ({ id: f.id, name: f.name, type: f.type })))

        const iFieldMap = {}
        for (const field of iFields) {
            iFieldMap[field.name.toLowerCase()] = field.id
        }

        const iItems = await insightsCollection.getItems()
        console.log(`Found ${iItems.length} items in Insights collection`)

        for (const item of iItems) {
            if (item.draft) continue

            const fd = item.fieldData

            // Helper to safely extract a field value
            function extractField(fieldId) {
                if (!fieldId) return ""
                const raw = fd[fieldId]
                if (!raw) return ""
                if (typeof raw === "object") {
                    return raw.value || raw.url || raw.src || raw.href || ""
                }
                return String(raw)
            }

            const title = extractField(iFieldMap["name"]) || item.slug
            const excerpt = extractField(iFieldMap["excerpt"])
            const contentType = extractField(iFieldMap["content type"])
            const slug = item.slug
            const externalLink = extractField(iFieldMap["external link"])

            // Date — may be a date object or ISO string
            const dateRaw = fd[iFieldMap["date"]]
            let date = ""
            if (dateRaw) {
                if (typeof dateRaw === "object") {
                    date = dateRaw.value || dateRaw.iso || dateRaw.date || ""
                } else {
                    date = String(dateRaw)
                }
            }

            // Thumbnail — Framer image fields return {"type":"image","value":{"src":"..."}}
            // InsightsCardV2 accesses thumbnail?.src, so we resolve to the src property
            const thumbRaw = fd[iFieldMap["thumbnail"]]
            let thumbnail = ""
            if (thumbRaw && typeof thumbRaw === "object") {
                const thumbInner = thumbRaw.value || thumbRaw
                if (typeof thumbInner === "object") {
                    thumbnail = thumbInner.src || thumbInner.url || thumbInner.originalImageUrl || ""
                } else {
                    thumbnail = String(thumbInner)
                }
            } else if (thumbRaw) {
                thumbnail = String(thumbRaw)
            }

            // Video Link — plain string field
            const videoLink = extractField(iFieldMap["video link"])

            // URL — external link takes priority, otherwise internal /insights/slug
            const url = externalLink || `/insights/${slug}`

            // Content — excerpt is plain text, use as-is for search
            let searchContent = excerpt
            // Also extract from rich content field if present
            const richContentRaw = fd[iFieldMap["content"]]
            if (richContentRaw) {
                let richText = typeof richContentRaw === "object"
                    ? (richContentRaw.html || richContentRaw.value || "")
                    : String(richContentRaw)
                richText = stripHtml(richText)
                if (richText) searchContent = `${excerpt} ${richText}`.trim()
            }

            if (!title) continue

            insightsRecords.push({
                objectID: `/insights/${slug}`,
                title,
                slug,
                excerpt,
                contentType,
                thumbnail,
                date,
                url,
                videoLink,
                content: searchContent.substring(0, 3000),
                description: excerpt.substring(0, 500),
                source: "Insights",
            })
        }

        console.log(`Built ${insightsRecords.length} Insights records for Algolia`)

        // Push to separate Insights index
        await client.clearObjects({ indexName: "exymesplc_insights" })
        const insightsResult = await client.saveObjects({
            indexName: "exymesplc_insights",
            objects: insightsRecords,
        })
        console.log("Insights indexing complete", JSON.stringify(insightsResult))

        // Also push to the pages index so Insights appear in site search
        // We push with source="Insights" so the SiteSearch component can badge them correctly
        const insightsForPages = insightsRecords.map(r => ({
            ...r,
            objectID: `insights-${r.slug}`,
        }))
        const pagesResult = await client.saveObjects({
            indexName: "www_exymesplc_com_e3wswa1rj6_pages",
            objects: insightsForPages,
        })
        console.log(`Pushed ${insightsForPages.length} Insights records to pages index`)

    } else {
        console.warn("Insights collection not found — skipping Insights indexing")
    }

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
    await client.clearObjects({ indexName: "exymesplc_pdfs" })
    const result = await client.saveObjects({ indexName: "exymesplc_pdfs", objects: safeRecords })
    console.log(`Indexing complete`, JSON.stringify(result))

    await framer.disconnect()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
