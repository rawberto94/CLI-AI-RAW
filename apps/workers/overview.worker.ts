// Prefer workspace import, fallback to relative if needed
let OverviewArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OverviewArtifactV1Schema = require('schemas').OverviewArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OverviewArtifactV1Schema = require('../../packages/schemas/src').OverviewArtifactV1Schema;
}

let db: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('clients-db');
  db = mod.default || mod;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../packages/clients/db');
  db = mod.default || mod;
}

let OpenAIClient: any;
try {
	// Prefer workspace package if available
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	OpenAIClient = require('clients-openai').OpenAIClient;
} catch {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		OpenAIClient = require('../../packages/clients/openai').OpenAIClient;
	} catch {
		OpenAIClient = null;
	}
}

export async function runOverview(job: { data: { docId: string } }) {
    const { docId } = job.data;
    console.log(`[worker:overview] Starting overview for ${docId}`);
    const startTime = Date.now();

	// Try to read prior artifacts (e.g., ingestion content)
    const ingestionArtifact = await db.artifact.findFirst({
        where: { contractId: docId, type: 'INGESTION' },
        orderBy: { createdAt: 'desc' },
    });

    if (!ingestionArtifact) {
        throw new Error(`Ingestion artifact for ${docId} not found`);
    }
	const ingestionText = (ingestionArtifact.data as any)?.content;
	// Heuristic fallbacks from ingested text (avoid demo placeholders)
	const text = typeof ingestionText === 'string' ? ingestionText : '';
	let summary = (text.slice(0, 800) || '').trim() || 'No content extracted';
	// Try common patterns to infer parties
	// 1) "Between X and Y"
	const between = text.match(/between\s+(.+?)\s+and\s+(.+?)(?:[\.;\n]|$)/i);
	// 2) "Client: X", "Supplier: Y" (or Vendor)
	const client = text.match(/client\s*[:\-]\s*([^\n\r]+)$/im)?.[1]?.trim();
	const supplier = text.match(/(supplier|vendor)\s*[:\-]\s*([^\n\r]+)$/im)?.[2]?.trim();
	let parties: string[] = [];
	if (between && between[1] && between[2]) {
		parties = [between[1].trim(), between[2].trim()].filter(Boolean);
	} else if (client || supplier) {
		parties = [client, supplier].filter(Boolean) as string[];
	}
	if (parties.length === 0) {
		// Fallback: look for named entities around the top of the document (very naive)
		const header = text.slice(0, 2000);
		const guesses = Array.from(new Set((header.match(/[A-Z][A-Za-z0-9&.,\- ]{2,60}\b/g) || [])
			.map(s => s.trim())
			.filter(s => s.length > 2 && !/^(the|and|or|of|agreement|contract|statement|work|services|terms)$/i.test(s)))).slice(0, 2);
		parties = guesses;
	}

	const apiKey = process.env['OPENAI_API_KEY'];
	const model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
	if (apiKey && OpenAIClient) {
		try {
			// If RAG is enabled, retrieve a small set of relevant chunks to ground the summary
			let ragContext = '';
			try {
				if ((process.env['RAG_ENABLED'] || '').toLowerCase() === 'true' && ingestionText) {
					let rag: any;
					try { rag = require('clients-rag'); } catch { rag = require('../../packages/clients/rag'); }
					const topK = Number(process.env['RAG_TOP_K'] || 6);
					const scored = await rag.retrieve(docId, 'parties and summary of contract', topK, { apiKey: process.env['OPENAI_API_KEY'], model: process.env['RAG_EMBED_MODEL'] });
					ragContext = (scored || []).map((s: any) => s.text).join('\n---\n');
				}
			} catch {}
			const client = new OpenAIClient(apiKey);
			const schema = {
				type: 'object',
				required: ['summary', 'parties'],
				properties: {
					summary: { type: 'string' },
					parties: { type: 'array', items: { type: 'string' } },
				},
				additionalProperties: false,
			};
					const typedClient = client as unknown as {
						createStructured<T>(opts: any): Promise<T>;
					};
					const result = await typedClient.createStructured<{ summary: string; parties: string[] }>({
				model,
				system: 'You extract a one-sentence summary and list of parties from a contract. Prefer facts grounded in the provided CONTEXT when available.',
				userChunks: [
					{ type: 'text', role: 'user', content: 'CONTEXT:' },
					{ type: 'text', role: 'user', content: ragContext || '(no context)'},
					{ type: 'text', role: 'user', content: 'Contract text (truncated):' },
					{ type: 'text', role: 'user', content: (ingestionText || 'No text available').slice(0, 10000) },
				],
				schema,
				temperature: 0,
			});
			if (result?.summary) summary = String(result.summary).trim() || summary;
			if (Array.isArray(result?.parties) && result.parties.length) parties = result.parties.slice(0, 10);
		} catch (err) {
			// Keep heuristic fallbacks on error
			// eslint-disable-next-line no-console
			console.warn('[overview] OpenAI call failed, using heuristic summary/parties:', (err as Error).message);
		}
	}

	const artifact = OverviewArtifactV1Schema.parse({
		metadata: {
			docId,
			fileType: 'pdf',
			totalPages: 1,
			ocrRate: 0,
			provenance: [
				{ worker: 'overview', timestamp: new Date().toISOString(), durationMs: Date.now() - startTime },
			],
		},
		summary,
		parties,
	});
	
    await db.artifact.create({
        data: {
            contractId: docId,
            type: 'OVERVIEW',
            data: artifact as any,
        },
    });

    console.log(`[worker:overview] Finished overview for ${docId}`);
	return { docId };
}
