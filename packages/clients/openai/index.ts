// Lazy import OpenAI to avoid ESM/CJS interop issues in some runners
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
let OpenAICtor: any;
import Ajv from 'ajv';

const ajv = new Ajv();

const MAX_REPAIR_ATTEMPTS = 3;

export class OpenAIClient {
    private openai!: any;

    constructor(apiKey: string) {
        // Defer requiring the module until runtime
        if (!OpenAICtor) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            OpenAICtor = require('openai').OpenAI;
        }
        this.openai = new OpenAICtor({ apiKey });
    }

    async createStructured<T>(opts: {
        model: string;
        system: string;
        userChunks: any[];
        schema: any;
        temperature?: number;
        /** If provided, uses OpenAI strict json_schema mode instead of json_object + AJV repair */
        structuredOutputName?: string;
    }): Promise<T> {
        const { model, system, userChunks, schema, temperature = 0, structuredOutputName } = opts;

        // If structuredOutputName is provided, use native json_schema mode (no repair loop needed)
        if (structuredOutputName) {
            const messages: Array<{ role: string; content: string }> = [
                { role: 'system', content: system },
                { role: 'user', content: JSON.stringify(userChunks) },
            ];
            const response = await this.openai.chat.completions.create({
                model,
                messages: messages as any,
                temperature,
                top_p: 1,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: structuredOutputName,
                        strict: true,
                        schema,
                    },
                },
            });
            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('Empty response from OpenAI');
            return JSON.parse(content) as T;
        }

        // Fallback: json_object mode with AJV repair loop
        // Ensure at least one message contains the word "json" to satisfy response_format=json_object requirements
        const systemWithJson = `${system} Return a valid JSON object that strictly matches the provided schema. Respond with JSON only.`;
        const safetyPreamble = 'Format: json. Output must be a single JSON object.';

        const messages: Array<{ role: string; content: string }> = [
            { role: 'system', content: systemWithJson },
            { role: 'user', content: safetyPreamble },
            { role: 'user', content: JSON.stringify(userChunks) },
        ];

        const validate = ajv.compile(schema);
        let lastResponse: any = null;
        let lastErrors: any[] = [];

        // Auto-repair loop: attempt to get valid structured output
        for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
            try {
                const response = await this.openai.chat.completions.create({
                    model,
                    messages: messages as any,
                    temperature,
                    top_p: 1,
                    response_format: { type: 'json_object' },
                });

                const content = response.choices[0]?.message?.content;
                if (!content) {
                    throw new Error('Empty response from OpenAI');
                }

                lastResponse = JSON.parse(content);

                if (validate(lastResponse)) {
                    // Valid response - return it
                    console.log(`[OpenAI] Structured output validated on attempt ${attempt}`);
                    return lastResponse as T;
                }

                // Validation failed - prepare repair attempt
                lastErrors = validate.errors || [];
                console.warn(`[OpenAI] Schema validation failed on attempt ${attempt}:`, lastErrors);

                if (attempt < MAX_REPAIR_ATTEMPTS) {
                    // Add repair message to conversation
                    const errorSummary = lastErrors
                        .map(e => `${e.instancePath || '/'}: ${e.message}`)
                        .join('; ');

                    messages.push({
                        role: 'assistant',
                        content: content,
                    });
                    messages.push({
                        role: 'user',
                        content: `The JSON response had schema validation errors: ${errorSummary}. Please fix these issues and return a corrected JSON object that matches the schema exactly.`,
                    });
                }
            } catch (parseError: any) {
                console.error(`[OpenAI] Parse error on attempt ${attempt}:`, parseError.message);
                
                if (attempt < MAX_REPAIR_ATTEMPTS) {
                    messages.push({
                        role: 'user',
                        content: `The previous response was not valid JSON. Please return a properly formatted JSON object that matches the required schema.`,
                    });
                }
            }
        }

        // All repair attempts exhausted
        throw new Error(
            `Schema validation failed after ${MAX_REPAIR_ATTEMPTS} attempts. Last errors: ${JSON.stringify(lastErrors)}`
        );
    }

    async chat(opts: {
        messages: Array<{ role: string; content: string }>;
        model: string;
        temperature?: number;
        max_tokens?: number;
        response_format?: { type: 'json_object' | 'json_schema' | 'text'; json_schema?: { name: string; strict: boolean; schema: Record<string, unknown> } };
    }): Promise<{ choices: Array<{ message?: { content?: string } }> }> {
        const { messages, model, temperature = 0.5, max_tokens, response_format } = opts;
        
        const response = await this.openai.chat.completions.create({
            model,
            messages: messages as any,
            temperature,
            max_tokens,
            ...(response_format && { response_format }),
        });

        return response;
    }
}
